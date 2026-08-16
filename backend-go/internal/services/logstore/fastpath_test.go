package logstore

import (
	"errors"
	"testing"
	"time"
)

func TestFastPathService_GetLineMatchesDiskLogStore(t *testing.T) {
	dir := t.TempDir()
	store, err := NewDiskLogStore(dir)
	if err != nil {
		t.Fatalf("NewDiskLogStore: %v", err)
	}
	defer store.CloseAll()

	lines := []string{"alpha", "beta line with more text", "gamma", "", "delta after empty"}
	if _, err := store.AppendBatch("src-fp", lines); err != nil {
		t.Fatalf("AppendBatch: %v", err)
	}

	fp := NewFastPathService(dir)
	defer fp.CloseAll()

	for i, want := range lines {
		got, err := fp.GetLine("src-fp", int64(i))
		if err != nil {
			t.Fatalf("GetLine(%d): unexpected error %v", i, err)
		}
		if got != want {
			t.Fatalf("GetLine(%d) = %q, want %q", i, got, want)
		}
	}
}

func TestFastPathService_GetLineOutOfRange(t *testing.T) {
	dir := t.TempDir()
	store, err := NewDiskLogStore(dir)
	if err != nil {
		t.Fatalf("NewDiskLogStore: %v", err)
	}
	defer store.CloseAll()

	if _, err := store.AppendLine("src-fp2", "only line"); err != nil {
		t.Fatalf("AppendLine: %v", err)
	}

	fp := NewFastPathService(dir)
	defer fp.CloseAll()

	if _, err := fp.GetLine("src-fp2", 5); !errors.Is(err, ErrLineNotFound) {
		t.Fatalf("GetLine(5) error = %v, want ErrLineNotFound", err)
	}
}

func TestFastPathService_GetLineUnmappedSource(t *testing.T) {
	dir := t.TempDir()
	fp := NewFastPathService(dir)
	defer fp.CloseAll()

	if _, err := fp.GetLine("does-not-exist", 0); !errors.Is(err, ErrSourceNotMapped) {
		t.Fatalf("GetLine error = %v, want ErrSourceNotMapped", err)
	}
}

func TestFastPathService_GetLinesBatch(t *testing.T) {
	dir := t.TempDir()
	store, err := NewDiskLogStore(dir)
	if err != nil {
		t.Fatalf("NewDiskLogStore: %v", err)
	}
	defer store.CloseAll()

	lines := []string{"l0", "l1", "l2", "l3"}
	if _, err := store.AppendBatch("src-fp3", lines); err != nil {
		t.Fatalf("AppendBatch: %v", err)
	}

	fp := NewFastPathService(dir)
	defer fp.CloseAll()

	got, err := fp.GetLines("src-fp3", []int64{0, 2, 3, 99})
	if err != nil {
		t.Fatalf("GetLines: %v", err)
	}
	if len(got) != 3 {
		t.Fatalf("GetLines result len = %d, want 3 (99 should be absent)", len(got))
	}
	if got[0] != "l0" || got[2] != "l2" || got[3] != "l3" {
		t.Fatalf("GetLines result = %v, want l0/l2/l3 at their ids", got)
	}
	if _, ok := got[99]; ok {
		t.Fatalf("expected id 99 to be absent from GetLines result")
	}
	if fp.HydrateMisses() != 1 {
		t.Fatalf("HydrateMisses = %d, want 1", fp.HydrateMisses())
	}
}

// TestFastPathService_LineHydratorInterface is a compile-time + runtime
// check that *FastPathService satisfies the LineHydrator interface the
// clustering worker depends on.
func TestFastPathService_LineHydratorInterface(t *testing.T) {
	dir := t.TempDir()
	var _ LineHydrator = NewFastPathService(dir)
}

// TestFastPathService_DetectsGrowthAfterDebounce writes additional lines
// via DiskLogStore after the FastPathService has already mapped (and read
// from) the source, and verifies the newly appended lines become visible
// once the 100ms remap debounce window has elapsed — mirroring
// fast_path.py's MappedSource._ensure_mapped growth-polling behavior.
func TestFastPathService_DetectsGrowthAfterDebounce(t *testing.T) {
	dir := t.TempDir()
	store, err := NewDiskLogStore(dir)
	if err != nil {
		t.Fatalf("NewDiskLogStore: %v", err)
	}
	defer store.CloseAll()

	if _, err := store.AppendBatch("src-grow", []string{"first", "second"}); err != nil {
		t.Fatalf("AppendBatch: %v", err)
	}

	fp := NewFastPathService(dir)
	defer fp.CloseAll()

	// Initial map + read.
	got, err := fp.GetLine("src-grow", 0)
	if err != nil || got != "first" {
		t.Fatalf("GetLine(0) = %q, err=%v, want 'first'", got, err)
	}

	// New line not yet visible via the mmap (may or may not be visible
	// depending on OS mmap semantics for a not-yet-mapped range) — but
	// definitely must become visible after remap.
	if _, err := store.AppendLine("src-grow", "third"); err != nil {
		t.Fatalf("AppendLine: %v", err)
	}

	// Wait out the debounce window so the next read triggers a re-stat.
	time.Sleep(remapDebounce + 50*time.Millisecond)

	got, err = fp.GetLine("src-grow", 2)
	if err != nil {
		t.Fatalf("GetLine(2) after growth: unexpected error %v", err)
	}
	if got != "third" {
		t.Fatalf("GetLine(2) after growth = %q, want 'third'", got)
	}
}

// TestFastPathService_UnmappedUntilFilesExist verifies that a source with
// no files yet (DiskLogStore handle created but before ANY line written —
// files are created but index has only the seed entry, log is empty) is
// still handled gracefully: GetLine returns ErrLineNotFound (not a panic)
// once files exist but hold zero lines.
func TestFastPathService_ZeroLineSourceIsNotFoundNotPanic(t *testing.T) {
	dir := t.TempDir()
	store, err := NewDiskLogStore(dir)
	if err != nil {
		t.Fatalf("NewDiskLogStore: %v", err)
	}
	defer store.CloseAll()

	// Force file creation with zero lines.
	if _, err := store.GetHandle("src-empty"); err != nil {
		t.Fatalf("GetHandle: %v", err)
	}

	fp := NewFastPathService(dir)
	defer fp.CloseAll()

	if _, err := fp.GetLine("src-empty", 0); !errors.Is(err, ErrLineNotFound) {
		t.Fatalf("GetLine on empty source error = %v, want ErrLineNotFound", err)
	}
}
