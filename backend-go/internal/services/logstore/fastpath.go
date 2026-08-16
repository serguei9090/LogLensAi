package logstore

import (
	"encoding/binary"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/exp/mmap"
)

// remapDebounce mirrors fast_path.py's 100ms debounce on re-stat'ing the
// mapped files to check for growth.
const remapDebounce = 100 * time.Millisecond

// ErrSourceNotMapped is returned when a source's .log/.index files don't
// exist yet (or were removed), matching FastPathService._get_source
// returning None.
var ErrSourceNotMapped = errors.New("logstore: source has no mapped .log/.index files")

// ErrLineNotFound is returned when the requested line_id falls outside the
// currently-mapped index, matching MappedSource.get_line returning None.
var ErrLineNotFound = errors.New("logstore: line not found")

// LineHydrator is the batch-read interface the clustering worker consumes
// to rehydrate raw text for cluster line_ids. *FastPathService implements
// it.
type LineHydrator interface {
	GetLine(sourceID string, lineID int64) (string, error)
	GetLines(sourceID string, lineIDs []int64) (map[int64]string, error)
}

// mappedSource holds golang.org/x/exp/mmap read-only mappings for one
// source's .log and .index files, remapping lazily (debounced) when the
// underlying files grow. Ports fast_path.py's MappedSource.
//
// golang.org/x/exp/mmap.ReaderAt has no "remap" primitive — like the OS
// mapping it wraps, a mapping's size is fixed at Open time — so growth
// detection here closes and reopens both mappings, rather than Python's
// mmap.mmap which is resized as an mmap.mmap object but conceptually
// undergoes the same close+remap.
type mappedSource struct {
	logPath string
	idxPath string

	mu          sync.Mutex
	logMmap     *mmap.ReaderAt
	idxMmap     *mmap.ReaderAt
	lastCheck   time.Time
	lastLogSize int64
	lastIdxSize int64
}

func newMappedSource(logPath, idxPath string) *mappedSource {
	return &mappedSource{logPath: logPath, idxPath: idxPath}
}

// ensureMapped lazily (re)opens the mmap'd views, matching
// MappedSource._ensure_mapped. Caller must hold m.mu.
func (m *mappedSource) ensureMapped() {
	now := time.Now()

	if m.logMmap != nil && m.idxMmap != nil {
		if now.Sub(m.lastCheck) < remapDebounce {
			return
		}
		m.lastCheck = now

		logSize, logErr := fileSize(m.logPath)
		idxSize, idxErr := fileSize(m.idxPath)
		if logErr != nil || idxErr != nil {
			m.closeLocked()
			return
		}

		if logSize == m.lastLogSize && idxSize == m.lastIdxSize {
			return
		}

		if logSize > int64(m.logMmap.Len()) || idxSize > int64(m.idxMmap.Len()) {
			m.closeLocked()
			// fall through to (re)map below
		} else {
			m.lastLogSize = logSize
			m.lastIdxSize = idxSize
			return
		}
	}

	m.lastCheck = now
	logSize, logErr := fileSize(m.logPath)
	idxSize, idxErr := fileSize(m.idxPath)
	if logErr != nil || idxErr != nil {
		return
	}
	m.lastLogSize = logSize
	m.lastIdxSize = idxSize

	if logSize == 0 || idxSize < 8 {
		return
	}

	logMmap, err := mmap.Open(m.logPath)
	if err != nil {
		return
	}
	idxMmap, err := mmap.Open(m.idxPath)
	if err != nil {
		_ = logMmap.Close()
		return
	}
	m.logMmap = logMmap
	m.idxMmap = idxMmap
}

func fileSize(path string) (int64, error) {
	info, err := os.Stat(path)
	if err != nil {
		return 0, err
	}
	return info.Size(), nil
}

// getLine reads line lineID via the index/log mmaps in O(1): two adjacent
// 8-byte offsets from the index mmap bound the exact byte range in the log
// mmap. Ports MappedSource.get_line.
func (m *mappedSource) getLine(lineID int64) (string, bool) {
	if lineID < 0 {
		return "", false
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	m.ensureMapped()
	if m.logMmap == nil || m.idxMmap == nil {
		return "", false
	}

	startPos := lineID * 8
	// Need entries [lineID] and [lineID+1] — 16 bytes starting at startPos.
	if startPos+16 > int64(m.idxMmap.Len()) {
		return "", false
	}

	var offsets [16]byte
	if _, err := m.idxMmap.ReadAt(offsets[:], startPos); err != nil {
		return "", false
	}
	startOffset := int64(binary.LittleEndian.Uint64(offsets[0:8]))
	endOffset := int64(binary.LittleEndian.Uint64(offsets[8:16]))

	if endOffset < startOffset || endOffset > int64(m.logMmap.Len()) || startOffset < 0 {
		return "", false
	}

	lineBuf := make([]byte, endOffset-startOffset)
	if len(lineBuf) > 0 {
		if _, err := m.logMmap.ReadAt(lineBuf, startOffset); err != nil {
			return "", false
		}
	}
	return strings.TrimRight(string(lineBuf), "\n"), true
}

// closeLocked closes any open mappings. Caller must hold m.mu.
func (m *mappedSource) closeLocked() {
	if m.logMmap != nil {
		_ = m.logMmap.Close()
		m.logMmap = nil
	}
	if m.idxMmap != nil {
		_ = m.idxMmap.Close()
		m.idxMmap = nil
	}
}

func (m *mappedSource) close() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.closeLocked()
}

// FastPathService provides O(1) random-access reads of raw log text by
// (sourceID, lineID), backed by mmap'd views of the .log/.index files
// DiskLogStore maintains. Ports fast_path.py's FastPathService.
type FastPathService struct {
	storageDir string

	mu      sync.Mutex
	sources map[string]*mappedSource

	hydrateMisses int64 // atomic; health metric, mirrors self.hydrate_misses
}

// NewFastPathService returns a service that maps files under storageDir —
// the same directory a DiskLogStore for the same sources was constructed
// with, so filenames (via safeName) line up.
func NewFastPathService(storageDir string) *FastPathService {
	return &FastPathService{
		storageDir: storageDir,
		sources:    make(map[string]*mappedSource),
	}
}

// GetLine returns the text of lineID within sourceID's log, or an error if
// the source isn't mapped or the line doesn't exist (yet, or ever).
func (f *FastPathService) GetLine(sourceID string, lineID int64) (string, error) {
	src, err := f.getSource(sourceID)
	if err != nil {
		return "", err
	}
	text, ok := src.getLine(lineID)
	if !ok {
		atomic.AddInt64(&f.hydrateMisses, 1)
		return "", ErrLineNotFound
	}
	return text, nil
}

// GetLines is the batch variant of GetLine: it returns a map keyed by the
// subset of lineIDs that were successfully resolved. Missing/out-of-range
// line_ids are simply absent from the result (each counted in
// HydrateMisses) rather than reproducing Python's get_lines, which returns
// a positional list with None placeholders — a map fits Go's calling
// convention better for the clustering worker's line-id-keyed lookups.
func (f *FastPathService) GetLines(sourceID string, lineIDs []int64) (map[int64]string, error) {
	src, err := f.getSource(sourceID)
	if err != nil {
		return nil, err
	}

	out := make(map[int64]string, len(lineIDs))
	for _, id := range lineIDs {
		if text, ok := src.getLine(id); ok {
			out[id] = text
		} else {
			atomic.AddInt64(&f.hydrateMisses, 1)
		}
	}
	return out, nil
}

// HydrateMisses returns the running count of lookups that failed to
// resolve a line (health metric, mirrors FastPathService.hydrate_misses).
func (f *FastPathService) HydrateMisses() int64 {
	return atomic.LoadInt64(&f.hydrateMisses)
}

func (f *FastPathService) getSource(sourceID string) (*mappedSource, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if src, ok := f.sources[sourceID]; ok {
		return src, nil
	}

	safe := safeName(sourceID)
	logPath := filepath.Join(f.storageDir, safe+".log")
	idxPath := filepath.Join(f.storageDir, safe+".index")

	if _, err := os.Stat(logPath); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrSourceNotMapped, logPath)
	}
	if _, err := os.Stat(idxPath); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrSourceNotMapped, idxPath)
	}

	src := newMappedSource(logPath, idxPath)
	f.sources[sourceID] = src
	return src, nil
}

// CloseAll closes every mapped source and clears the cache.
func (f *FastPathService) CloseAll() {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, src := range f.sources {
		src.close()
	}
	f.sources = make(map[string]*mappedSource)
}
