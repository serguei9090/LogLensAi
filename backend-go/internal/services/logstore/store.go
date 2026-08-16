// Package logstore is the disk-first ingestion layer: every source_id gets
// a dedicated append-only `<safe-name>.log` file plus a companion
// `<safe-name>.index` file (a sequence of uint64 little-endian byte
// offsets — N+1 entries for N lines, index[i] = byte offset of line i's
// start, and the final entry is the current log file size). Callers write
// raw lines here and store only (source_id, line_id) in DuckDB, instead of
// duplicating raw text into the database.
//
// This ports sidecar/src/services/log_file_store.py (DiskLogStore /
// SourceFileHandle, write path) and sidecar/src/services/fast_path.py
// (FastPathService / MappedSource, mmap read path — see fastpath.go).
package logstore

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
)

// hotBufferCap is the number of most-recently-written lines kept in RAM per
// source for fast recent-line reads without touching disk. Ports the
// `deque(maxlen=1000)` hot buffer in log_file_store.py's SourceFileHandle.
const hotBufferCap = 1000

// HotLine is one entry of a source's in-memory hot buffer.
type HotLine struct {
	ID   int64
	Text string
}

// SourceFileHandle owns one source's .log/.index file pair and in-memory
// hot buffer, all protected by a single mutex (ports SourceFileHandle in
// log_file_store.py). Unlike the Python original, this type does not
// expose its internal lock for external borrowing (`get_lock` has no
// direct Go port) — Go's sync.Mutex isn't meant to be handed out; callers
// needing cross-store synchronization should be composed at a higher
// layer.
type SourceFileHandle struct {
	Path    string
	IdxPath string

	mu        sync.Mutex
	logFile   *os.File
	idxFile   *os.File
	lineCount int64
	offset    int64 // current end-of-log-file byte offset
	hotBuffer []HotLine
	closed    bool
}

// newSourceFileHandle opens (creating if needed) the log/index file pair in
// append mode. existingCount/logSize must already reflect a
// validated/rebuilt index (see ensureIndex) so writes start from a
// consistent position.
func newSourceFileHandle(path, idxPath string, existingCount, logSize int64) (*SourceFileHandle, error) {
	logFile, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return nil, fmt.Errorf("logstore: open log file %s: %w", path, err)
	}
	idxFile, err := os.OpenFile(idxPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		_ = logFile.Close()
		return nil, fmt.Errorf("logstore: open index file %s: %w", idxPath, err)
	}

	h := &SourceFileHandle{
		Path:      path,
		IdxPath:   idxPath,
		logFile:   logFile,
		idxFile:   idxFile,
		lineCount: existingCount,
		offset:    logSize,
	}

	idxInfo, err := idxFile.Stat()
	if err != nil {
		_ = h.Close()
		return nil, fmt.Errorf("logstore: stat index file %s: %w", idxPath, err)
	}
	// Brand-new index: seed the mandatory first entry (offset 0), matching
	// SourceFileHandle.__init__'s `if self.line_count == 0 and
	// os.path.getsize(self.idx_path) == 0`.
	if existingCount == 0 && idxInfo.Size() == 0 {
		if err := writeUint64LE(idxFile, 0); err != nil {
			_ = h.Close()
			return nil, err
		}
	}
	return h, nil
}

// WriteLine appends raw as a single line and returns its 0-based line_id.
// Ports SourceFileHandle.write_line.
func (h *SourceFileHandle) WriteLine(raw string) (int64, error) {
	ids, err := h.WriteBatch([]string{raw})
	if err != nil {
		return 0, err
	}
	return ids[0], nil
}

// WriteBatch appends multiple lines in one locked section and returns their
// assigned line_ids in order. Ports SourceFileHandle.write_batch.
func (h *SourceFileHandle) WriteBatch(raws []string) ([]int64, error) {
	if len(raws) == 0 {
		return nil, nil
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	if h.closed {
		return nil, fmt.Errorf("logstore: handle for %s is closed", h.Path)
	}

	startID := h.lineCount
	ids := make([]int64, 0, len(raws))

	for i, raw := range raws {
		line := trimTrailingNewline(raw)
		encoded := []byte(line + "\n")

		if _, err := h.logFile.Write(encoded); err != nil {
			return nil, fmt.Errorf("logstore: write line to %s: %w", h.Path, err)
		}
		h.offset += int64(len(encoded))

		if err := writeUint64LE(h.idxFile, uint64(h.offset)); err != nil {
			return nil, fmt.Errorf("logstore: write index entry to %s: %w", h.IdxPath, err)
		}

		id := startID + int64(i)
		h.pushHot(HotLine{ID: id, Text: line})
		ids = append(ids, id)
	}

	h.lineCount += int64(len(raws))
	return ids, nil
}

// pushHot appends to the bounded hot buffer, dropping the oldest entries
// once hotBufferCap is exceeded. Caller must hold h.mu.
func (h *SourceFileHandle) pushHot(line HotLine) {
	h.hotBuffer = append(h.hotBuffer, line)
	if len(h.hotBuffer) > hotBufferCap {
		excess := len(h.hotBuffer) - hotBufferCap
		copy(h.hotBuffer, h.hotBuffer[excess:])
		h.hotBuffer = h.hotBuffer[:hotBufferCap]
	}
}

// HotBuffer returns a snapshot of the current in-memory hot buffer.
func (h *SourceFileHandle) HotBuffer() []HotLine {
	h.mu.Lock()
	defer h.mu.Unlock()
	out := make([]HotLine, len(h.hotBuffer))
	copy(out, h.hotBuffer)
	return out
}

// LineCount returns the number of lines written so far.
func (h *SourceFileHandle) LineCount() int64 {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.lineCount
}

// Close closes the underlying log and index files.
func (h *SourceFileHandle) Close() error {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.closed {
		return nil
	}
	h.closed = true

	var errs []error
	if h.logFile != nil {
		if err := h.logFile.Close(); err != nil {
			errs = append(errs, err)
		}
	}
	if h.idxFile != nil {
		if err := h.idxFile.Close(); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

func trimTrailingNewline(s string) string {
	for len(s) > 0 && (s[len(s)-1] == '\n' || s[len(s)-1] == '\r') {
		s = s[:len(s)-1]
	}
	return s
}

func writeUint64LE(f *os.File, v uint64) error {
	var buf [8]byte
	binary.LittleEndian.PutUint64(buf[:], v)
	_, err := f.Write(buf[:])
	return err
}

// DiskLogStore manages per-source log storage with companion indexing.
// Ports log_file_store.py's DiskLogStore.
type DiskLogStore struct {
	storageDir string

	mu       sync.Mutex
	registry map[string]*SourceFileHandle
}

// NewDiskLogStore creates storageDir if needed and returns a ready store.
func NewDiskLogStore(storageDir string) (*DiskLogStore, error) {
	if err := os.MkdirAll(storageDir, 0o755); err != nil {
		return nil, fmt.Errorf("logstore: creating storage dir %s: %w", storageDir, err)
	}
	return &DiskLogStore{
		storageDir: storageDir,
		registry:   make(map[string]*SourceFileHandle),
	}, nil
}

// FilePath returns the .log path for sourceID (sanitized), without
// requiring the source to already be open.
func (s *DiskLogStore) FilePath(sourceID string) string {
	return filepath.Join(s.storageDir, safeName(sourceID)+".log")
}

// IndexPath returns the .index path for sourceID (sanitized).
func (s *DiskLogStore) IndexPath(sourceID string) string {
	return filepath.Join(s.storageDir, safeName(sourceID)+".index")
}

// AppendLine appends raw to sourceID's log and returns its line_id.
func (s *DiskLogStore) AppendLine(sourceID, raw string) (int64, error) {
	h, err := s.GetHandle(sourceID)
	if err != nil {
		return 0, err
	}
	return h.WriteLine(raw)
}

// AppendBatch appends raws to sourceID's log and returns their line_ids.
func (s *DiskLogStore) AppendBatch(sourceID string, raws []string) ([]int64, error) {
	h, err := s.GetHandle(sourceID)
	if err != nil {
		return nil, err
	}
	return h.WriteBatch(raws)
}

// GetHotBuffer returns the current in-memory hot buffer for sourceID.
func (s *DiskLogStore) GetHotBuffer(sourceID string) ([]HotLine, error) {
	h, err := s.GetHandle(sourceID)
	if err != nil {
		return nil, err
	}
	return h.HotBuffer(), nil
}

// GetHandle returns (opening/validating/rebuilding as needed) the handle
// for sourceID, caching it for subsequent calls. Ports
// DiskLogStore.get_handle / _get_handle.
func (s *DiskLogStore) GetHandle(sourceID string) (*SourceFileHandle, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if h, ok := s.registry[sourceID]; ok {
		return h, nil
	}

	path := s.FilePath(sourceID)
	idxPath := s.IndexPath(sourceID)

	count, logSize, err := ensureIndex(path, idxPath)
	if err != nil {
		return nil, err
	}

	h, err := newSourceFileHandle(path, idxPath, count, logSize)
	if err != nil {
		return nil, err
	}
	s.registry[sourceID] = h
	return h, nil
}

// CloseAll closes every open handle and clears the registry.
func (s *DiskLogStore) CloseAll() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var errs []error
	for _, h := range s.registry {
		if err := h.Close(); err != nil {
			errs = append(errs, err)
		}
	}
	s.registry = make(map[string]*SourceFileHandle)
	return errors.Join(errs...)
}

// DeleteSourceFiles closes sourceID's handle (if open) and removes its
// physical .log/.index files.
func (s *DiskLogStore) DeleteSourceFiles(sourceID string) error {
	s.mu.Lock()
	if h, ok := s.registry[sourceID]; ok {
		_ = h.Close()
		delete(s.registry, sourceID)
	}
	s.mu.Unlock()

	var errs []error
	for _, p := range []string{s.FilePath(sourceID), s.IndexPath(sourceID)} {
		if err := os.Remove(p); err != nil && !os.IsNotExist(err) {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

// --- Index validation / rebuild, ports DiskLogStore._ensure_index /
// _validate_index / _rebuild_index / _process_index_chunk. ---

// ensureIndex validates path's companion index at idxPath, rebuilding it if
// missing/corrupt/behind, and returns the resulting line count and the
// log file's current byte size.
func ensureIndex(path, idxPath string) (count int64, logSize int64, err error) {
	info, statErr := os.Stat(path)
	if statErr != nil {
		if os.IsNotExist(statErr) {
			// Clean up an orphan index if the log itself is gone.
			_ = os.Remove(idxPath)
			return 0, 0, nil
		}
		return 0, 0, fmt.Errorf("logstore: stat log file %s: %w", path, statErr)
	}
	logSize = info.Size()

	if idxInfo, idxErr := os.Stat(idxPath); idxErr == nil {
		c, ok, vErr := validateIndex(path, idxPath, logSize, idxInfo.Size())
		if vErr != nil {
			return 0, 0, vErr
		}
		if ok {
			return c, logSize, nil
		}
	}

	c, err := rebuildIndex(path, idxPath, 0, 0)
	if err != nil {
		return 0, 0, err
	}
	return c, logSize, nil
}

// validateIndex checks the existing index's last offset against the actual
// log size. If the index is behind (log grew since last close without a
// matching index flush — e.g. a crash), it resumes rebuilding from the
// last good offset instead of rescanning from scratch.
func validateIndex(path, idxPath string, logSize, idxSize int64) (count int64, ok bool, err error) {
	if idxSize < 8 || idxSize%8 != 0 {
		return 0, false, nil
	}

	f, openErr := os.Open(idxPath)
	if openErr != nil {
		return 0, false, nil
	}
	defer f.Close()

	if _, err := f.Seek(-8, io.SeekEnd); err != nil {
		return 0, false, nil
	}
	var buf [8]byte
	if _, err := io.ReadFull(f, buf[:]); err != nil {
		return 0, false, nil
	}
	lastOffset := int64(binary.LittleEndian.Uint64(buf[:]))

	if lastOffset == logSize {
		return idxSize/8 - 1, true, nil
	}
	if lastOffset < logSize {
		initialCount := idxSize/8 - 1
		c, rErr := rebuildIndex(path, idxPath, lastOffset, initialCount)
		if rErr != nil {
			return 0, false, rErr
		}
		return c, true, nil
	}
	// lastOffset > logSize: the log shrank/was replaced under the index —
	// treat as corrupt and do a full rebuild.
	return 0, false, nil
}

// rebuildIndex rescans path for '\n' bytes starting at resumeFrom (0 for a
// full rebuild) and (re)writes idxPath accordingly, returning the final
// line count. Ports _rebuild_index + _process_index_chunk.
func rebuildIndex(path, idxPath string, resumeFrom, initialCount int64) (int64, error) {
	lf, err := os.Open(path)
	if err != nil {
		return 0, fmt.Errorf("logstore: open log for index rebuild %s: %w", path, err)
	}
	defer lf.Close()

	flags := os.O_TRUNC | os.O_CREATE | os.O_WRONLY
	if resumeFrom > 0 {
		flags = os.O_APPEND | os.O_CREATE | os.O_WRONLY
	}
	idx, err := os.OpenFile(idxPath, flags, 0o644)
	if err != nil {
		return 0, fmt.Errorf("logstore: open index for rebuild %s: %w", idxPath, err)
	}

	count := initialCount
	readPos := resumeFrom
	if resumeFrom == 0 {
		if err := writeUint64LE(idx, 0); err != nil {
			_ = idx.Close()
			return 0, err
		}
	} else if _, err := lf.Seek(resumeFrom, io.SeekStart); err != nil {
		_ = idx.Close()
		return 0, fmt.Errorf("logstore: seek log for resume rebuild %s: %w", path, err)
	}

	buf := make([]byte, 1<<20)
	for {
		n, readErr := lf.Read(buf)
		if n > 0 {
			chunk := buf[:n]
			baseOffset := readPos
			pos := bytes.IndexByte(chunk, '\n')
			for pos != -1 {
				count++
				absOffset := baseOffset + int64(pos) + 1
				if err := writeUint64LE(idx, uint64(absOffset)); err != nil {
					_ = idx.Close()
					return 0, fmt.Errorf("logstore: write rebuilt index entry %s: %w", idxPath, err)
				}
				nextRel := bytes.IndexByte(chunk[pos+1:], '\n')
				if nextRel == -1 {
					pos = -1
				} else {
					pos = pos + 1 + nextRel
				}
			}
			readPos += int64(n)
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			_ = idx.Close()
			return 0, fmt.Errorf("logstore: reading log for index rebuild %s: %w", path, readErr)
		}
	}

	finalSize := readPos
	if err := idx.Close(); err != nil {
		return 0, fmt.Errorf("logstore: closing rebuilt index %s: %w", idxPath, err)
	}

	// Verify (and repair, if needed) the final offset entry.
	rf, err := os.OpenFile(idxPath, os.O_RDWR, 0o644)
	if err != nil {
		return 0, fmt.Errorf("logstore: reopen index to verify %s: %w", idxPath, err)
	}
	defer rf.Close()

	if _, err := rf.Seek(-8, io.SeekEnd); err != nil {
		return 0, fmt.Errorf("logstore: seek index to verify %s: %w", idxPath, err)
	}
	var last [8]byte
	if _, err := io.ReadFull(rf, last[:]); err != nil {
		return 0, fmt.Errorf("logstore: read index tail to verify %s: %w", idxPath, err)
	}
	if int64(binary.LittleEndian.Uint64(last[:])) != finalSize {
		if _, err := rf.Seek(-8, io.SeekEnd); err != nil {
			return 0, err
		}
		if err := writeUint64LE(rf, uint64(finalSize)); err != nil {
			return 0, err
		}
	}

	return count, nil
}
