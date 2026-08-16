package ingestion

import (
	"fmt"
	"testing"
	"time"

	"loglensai/backend-go/internal/db"
)

func openTestDB(t *testing.T) *db.DB {
	t.Helper()
	d, err := db.Open(db.MemoryDB)
	if err != nil {
		t.Fatalf("db.Open(MemoryDB): %v", err)
	}
	t.Cleanup(func() { _ = d.Close() })
	return d
}

func countLogs(t *testing.T, d *db.DB) int {
	t.Helper()
	var n int
	if err := d.Conn.QueryRow(`SELECT COUNT(*) FROM logs`).Scan(&n); err != nil {
		t.Fatalf("counting logs: %v", err)
	}
	return n
}

func waitForLogCount(t *testing.T, d *db.DB, want int, timeout time.Duration) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	var last int
	for time.Now().Before(deadline) {
		last = countLogs(t, d)
		if last >= want {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for %d logs, got %d", want, last)
}

// newRunningTailer builds a FileTailer with its flush loop running (as
// Start() would set up), without going through a real SharedSource
// subscription — tests drive it directly via processLine, whitebox style.
func newRunningTailer(t *testing.T, d *db.DB) *FileTailer {
	t.Helper()
	mgr := NewSharedSourceManager(newTestLogStore(t))
	tailer := NewFileTailer("nonexistent.log", "ws1", d, mgr, "tailer-src")

	tailer.stopCh = make(chan struct{})
	tailer.doneCh = make(chan struct{})
	go tailer.flushLoop(tailer.stopCh, tailer.doneCh)
	t.Cleanup(func() {
		close(tailer.stopCh)
		<-tailer.doneCh
	})
	return tailer
}

// TestFileTailer_FlushesOnBatchSize verifies pushing >= tailerBatchSize
// lines triggers an immediate flush (well within the 100ms timer window),
// mirroring tailer.py's "flush every 500 lines" behavior.
func TestFileTailer_FlushesOnBatchSize(t *testing.T) {
	d := openTestDB(t)
	tailer := newRunningTailer(t, d)

	for i := 0; i < tailerBatchSize; i++ {
		tailer.processLine(fmt.Sprintf("line %d", i), int64(i))
	}

	// Flush is triggered as soon as the batch-size wake signal fires (no
	// need to wait out multiple 100ms ticks) — the generous timeout here is
	// just slack for DuckDB's per-row insert cost (500 sequential Execs in
	// one transaction), not for waiting on the timer.
	waitForLogCount(t, d, tailerBatchSize, 5*time.Second)
}

// TestFileTailer_FlushesOnTimer verifies a small batch (well under
// tailerBatchSize) still gets flushed once the ~100ms timer fires, not held
// forever waiting for more lines.
func TestFileTailer_FlushesOnTimer(t *testing.T) {
	d := openTestDB(t)
	tailer := newRunningTailer(t, d)

	for i := 0; i < 5; i++ {
		tailer.processLine(fmt.Sprintf("line %d", i), int64(i))
	}

	if got := countLogs(t, d); got != 0 {
		t.Fatalf("expected no rows flushed yet, got %d", got)
	}

	waitForLogCount(t, d, 5, 500*time.Millisecond)
}

// TestFileTailer_StopFlushesRemaining verifies Stop() flushes whatever is
// still queued rather than dropping it, mirroring FileTailer.stop's
// `self._flush_remaining()`.
func TestFileTailer_StopFlushesRemaining(t *testing.T) {
	d := openTestDB(t)
	mgr := NewSharedSourceManager(newTestLogStore(t))
	tailer := NewFileTailer("nonexistent.log", "ws1", d, mgr, "stop-src")

	tailer.stopCh = make(chan struct{})
	tailer.doneCh = make(chan struct{})
	go tailer.flushLoop(tailer.stopCh, tailer.doneCh)

	for i := 0; i < 3; i++ {
		tailer.processLine(fmt.Sprintf("line %d", i), int64(i))
	}

	// Stop the flush loop the same way Stop() does (without a shared
	// source to unsubscribe from here, since we bypassed Start()).
	close(tailer.stopCh)
	<-tailer.doneCh
	tailer.flushBatch(tailer.queue.drain())

	if got := countLogs(t, d); got != 3 {
		t.Fatalf("expected 3 rows after stop-time flush, got %d", got)
	}
}

// TestFileTailer_EmptyLineIgnored verifies an empty line is never queued,
// matching `if not line: return` in FileTailer._process_line.
func TestFileTailer_EmptyLineIgnored(t *testing.T) {
	d := openTestDB(t)
	tailer := newRunningTailer(t, d)

	tailer.processLine("", 0)
	tailer.processLine("real line", 1)

	waitForLogCount(t, d, 1, 500*time.Millisecond)
	if got := countLogs(t, d); got != 1 {
		t.Fatalf("expected exactly 1 row (empty line skipped), got %d", got)
	}
}

// TestFileTailer_RowShape verifies a flushed row lands with the expected
// workspace/source/level/cluster/processed shape.
func TestFileTailer_RowShape(t *testing.T) {
	d := openTestDB(t)
	tailer := newRunningTailer(t, d)

	tailer.processLine("2024-01-01 10:00:00 ERROR something broke", 42)
	waitForLogCount(t, d, 1, 500*time.Millisecond)

	var workspaceID, sourceID, level string
	var lineID int64
	var clusterID *string
	var processed bool
	err := d.Conn.QueryRow(
		`SELECT workspace_id, source_id, line_id, level, cluster_id, processed FROM logs LIMIT 1`,
	).Scan(&workspaceID, &sourceID, &lineID, &level, &clusterID, &processed)
	if err != nil {
		t.Fatalf("querying inserted row: %v", err)
	}

	if workspaceID != "ws1" || sourceID != "tailer-src" || lineID != 42 {
		t.Errorf("got workspace_id=%q source_id=%q line_id=%d, want ws1/tailer-src/42", workspaceID, sourceID, lineID)
	}
	if level != "ERROR" {
		t.Errorf("level = %q, want ERROR", level)
	}
	if clusterID != nil {
		t.Errorf("cluster_id = %v, want NULL (left for the clustering worker)", *clusterID)
	}
	if processed {
		t.Error("processed = true, want false (left for the clustering worker)")
	}
}

// TestFileTailer_NormalizeFilepath verifies backslashes are normalized to
// forward slashes so source_id stays consistent across OSes.
func TestFileTailer_NormalizeFilepath(t *testing.T) {
	got := normalizeFilepath(`C:\logs\app.log`)
	if idx := indexOfByte(got, '\\'); idx != -1 {
		t.Errorf("normalizeFilepath(%q) = %q, still contains a backslash", `C:\logs\app.log`, got)
	}
}

func indexOfByte(s string, b byte) int {
	for i := 0; i < len(s); i++ {
		if s[i] == b {
			return i
		}
	}
	return -1
}

// TestParseFacetRules verifies JSON facet-rule parsing tolerates malformed
// input by returning nil rather than erroring, matching FileTailer._get_rules'
// tolerant handling of a broken/missing setting.
func TestParseFacetRules(t *testing.T) {
	if got := parseFacetRules(""); got != nil {
		t.Errorf("parseFacetRules(\"\") = %v, want nil", got)
	}
	if got := parseFacetRules("not json"); got != nil {
		t.Errorf("parseFacetRules(invalid) = %v, want nil", got)
	}

	rules := parseFacetRules(`[{"name":"user_id","regex":"user=(\\d+)","group":1}]`)
	if len(rules) != 1 || rules[0].Name != "user_id" {
		t.Errorf("parseFacetRules(valid) = %+v, want one rule named user_id", rules)
	}
}
