// Package ingestion ports the sidecar's log-intake subsystem: local file
// tailing (tailer.py), SSH remote tailing (ssh_loader.py), the multi-tenant
// fan-out layer they both subscribe through (services/shared_core.py), and
// the syslog UDP / HTTP push listeners (ingestion.py).
package ingestion

import (
	"bufio"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"

	"loglensai/backend-go/internal/services/logstore"
)

// pollInterval is the sleep between readline attempts once tailing has
// fallen back to polling, matching tailer.py/shared_core.py's
// `time.sleep(0.1)` between empty readline() calls.
const pollInterval = 100 * time.Millisecond

// safetyPulse is the maximum time runTailWatch waits for a filesystem event
// before re-checking the file anyway — a defensive pulse in case an fsnotify
// event is missed, mirroring `self._modified_event.wait(timeout=1.0)` in
// shared_core.py's SharedSource._run_tail.
const safetyPulse = 1 * time.Second

// LineCallback receives a newly observed raw line and the 0-based line_id
// DiskLogStore assigned it. Mirrors the `Callable[[str, int], None]`
// subscriber signature in shared_core.py.
type LineCallback func(line string, lineID int64)

// SharedSource fans one physical log source out to every subscribed
// workspace, tailing the underlying file (if any) exactly once no matter how
// many subscribers it has. Ports shared_core.py's SharedSource.
type SharedSource struct {
	SourceID string
	Filepath string // "" for sources with no physical file (SSH/API-only — pushed via PushLine).

	logStore *logstore.DiskLogStore

	mu          sync.Mutex
	subscribers map[int]LineCallback
	nextSubID   int
	running     bool
	stopCh      chan struct{}
	doneCh      chan struct{}
}

func newSharedSource(sourceID, filepath string, logStore *logstore.DiskLogStore) *SharedSource {
	return &SharedSource{
		SourceID:    sourceID,
		Filepath:    filepath,
		logStore:    logStore,
		subscribers: make(map[int]LineCallback),
	}
}

// Subscribe registers cb for new lines and, on the first subscriber, starts
// tailing the underlying file (if this source has one). Returns a token to
// pass to Unsubscribe. Ports SharedSource.subscribe.
func (s *SharedSource) Subscribe(cb LineCallback) int {
	s.mu.Lock()
	defer s.mu.Unlock()

	id := s.nextSubID
	s.nextSubID++
	s.subscribers[id] = cb

	if !s.running && s.Filepath != "" {
		s.running = true
		s.stopCh = make(chan struct{})
		s.doneCh = make(chan struct{})
		go s.runTail(s.stopCh, s.doneCh)
		log.Printf("[SharedSource] Started tailing %s", s.Filepath)
	}
	return id
}

// Unsubscribe removes the subscriber registered under id and, once no
// subscribers remain, signals the tailer goroutine to stop (without
// blocking on it — matching SharedSource.unsubscribe, which does not join
// the tailer thread; only SharedSourceManager.cleanup does). Ports
// SharedSource.unsubscribe.
func (s *SharedSource) Unsubscribe(id int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.subscribers, id)
	if len(s.subscribers) == 0 && s.running {
		s.running = false
		close(s.stopCh)
		log.Printf("[SharedSource] Stopped tailing %s", s.Filepath)
	}
}

// cleanup stops tailing unconditionally and waits (bounded) for the tailer
// goroutine to exit. Ports SharedSource.cleanup.
func (s *SharedSource) cleanup() {
	s.mu.Lock()
	var stopCh, doneCh chan struct{}
	if s.running {
		s.running = false
		stopCh = s.stopCh
		doneCh = s.doneCh
		close(stopCh)
	} else {
		doneCh = s.doneCh
	}
	s.mu.Unlock()

	if doneCh != nil {
		select {
		case <-doneCh:
		case <-time.After(1 * time.Second):
		}
	}
}

// PushLine manually injects a line (used by SSHLoader and HTTP/syslog
// ingestion, which have no fsnotify-watchable local file of their own).
// Ports SharedSource.push_line.
func (s *SharedSource) PushLine(line string) {
	s.handleNewLine(line)
}

// PushBatch broadcasts lines that were already persisted to disk by the
// caller (used by batch ingestion paths that write via DiskLogStore
// themselves) without appending them again. Ports SharedSource.push_batch.
func (s *SharedSource) PushBatch(lines []string, lineIDs []int64) {
	subs := s.subscriberSnapshot()
	if len(subs) == 0 {
		return
	}
	for i, line := range lines {
		s.broadcast(subs, line, lineIDs[i])
	}
}

// handleNewLine appends line to the shared log store then broadcasts it to
// every subscriber. Ports SharedSource._handle_new_line.
func (s *SharedSource) handleNewLine(line string) {
	lineID, err := s.logStore.AppendLine(s.SourceID, line)
	if err != nil {
		log.Printf("[SharedSource] Failed to append line for %s: %v", s.SourceID, err)
		return
	}
	subs := s.subscriberSnapshot()
	s.broadcast(subs, line, lineID)
}

func (s *SharedSource) subscriberSnapshot() []LineCallback {
	s.mu.Lock()
	defer s.mu.Unlock()
	subs := make([]LineCallback, 0, len(s.subscribers))
	for _, cb := range s.subscribers {
		subs = append(subs, cb)
	}
	return subs
}

// broadcast invokes every subscriber callback, isolating each call so one
// subscriber's panic/error can't block or take down the others — Python's
// equivalent is a `try/except Exception` around each individual call.
func (s *SharedSource) broadcast(subs []LineCallback, line string, lineID int64) {
	for _, cb := range subs {
		s.invokeSafely(cb, line, lineID)
	}
}

func (s *SharedSource) invokeSafely(cb LineCallback, line string, lineID int64) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[SharedSource] Subscriber panic: %v", r)
		}
	}()
	cb(line, lineID)
}

// runTail tails Filepath until stopCh is closed, preferring fsnotify-driven
// wakeups and falling back to polling if the watcher can't be set up. Ports
// SharedSource._run_tail / _run_tail_polling.
func (s *SharedSource) runTail(stopCh, doneCh chan struct{}) {
	defer close(doneCh)

	if err := s.runTailWatch(stopCh); err != nil {
		log.Printf("[SharedSource] Watch-based tailing failed for %s, falling back to polling: %v", s.Filepath, err)
		s.runTailPolling(stopCh)
	}
}

// runTailWatch opens Filepath, seeks to EOF, and reads newly appended lines
// as they arrive, using fsnotify to wake up promptly (with safetyPulse as a
// defensive backstop) instead of busy-polling. Returns an error (triggering
// the polling fallback) if the watcher or file can't be opened; returns nil
// once stopCh is closed.
func (s *SharedSource) runTailWatch(stopCh chan struct{}) error {
	absPath, err := filepath.Abs(s.Filepath)
	if err != nil {
		return err
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}
	defer watcher.Close()

	dir := filepath.Dir(absPath)
	if err := watcher.Add(dir); err != nil {
		return err
	}

	f, err := os.Open(s.Filepath)
	if err != nil {
		return err
	}
	defer f.Close()
	if _, err := f.Seek(0, io.SeekEnd); err != nil {
		return err
	}
	reader := bufio.NewReader(f)

	modified := make(chan struct{}, 1)
	watchStopped := make(chan struct{})
	go func() {
		defer close(watchStopped)
		for {
			select {
			case ev, ok := <-watcher.Events:
				if !ok {
					return
				}
				evPath, absErr := filepath.Abs(ev.Name)
				if absErr == nil && evPath == absPath && ev.Op&(fsnotify.Write|fsnotify.Create) != 0 {
					select {
					case modified <- struct{}{}:
					default:
					}
				}
			case _, ok := <-watcher.Errors:
				if !ok {
					return
				}
			case <-stopCh:
				return
			}
		}
	}()

	for {
		readAvailableLines(reader, s.handleNewLine)

		select {
		case <-stopCh:
			<-watchStopped
			return nil
		case <-modified:
		case <-time.After(safetyPulse):
		}
	}
}

// runTailPolling is the no-fsnotify fallback: readline in a loop, sleeping
// pollInterval whenever nothing new is available. Ports
// SharedSource._run_tail_polling.
func (s *SharedSource) runTailPolling(stopCh chan struct{}) {
	f, err := os.Open(s.Filepath)
	if err != nil {
		log.Printf("[SharedSource] Polling tailer failed to open %s: %v", s.Filepath, err)
		return
	}
	defer f.Close()
	if _, err := f.Seek(0, io.SeekEnd); err != nil {
		log.Printf("[SharedSource] Polling tailer failed to seek %s: %v", s.Filepath, err)
		return
	}
	reader := bufio.NewReader(f)

	for {
		select {
		case <-stopCh:
			return
		default:
		}

		readAvailableLines(reader, s.handleNewLine)

		select {
		case <-stopCh:
			return
		case <-time.After(pollInterval):
		}
	}
}

// readAvailableLines drains reader until it hits EOF (or another read
// error), invoking handle for each line. Like Python's `f.readline()` at
// EOF, a final chunk with data but no trailing newline is still delivered
// as one "line" — a known quirk inherited from the original (a writer that
// appends a partial line without a trailing "\n" can have it split across
// two callback invocations), not something this port changes.
func readAvailableLines(reader *bufio.Reader, handle func(string)) {
	for {
		data, err := reader.ReadBytes('\n')
		if len(data) > 0 {
			handle(strings.TrimRight(string(data), "\r\n"))
		}
		if err != nil {
			return
		}
	}
}

// SharedSourceManager owns every SharedSource for a process, ensuring only
// one physical tailer exists per source_id no matter how many workspaces
// subscribe to it. Ports shared_core.py's SharedSourceManager.
//
// Python implements this as a process-wide singleton (`__new__` returning a
// shared instance). This port instead expects the caller to construct one
// SharedSourceManager and share that single instance across every
// FileTailer/SSHLoader/listener that needs it — the same "one manager, one
// physical tailer per source" guarantee, via explicit dependency injection
// rather than a package-level global.
type SharedSourceManager struct {
	logStore *logstore.DiskLogStore

	mu      sync.Mutex
	sources map[string]*SharedSource
}

// NewSharedSourceManager returns a manager backed by logStore.
func NewSharedSourceManager(logStore *logstore.DiskLogStore) *SharedSourceManager {
	return &SharedSourceManager{
		logStore: logStore,
		sources:  make(map[string]*SharedSource),
	}
}

// GetSource returns the existing SharedSource for sourceID, or creates one
// (using filepath, which may be "" for a physical-file-less source). If a
// source already exists, its original filepath is kept — the same
// first-writer-wins behavior as Python's `get_source`, which never updates
// an existing SharedSource's filepath. Ports
// SharedSourceManager.get_source.
func (m *SharedSourceManager) GetSource(sourceID, filepath string) *SharedSource {
	m.mu.Lock()
	defer m.mu.Unlock()

	if s, ok := m.sources[sourceID]; ok {
		return s
	}
	s := newSharedSource(sourceID, filepath, m.logStore)
	m.sources[sourceID] = s
	return s
}

// Cleanup stops and joins every managed source, then clears the registry.
// Ports SharedSourceManager.cleanup.
func (m *SharedSourceManager) Cleanup() {
	m.mu.Lock()
	sources := make([]*SharedSource, 0, len(m.sources))
	for _, s := range m.sources {
		sources = append(sources, s)
	}
	m.sources = make(map[string]*SharedSource)
	m.mu.Unlock()

	for _, s := range sources {
		s.cleanup()
	}
}
