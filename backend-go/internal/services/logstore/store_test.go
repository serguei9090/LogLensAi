package logstore

import (
	"encoding/binary"
	"os"
	"path/filepath"
	"testing"
)

func TestSafeName(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"simple-source", "simple-source"},
		{"weird/name:with*chars", "weird_name_with_chars"},
		{"", ""},
	}
	for _, tc := range cases {
		if got := safeName(tc.in); got != tc.want {
			t.Errorf("safeName(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}

	long := ""
	for i := 0; i < 100; i++ {
		long += "a"
	}
	got := safeName(long)
	if len(got) != 64 {
		t.Errorf("expected truncation to 64 chars, got len=%d", len(got))
	}
}

func TestDiskLogStore_AppendAndReadBack(t *testing.T) {
	dir := t.TempDir()
	store, err := NewDiskLogStore(dir)
	if err != nil {
		t.Fatalf("NewDiskLogStore: %v", err)
	}
	defer store.CloseAll()

	id0, err := store.AppendLine("src-a", "hello world")
	if err != nil {
		t.Fatalf("AppendLine: %v", err)
	}
	if id0 != 0 {
		t.Fatalf("first line_id = %d, want 0", id0)
	}

	id1, err := store.AppendLine("src-a", "second line")
	if err != nil {
		t.Fatalf("AppendLine: %v", err)
	}
	if id1 != 1 {
		t.Fatalf("second line_id = %d, want 1", id1)
	}

	ids, err := store.AppendBatch("src-a", []string{"third", "fourth", "fifth"})
	if err != nil {
		t.Fatalf("AppendBatch: %v", err)
	}
	if len(ids) != 3 || ids[0] != 2 || ids[2] != 4 {
		t.Fatalf("batch ids = %v, want [2 3 4]", ids)
	}

	h, err := store.GetHandle("src-a")
	if err != nil {
		t.Fatalf("GetHandle: %v", err)
	}
	if h.LineCount() != 5 {
		t.Fatalf("LineCount = %d, want 5", h.LineCount())
	}

	// Verify the raw file content directly.
	raw, err := os.ReadFile(store.FilePath("src-a"))
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	want := "hello world\nsecond line\nthird\nfourth\nfifth\n"
	if string(raw) != want {
		t.Fatalf("log file content = %q, want %q", string(raw), want)
	}

	// Index file should have 6 entries (5 lines + initial 0).
	idxRaw, err := os.ReadFile(store.IndexPath("src-a"))
	if err != nil {
		t.Fatalf("ReadFile index: %v", err)
	}
	if len(idxRaw) != 6*8 {
		t.Fatalf("index file size = %d, want %d", len(idxRaw), 6*8)
	}
	if binary.LittleEndian.Uint64(idxRaw[0:8]) != 0 {
		t.Fatalf("index[0] should be 0")
	}
	if binary.LittleEndian.Uint64(idxRaw[6*8-8:]) != uint64(len(raw)) {
		t.Fatalf("index[last] should equal log file size %d", len(raw))
	}
}

func TestDiskLogStore_HotBuffer(t *testing.T) {
	dir := t.TempDir()
	store, err := NewDiskLogStore(dir)
	if err != nil {
		t.Fatalf("NewDiskLogStore: %v", err)
	}
	defer store.CloseAll()

	for i := 0; i < 5; i++ {
		if _, err := store.AppendLine("src-b", "line"); err != nil {
			t.Fatalf("AppendLine: %v", err)
		}
	}

	hot, err := store.GetHotBuffer("src-b")
	if err != nil {
		t.Fatalf("GetHotBuffer: %v", err)
	}
	if len(hot) != 5 {
		t.Fatalf("hot buffer len = %d, want 5", len(hot))
	}
	if hot[0].ID != 0 || hot[4].ID != 4 {
		t.Fatalf("hot buffer ids wrong: %+v", hot)
	}
}

func TestDiskLogStore_HotBufferBounded(t *testing.T) {
	dir := t.TempDir()
	store, err := NewDiskLogStore(dir)
	if err != nil {
		t.Fatalf("NewDiskLogStore: %v", err)
	}
	defer store.CloseAll()

	const total = hotBufferCap + 50
	lines := make([]string, total)
	for i := range lines {
		lines[i] = "l"
	}
	if _, err := store.AppendBatch("src-c", lines); err != nil {
		t.Fatalf("AppendBatch: %v", err)
	}

	hot, err := store.GetHotBuffer("src-c")
	if err != nil {
		t.Fatalf("GetHotBuffer: %v", err)
	}
	if len(hot) != hotBufferCap {
		t.Fatalf("hot buffer len = %d, want %d", len(hot), hotBufferCap)
	}
	if hot[0].ID != 50 {
		t.Fatalf("hot buffer should have dropped the oldest 50 entries; hot[0].ID = %d, want 50", hot[0].ID)
	}
	if hot[len(hot)-1].ID != total-1 {
		t.Fatalf("hot buffer last id = %d, want %d", hot[len(hot)-1].ID, total-1)
	}
}

func TestDiskLogStore_ReopenPreservesLineCount(t *testing.T) {
	dir := t.TempDir()
	store, err := NewDiskLogStore(dir)
	if err != nil {
		t.Fatalf("NewDiskLogStore: %v", err)
	}

	if _, err := store.AppendBatch("src-d", []string{"a", "b", "c"}); err != nil {
		t.Fatalf("AppendBatch: %v", err)
	}
	if err := store.CloseAll(); err != nil {
		t.Fatalf("CloseAll: %v", err)
	}

	store2, err := NewDiskLogStore(dir)
	if err != nil {
		t.Fatalf("NewDiskLogStore (reopen): %v", err)
	}
	defer store2.CloseAll()

	h, err := store2.GetHandle("src-d")
	if err != nil {
		t.Fatalf("GetHandle: %v", err)
	}
	if h.LineCount() != 3 {
		t.Fatalf("LineCount after reopen = %d, want 3", h.LineCount())
	}

	// Appending after reopen should continue line_ids from 3.
	id, err := store2.AppendLine("src-d", "d")
	if err != nil {
		t.Fatalf("AppendLine after reopen: %v", err)
	}
	if id != 3 {
		t.Fatalf("line_id after reopen = %d, want 3", id)
	}
}

// TestDiskLogStore_IndexRebuildOnCorruption simulates a crash where the
// .index file is missing/truncated relative to the .log file, and verifies
// GetHandle transparently rebuilds it by rescanning for '\n' bytes.
func TestDiskLogStore_IndexRebuildOnCorruption(t *testing.T) {
	dir := t.TempDir()
	store, err := NewDiskLogStore(dir)
	if err != nil {
		t.Fatalf("NewDiskLogStore: %v", err)
	}

	if _, err := store.AppendBatch("src-e", []string{"one", "two", "three", "four"}); err != nil {
		t.Fatalf("AppendBatch: %v", err)
	}
	if err := store.CloseAll(); err != nil {
		t.Fatalf("CloseAll: %v", err)
	}

	// Simulate a crash: delete the index file entirely.
	if err := os.Remove(store.IndexPath("src-e")); err != nil {
		t.Fatalf("removing index: %v", err)
	}

	store2, err := NewDiskLogStore(dir)
	if err != nil {
		t.Fatalf("NewDiskLogStore (post-crash): %v", err)
	}
	defer store2.CloseAll()

	h, err := store2.GetHandle("src-e")
	if err != nil {
		t.Fatalf("GetHandle after index loss: %v", err)
	}
	if h.LineCount() != 4 {
		t.Fatalf("rebuilt LineCount = %d, want 4", h.LineCount())
	}

	// Index should be fully valid again: 5 entries (4 lines + initial 0),
	// last entry equal to log size.
	idxRaw, err := os.ReadFile(store2.IndexPath("src-e"))
	if err != nil {
		t.Fatalf("reading rebuilt index: %v", err)
	}
	if len(idxRaw) != 5*8 {
		t.Fatalf("rebuilt index size = %d, want %d", len(idxRaw), 5*8)
	}
	logInfo, err := os.Stat(store2.FilePath("src-e"))
	if err != nil {
		t.Fatalf("stat log: %v", err)
	}
	if got := binary.LittleEndian.Uint64(idxRaw[4*8:]); got != uint64(logInfo.Size()) {
		t.Fatalf("rebuilt index last offset = %d, want log size %d", got, logInfo.Size())
	}

	// Appending after rebuild should continue from line_id 4.
	id, err := store2.AppendLine("src-e", "five")
	if err != nil {
		t.Fatalf("AppendLine after rebuild: %v", err)
	}
	if id != 4 {
		t.Fatalf("line_id after rebuild = %d, want 4", id)
	}
}

// TestDiskLogStore_IndexResumeFromLastGoodOffset simulates the index being
// merely *behind* the log (last flushed offset < current log size, e.g. an
// index write that didn't make it to disk before a crash) rather than
// missing entirely, and verifies it resumes rather than fully rescanning.
func TestDiskLogStore_IndexResumeFromLastGoodOffset(t *testing.T) {
	dir := t.TempDir()
	store, err := NewDiskLogStore(dir)
	if err != nil {
		t.Fatalf("NewDiskLogStore: %v", err)
	}
	if _, err := store.AppendBatch("src-f", []string{"one", "two", "three"}); err != nil {
		t.Fatalf("AppendBatch: %v", err)
	}
	if err := store.CloseAll(); err != nil {
		t.Fatalf("CloseAll: %v", err)
	}

	// Truncate the index to only the first 2 entries (offset 0 and offset
	// of end-of-line-0), simulating a lost index write for lines 1 and 2.
	idxPath := store.IndexPath("src-f")
	idxRaw, err := os.ReadFile(idxPath)
	if err != nil {
		t.Fatalf("reading index: %v", err)
	}
	truncated := idxRaw[:2*8]
	if err := os.WriteFile(idxPath, truncated, 0o644); err != nil {
		t.Fatalf("truncating index: %v", err)
	}

	store2, err := NewDiskLogStore(dir)
	if err != nil {
		t.Fatalf("NewDiskLogStore (post-truncate): %v", err)
	}
	defer store2.CloseAll()

	h, err := store2.GetHandle("src-f")
	if err != nil {
		t.Fatalf("GetHandle after index truncation: %v", err)
	}
	if h.LineCount() != 3 {
		t.Fatalf("resumed LineCount = %d, want 3", h.LineCount())
	}

	idxRaw2, err := os.ReadFile(idxPath)
	if err != nil {
		t.Fatalf("reading resumed index: %v", err)
	}
	if len(idxRaw2) != 4*8 {
		t.Fatalf("resumed index size = %d, want %d", len(idxRaw2), 4*8)
	}
}

func TestDiskLogStore_DeleteSourceFiles(t *testing.T) {
	dir := t.TempDir()
	store, err := NewDiskLogStore(dir)
	if err != nil {
		t.Fatalf("NewDiskLogStore: %v", err)
	}
	defer store.CloseAll()

	if _, err := store.AppendLine("src-g", "x"); err != nil {
		t.Fatalf("AppendLine: %v", err)
	}
	logPath := store.FilePath("src-g")
	idxPath := store.IndexPath("src-g")

	if err := store.DeleteSourceFiles("src-g"); err != nil {
		t.Fatalf("DeleteSourceFiles: %v", err)
	}
	if _, err := os.Stat(logPath); !os.IsNotExist(err) {
		t.Fatalf("expected log file to be deleted, stat err = %v", err)
	}
	if _, err := os.Stat(idxPath); !os.IsNotExist(err) {
		t.Fatalf("expected index file to be deleted, stat err = %v", err)
	}
}

func TestDiskLogStore_FilePathSanitizesSourceID(t *testing.T) {
	dir := t.TempDir()
	store, err := NewDiskLogStore(dir)
	if err != nil {
		t.Fatalf("NewDiskLogStore: %v", err)
	}
	defer store.CloseAll()

	got := store.FilePath("weird/name:1")
	want := filepath.Join(dir, "weird_name_1.log")
	if got != want {
		t.Fatalf("FilePath = %q, want %q", got, want)
	}
}
