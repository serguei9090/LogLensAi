package clustering

import (
	"database/sql"
	"strconv"
	"testing"
	"time"

	"loglensai/backend-go/internal/db"
	"loglensai/backend-go/internal/drain3"
)

// openTestDB opens a fresh in-memory DuckDB with the full Phase 1 schema
// (via db.Open), matching how internal/db's own tests do it
// (schema_test.go's TestOpen_CreatesAllTables).
func openTestDB(t *testing.T) *db.DB {
	t.Helper()
	d, err := db.Open(db.MemoryDB)
	if err != nil {
		t.Fatalf("db.Open(MemoryDB): %v", err)
	}
	t.Cleanup(func() { _ = d.Close() })
	return d
}

// insertLog inserts one row directly into `logs`, returning its assigned
// id, mirroring what the ingestion pipeline would have already written by
// the time the clustering worker sees it.
func insertLog(t *testing.T, d *db.DB, workspaceID, sourceID string, lineID *int64, rawText *string) int64 {
	t.Helper()
	var id int64
	err := d.Conn.QueryRow(
		`INSERT INTO logs (workspace_id, source_id, line_id, raw_text, processed)
		 VALUES (?, ?, ?, ?, FALSE) RETURNING id`,
		workspaceID, sourceID, nullableInt64(lineID), nullableStrPtr(rawText),
	).Scan(&id)
	if err != nil {
		t.Fatalf("inserting log row: %v", err)
	}
	return id
}

func nullableInt64(v *int64) any {
	if v == nil {
		return nil
	}
	return *v
}

func nullableStrPtr(v *string) any {
	if v == nil {
		return nil
	}
	return *v
}

func strPtr(s string) *string { return &s }
func i64Ptr(v int64) *int64   { return &v }

// singleMinerProvider returns the same Miner for every workspace.
func singleMinerProvider(m *drain3.Miner) MinerProvider {
	return func(string) (*drain3.Miner, error) { return m, nil }
}

// timestampingMetadataExtractor wraps DefaultMetadataExtractor but also
// stamps every row with a fixed timestamp, exercising the
// hourly_cluster_counts aggregation path (which, correctly, only fires
// when a row ends up with a non-null timestamp — see the WHERE clause in
// db.applyLogUpdatesTx's hourly_cluster_counts INSERT). The real,
// not-yet-built metadata_extractor.py port would supply this from the raw
// log text itself; DefaultMetadataExtractor deliberately doesn't guess.
type timestampingMetadataExtractor struct{ ts string }

func (t timestampingMetadataExtractor) Extract(ws, src, rawText string, existingFacets map[string]string) (ExtractedMetadata, error) {
	meta, err := (DefaultMetadataExtractor{}).Extract(ws, src, rawText, existingFacets)
	meta.Timestamp = t.ts
	return meta, err
}

// fakeHydrator serves raw text out of an in-memory map keyed by
// (sourceID, lineID), implementing LineHydrator for tests.
type fakeHydrator struct {
	lines map[string]map[int64]string
}

func newFakeHydrator() *fakeHydrator {
	return &fakeHydrator{lines: map[string]map[int64]string{}}
}

func (f *fakeHydrator) add(sourceID string, lineID int64, text string) {
	if f.lines[sourceID] == nil {
		f.lines[sourceID] = map[int64]string{}
	}
	f.lines[sourceID][lineID] = text
}

func (f *fakeHydrator) GetLines(sourceID string, lineIDs []int64) (map[int64]string, error) {
	out := map[int64]string{}
	for _, id := range lineIDs {
		if text, ok := f.lines[sourceID][id]; ok {
			out[id] = text
		}
	}
	return out, nil
}

// TestProcessBatch_TrainsTagsAndPersists inserts a handful of similar and
// dissimilar log lines with raw_text already populated (the common case),
// runs one processBatch cycle directly, and asserts: every row is marked
// processed with a cluster_id, similar rows share a cluster_id, the
// `clusters` table reflects per-cluster counts, and `hourly_cluster_counts`
// got populated.
func TestProcessBatch_TrainsTagsAndPersists(t *testing.T) {
	d := openTestDB(t)
	miner, err := drain3.NewMiner(drain3.DefaultConfig())
	if err != nil {
		t.Fatalf("NewMiner: %v", err)
	}

	const ws, src = "ws1", "src1"
	lines := []string{
		"User 1 logged in from 10.0.0.1",
		"User 2 logged in from 10.0.0.2",
		"User 3 logged in from 10.0.0.3",
		"Disk usage critical on volume data",
	}
	var ids []int64
	for _, l := range lines {
		ids = append(ids, insertLog(t, d, ws, src, nil, strPtr(l)))
	}

	w := NewWorker(d, nil, timestampingMetadataExtractor{ts: "2026-08-14T10:00:00"}, singleMinerProvider(miner), 500, time.Second, 1)

	processed, err := w.processBatch(500)
	if err != nil {
		t.Fatalf("processBatch: %v", err)
	}
	if processed != len(lines) {
		t.Fatalf("processBatch returned %d, want %d", processed, len(lines))
	}

	// Every row should now be processed with a non-null cluster_id.
	clusterIDs := map[int64]string{}
	for _, id := range ids {
		var processedFlag bool
		var clusterID sql.NullString
		if err := d.Conn.QueryRow(`SELECT processed, cluster_id FROM logs WHERE id = ?`, id).
			Scan(&processedFlag, &clusterID); err != nil {
			t.Fatalf("querying log %d: %v", id, err)
		}
		if !processedFlag {
			t.Errorf("log %d not marked processed", id)
		}
		if !clusterID.Valid || clusterID.String == "" {
			t.Errorf("log %d has no cluster_id", id)
		}
		clusterIDs[id] = clusterID.String
	}

	if clusterIDs[ids[0]] != clusterIDs[ids[1]] || clusterIDs[ids[1]] != clusterIDs[ids[2]] {
		t.Errorf("expected the three similar login lines to share a cluster: %v", clusterIDs)
	}
	if clusterIDs[ids[3]] == clusterIDs[ids[0]] {
		t.Errorf("expected the disk-usage line to be in a different cluster")
	}

	// clusters table should have 2 rows (one per distinct cluster) with
	// counts summing to 4.
	var clusterRowCount, totalCount int
	if err := d.Conn.QueryRow(`SELECT COUNT(*), COALESCE(SUM(count), 0) FROM clusters WHERE workspace_id = ?`, ws).
		Scan(&clusterRowCount, &totalCount); err != nil {
		t.Fatalf("querying clusters: %v", err)
	}
	if clusterRowCount != 2 {
		t.Errorf("clusters row count = %d, want 2", clusterRowCount)
	}
	if totalCount != 4 {
		t.Errorf("clusters total count = %d, want 4", totalCount)
	}

	var hourlyCount int
	if err := d.Conn.QueryRow(`SELECT COUNT(*) FROM hourly_cluster_counts WHERE workspace_id = ?`, ws).Scan(&hourlyCount); err != nil {
		t.Fatalf("querying hourly_cluster_counts: %v", err)
	}
	if hourlyCount == 0 {
		t.Errorf("expected hourly_cluster_counts to be populated")
	}
}

// TestProcessBatch_TrainThenTagSplit inserts more rows than
// TrainSampleSize, so the batch exercises both the sequential Train phase
// and the parallel Match-based Tag phase, and asserts all rows converge on
// the same cluster (they're all near-identical) regardless of which phase
// processed them.
func TestProcessBatch_TrainThenTagSplit(t *testing.T) {
	d := openTestDB(t)
	miner, err := drain3.NewMiner(drain3.DefaultConfig())
	if err != nil {
		t.Fatalf("NewMiner: %v", err)
	}

	const ws, src = "ws1", "src1"
	total := TrainSampleSize + 50
	var ids []int64
	for i := 0; i < total; i++ {
		line := "Heartbeat received from node " + strconv.Itoa(i)
		ids = append(ids, insertLog(t, d, ws, src, nil, strPtr(line)))
	}

	w := NewWorker(d, nil, nil, singleMinerProvider(miner), 10000, time.Second, 4)

	processed, err := w.processBatch(10000)
	if err != nil {
		t.Fatalf("processBatch: %v", err)
	}
	if processed != total {
		t.Fatalf("processBatch returned %d, want %d", processed, total)
	}

	var distinctClusters int
	if err := d.Conn.QueryRow(`SELECT COUNT(DISTINCT cluster_id) FROM logs WHERE workspace_id = ?`, ws).Scan(&distinctClusters); err != nil {
		t.Fatalf("querying distinct clusters: %v", err)
	}
	if distinctClusters != 1 {
		t.Errorf("expected all near-identical heartbeat lines to converge on 1 cluster, got %d", distinctClusters)
	}

	var unprocessed int
	if err := d.Conn.QueryRow(`SELECT COUNT(*) FROM logs WHERE workspace_id = ? AND processed = FALSE`, ws).Scan(&unprocessed); err != nil {
		t.Fatalf("querying unprocessed count: %v", err)
	}
	if unprocessed != 0 {
		t.Errorf("expected 0 unprocessed rows after the batch, got %d", unprocessed)
	}
}

// TestProcessBatch_HydratesMissingRawText inserts a log row with no
// raw_text but a line_id, backed by a fakeHydrator, and a second row with
// no raw_text and no hydration available, asserting the first gets
// clustered normally and the second is marked MISSING rather than blocking
// the batch.
func TestProcessBatch_HydratesMissingRawText(t *testing.T) {
	d := openTestDB(t)
	miner, err := drain3.NewMiner(drain3.DefaultConfig())
	if err != nil {
		t.Fatalf("NewMiner: %v", err)
	}

	const ws, src = "ws1", "src1"
	hydrator := newFakeHydrator()
	hydrator.add(src, 1, "Scheduled job completed in 12ms")

	hydratedID := insertLog(t, d, ws, src, i64Ptr(1), nil)
	missingID := insertLog(t, d, ws, src, i64Ptr(2), nil) // line 2 never registered with the hydrator

	w := NewWorker(d, hydrator, nil, singleMinerProvider(miner), 500, time.Second, 1)

	processed, err := w.processBatch(500)
	if err != nil {
		t.Fatalf("processBatch: %v", err)
	}
	if processed != 2 {
		t.Fatalf("processBatch returned %d, want 2", processed)
	}

	var level sql.NullString
	var clusterID sql.NullString
	var processedFlag bool

	if err := d.Conn.QueryRow(`SELECT level, cluster_id, processed FROM logs WHERE id = ?`, hydratedID).
		Scan(&level, &clusterID, &processedFlag); err != nil {
		t.Fatalf("querying hydrated row: %v", err)
	}
	if !processedFlag || !clusterID.Valid {
		t.Errorf("expected hydrated row to be processed with a cluster_id, got processed=%v cluster_id=%v", processedFlag, clusterID)
	}

	if err := d.Conn.QueryRow(`SELECT level, cluster_id, processed FROM logs WHERE id = ?`, missingID).
		Scan(&level, &clusterID, &processedFlag); err != nil {
		t.Fatalf("querying missing row: %v", err)
	}
	if !processedFlag {
		t.Errorf("expected the unhydratable row to still be marked processed (MISSING), not left in the backlog")
	}
	if level.String != "MISSING" {
		t.Errorf("level = %q, want MISSING", level.String)
	}
	if clusterID.Valid {
		t.Errorf("expected no cluster_id for a MISSING row, got %q", clusterID.String)
	}
}

// TestWorker_ModeAndPauseControls exercises the control surface
// (SetMode/SetPaused/TriggerCycle/GetStatus) without running the
// background loop, mirroring how an RPC handler would drive it.
func TestWorker_ModeAndPauseControls(t *testing.T) {
	d := openTestDB(t)
	miner, err := drain3.NewMiner(drain3.DefaultConfig())
	if err != nil {
		t.Fatalf("NewMiner: %v", err)
	}
	w := NewWorker(d, nil, nil, singleMinerProvider(miner), 500, time.Second, 1)

	status, err := w.GetStatus()
	if err != nil {
		t.Fatalf("GetStatus: %v", err)
	}
	if status.Mode != ModeAuto || status.Paused || status.Running {
		t.Fatalf("initial status = %+v, want mode=auto, paused=false, running=false", status)
	}

	if err := w.SetMode(ModeBurst); err != nil {
		t.Fatalf("SetMode(burst): %v", err)
	}
	status, _ = w.GetStatus()
	if status.Mode != ModeBurst {
		t.Fatalf("Mode = %q, want burst", status.Mode)
	}

	w.SetPaused(true)
	status, _ = w.GetStatus()
	if !status.Paused {
		t.Fatalf("expected Paused=true after SetPaused(true)")
	}

	if err := w.SetMode("bogus"); err == nil {
		t.Fatalf("expected SetMode to reject an invalid mode")
	}

	if err := w.SetMode("manual"); err != nil {
		t.Fatalf("SetMode(manual): %v", err)
	}
	status, _ = w.GetStatus()
	if status.Mode != ModeAuto || !status.Paused {
		t.Fatalf("SetMode(manual) status = %+v, want mode=auto paused=true", status)
	}
}

// TestWorker_StartStopProcessesBacklog runs the real background loop
// (Start/Stop) against a small backlog and asserts it gets fully drained,
// exercising the goroutine lifecycle end-to-end rather than calling
// processBatch directly.
func TestWorker_StartStopProcessesBacklog(t *testing.T) {
	d := openTestDB(t)
	miner, err := drain3.NewMiner(drain3.DefaultConfig())
	if err != nil {
		t.Fatalf("NewMiner: %v", err)
	}

	const ws, src = "ws1", "src1"
	for i := 0; i < 10; i++ {
		insertLog(t, d, ws, src, nil, strPtr("Ping from monitor "+strconv.Itoa(i)))
	}

	w := NewWorker(d, nil, nil, singleMinerProvider(miner), 500, 50*time.Millisecond, 2)
	w.Start()

	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		status, err := w.GetStatus()
		if err != nil {
			t.Fatalf("GetStatus: %v", err)
		}
		if status.Backlog == 0 {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}

	w.Stop()

	status, err := w.GetStatus()
	if err != nil {
		t.Fatalf("GetStatus after stop: %v", err)
	}
	if status.Backlog != 0 {
		t.Fatalf("backlog = %d after Start/Stop cycle, want 0", status.Backlog)
	}
	if status.Running {
		t.Fatalf("expected Running=false after Stop()")
	}
	if status.ProcessedSession != 10 {
		t.Fatalf("ProcessedSession = %d, want 10", status.ProcessedSession)
	}
}
