package ingestion

import (
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"loglensai/backend-go/internal/services/logstore"
)

func newTestLogStore(t *testing.T) *logstore.DiskLogStore {
	t.Helper()
	store, err := logstore.NewDiskLogStore(t.TempDir())
	if err != nil {
		t.Fatalf("NewDiskLogStore: %v", err)
	}
	// Release open .log/.index file handles before the t.TempDir() cleanup
	// tries to remove them — required on Windows, where an open file can't
	// be unlinked out from under its handle.
	t.Cleanup(func() { _ = store.CloseAll() })
	return store
}

// TestSharedSourceManager_DedupesPhysicalTailer verifies that two
// subscribers to the same source_id share exactly one SharedSource (and
// therefore one physical tailer goroutine) rather than each spinning up
// their own — the core multi-tenant fan-out guarantee shared_core.py's
// SharedSourceManager provides.
func TestSharedSourceManager_DedupesPhysicalTailer(t *testing.T) {
	dir := t.TempDir()
	logFile := filepath.Join(dir, "app.log")
	if err := os.WriteFile(logFile, nil, 0o644); err != nil {
		t.Fatalf("seed log file: %v", err)
	}

	store := newTestLogStore(t)
	mgr := NewSharedSourceManager(store)

	srcA := mgr.GetSource("shared-src", logFile)
	srcB := mgr.GetSource("shared-src", logFile)
	if srcA != srcB {
		t.Fatalf("GetSource returned distinct SharedSource instances for the same source_id: %p != %p", srcA, srcB)
	}

	var mu sync.Mutex
	var gotA, gotB []string

	idA := srcA.Subscribe(func(line string, lineID int64) {
		mu.Lock()
		gotA = append(gotA, line)
		mu.Unlock()
	})
	idB := srcB.Subscribe(func(line string, lineID int64) {
		mu.Lock()
		gotB = append(gotB, line)
		mu.Unlock()
	})
	defer srcA.Unsubscribe(idA)
	defer srcB.Unsubscribe(idB)

	// Give the tailer goroutine a moment to seek to EOF before we append,
	// otherwise the append could race the initial Seek(0, io.SeekEnd) and
	// get replayed twice (or missed) rather than testing dedup.
	time.Sleep(50 * time.Millisecond)

	f, err := os.OpenFile(logFile, os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		t.Fatalf("open for append: %v", err)
	}
	if _, err := f.WriteString("hello world\n"); err != nil {
		t.Fatalf("append: %v", err)
	}
	f.Close()

	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		mu.Lock()
		done := len(gotA) == 1 && len(gotB) == 1
		mu.Unlock()
		if done {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}

	mu.Lock()
	defer mu.Unlock()
	if len(gotA) != 1 || gotA[0] != "hello world" {
		t.Errorf("subscriber A got %v, want exactly [\"hello world\"]", gotA)
	}
	if len(gotB) != 1 || gotB[0] != "hello world" {
		t.Errorf("subscriber B got %v, want exactly [\"hello world\"]", gotB)
	}
}

// TestSharedSourceManager_DistinctSourceIDsGetDistinctSources verifies two
// different source_ids never collapse into one SharedSource.
func TestSharedSourceManager_DistinctSourceIDsGetDistinctSources(t *testing.T) {
	store := newTestLogStore(t)
	mgr := NewSharedSourceManager(store)

	a := mgr.GetSource("src-a", "")
	b := mgr.GetSource("src-b", "")
	if a == b {
		t.Fatalf("distinct source_ids collapsed into the same SharedSource")
	}
}

// TestSharedSource_PushLine verifies the manual-push path (used by
// SSHLoader and the syslog/HTTP listeners for sources with no local file to
// fsnotify-watch): PushLine should append to the log store and broadcast to
// subscribers, without any tailing goroutine involved.
func TestSharedSource_PushLine(t *testing.T) {
	store := newTestLogStore(t)
	mgr := NewSharedSourceManager(store)
	src := mgr.GetSource("no-file-src", "") // no filepath => no physical tailer

	var mu sync.Mutex
	var received []string
	var receivedIDs []int64
	src.Subscribe(func(line string, lineID int64) {
		mu.Lock()
		received = append(received, line)
		receivedIDs = append(receivedIDs, lineID)
		mu.Unlock()
	})

	src.PushLine("line one")
	src.PushLine("line two")

	mu.Lock()
	defer mu.Unlock()
	if len(received) != 2 || received[0] != "line one" || received[1] != "line two" {
		t.Fatalf("received = %v, want [\"line one\" \"line two\"]", received)
	}
	if receivedIDs[0] != 0 || receivedIDs[1] != 1 {
		t.Fatalf("receivedIDs = %v, want [0 1]", receivedIDs)
	}

	// The pushed lines must actually have landed in the log store too.
	lines, err := store.GetHotBuffer("no-file-src")
	if err != nil {
		t.Fatalf("GetHotBuffer: %v", err)
	}
	if len(lines) != 2 {
		t.Fatalf("log store has %d lines, want 2", len(lines))
	}
}

// TestSharedSource_SubscriberPanicDoesNotBlockOthers verifies one
// subscriber's panic can't prevent other subscribers from receiving the
// same broadcast.
func TestSharedSource_SubscriberPanicDoesNotBlockOthers(t *testing.T) {
	store := newTestLogStore(t)
	mgr := NewSharedSourceManager(store)
	src := mgr.GetSource("panic-src", "")

	var mu sync.Mutex
	var goodReceived bool

	src.Subscribe(func(line string, lineID int64) {
		panic("boom")
	})
	src.Subscribe(func(line string, lineID int64) {
		mu.Lock()
		goodReceived = true
		mu.Unlock()
	})

	src.PushLine("test line")

	mu.Lock()
	defer mu.Unlock()
	if !goodReceived {
		t.Fatal("well-behaved subscriber did not receive the line after another subscriber panicked")
	}
}

// TestSharedSourceManager_Cleanup verifies Cleanup stops tailing and clears
// the registry so a subsequent GetSource for the same id builds a fresh
// SharedSource.
func TestSharedSourceManager_Cleanup(t *testing.T) {
	store := newTestLogStore(t)
	mgr := NewSharedSourceManager(store)

	src := mgr.GetSource("cleanup-src", "")
	id := src.Subscribe(func(string, int64) {})
	defer src.Unsubscribe(id)

	mgr.Cleanup()

	again := mgr.GetSource("cleanup-src", "")
	if again == src {
		t.Fatal("expected Cleanup to clear the registry, GetSource returned the same instance")
	}
}
