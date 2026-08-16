package app

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"golang.org/x/crypto/ssh"

	"loglensai/backend-go/internal/models"
)

// newLogOpsTestApp constructs a real *App backed by a temp-file DuckDB
// database (not db.MemoryDB) so a.dataDir resolves to an isolated per-test
// temp directory rather than app.go's relative "data" fallback (which would
// otherwise create stray files relative to the test binary's working
// directory) -- required for LogTrace (writes under a sibling "logs/" dir)
// and GetSampleLines (needs real .log/.index files under "storage/").
func newLogOpsTestApp(t *testing.T) *App {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "test.duckdb")
	a, err := NewApp(dbPath)
	if err != nil {
		t.Fatalf("NewApp: %v", err)
	}
	t.Cleanup(func() { _ = a.Close() })
	return a
}

func logopsAsMap(t *testing.T, res any, rpcErr *models.RPCError) map[string]any {
	t.Helper()
	if rpcErr != nil {
		t.Fatalf("unexpected RPC error: %+v", rpcErr)
	}
	m, ok := res.(map[string]any)
	if !ok {
		t.Fatalf("result is %T, want map[string]any: %+v", res, res)
	}
	return m
}

// seedLogRow inserts one row directly into `logs`, returning its assigned
// id. processed=TRUE keeps the async clustering.Worker from touching these
// rows mid-test.
func seedLogRow(t *testing.T, a *App, ws, src, level, ts, raw string, clusterID *string, facetsJSON string) int64 {
	t.Helper()
	var facetsArg any
	if facetsJSON != "" {
		facetsArg = facetsJSON
	}
	var id int64
	err := a.DB.Conn.QueryRow(`
		INSERT INTO logs (workspace_id, source_id, line_id, raw_text, timestamp, ingest_timestamp, level, cluster_id, has_comment, comment, facets, processed)
		VALUES (?, ?, 0, ?, ?, ?, ?, ?, FALSE, NULL, CAST(? AS JSON), TRUE)
		RETURNING id
	`, ws, src, raw, ts, ts, level, clusterID, facetsArg).Scan(&id)
	if err != nil {
		t.Fatalf("seedLogRow: %v", err)
	}
	return id
}

func seedCluster(t *testing.T, a *App, ws, clusterID, template string, count int) {
	t.Helper()
	if _, err := a.DB.Conn.Exec(`INSERT INTO clusters (workspace_id, cluster_id, template, count) VALUES (?, ?, ?, ?)`,
		ws, clusterID, template, count); err != nil {
		t.Fatalf("seedCluster: %v", err)
	}
}

// --- delete_logs ---

func TestDeleteLogs_SourceScoped_RebuildsClusterCacheFromSurvivors(t *testing.T) {
	a := newLogOpsTestApp(t)
	ws := "ws1"
	cA, cB := "cA1", "cB1"

	seedLogRow(t, a, ws, "srcA", "INFO", "2024-01-01 00:00:00", "line a", &cA, "")
	seedLogRow(t, a, ws, "srcB", "INFO", "2024-01-01 00:00:01", "line b", &cB, "")
	seedCluster(t, a, ws, cA, "real template A", 1)
	seedCluster(t, a, ws, cB, "real template B", 1)

	res, rpcErr := a.DeleteLogs(models.DeleteLogsRequest{WorkspaceID: ws, SourceID: strPtr("srcA")})
	m := logopsAsMap(t, res, rpcErr)
	if m["status"] != "success" {
		t.Fatalf("status = %v", m["status"])
	}

	var count int
	if err := a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM logs WHERE workspace_id = ? AND source_id = 'srcA'`, ws).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Errorf("srcA logs remaining = %d, want 0", count)
	}
	if err := a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM logs WHERE workspace_id = ? AND source_id = 'srcB'`, ws).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Errorf("srcB logs remaining = %d, want 1", count)
	}

	// Cluster cache must be rebuilt from surviving rows only, with the
	// placeholder "Pattern <id>" template -- matching db.py's delete_logs
	// exactly (a real, pre-existing loss of the original template text).
	rows, err := a.DB.Conn.Query(`SELECT cluster_id, template FROM clusters WHERE workspace_id = ?`, ws)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	seen := map[string]string{}
	for rows.Next() {
		var cid, tmpl string
		if err := rows.Scan(&cid, &tmpl); err != nil {
			t.Fatal(err)
		}
		seen[cid] = tmpl
	}
	if len(seen) != 1 {
		t.Fatalf("clusters after delete = %v, want exactly {%q: ...}", seen, cB)
	}
	if seen[cB] != "Pattern "+cB {
		t.Errorf("cluster %s template = %q, want %q", cB, seen[cB], "Pattern "+cB)
	}
}

func TestDeleteLogs_WorkspaceScoped_WipesEverything(t *testing.T) {
	a := newLogOpsTestApp(t)
	ws := "ws2"
	c := "c1"
	seedLogRow(t, a, ws, "src", "INFO", "2024-01-01 00:00:00", "line", &c, "")
	seedCluster(t, a, ws, c, "template", 1)

	res, rpcErr := a.DeleteLogs(models.DeleteLogsRequest{WorkspaceID: ws})
	m := logopsAsMap(t, res, rpcErr)
	if m["status"] != "success" {
		t.Fatalf("status = %v", m["status"])
	}

	var logCount, clusterCount int
	_ = a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM logs WHERE workspace_id = ?`, ws).Scan(&logCount)
	_ = a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM clusters WHERE workspace_id = ?`, ws).Scan(&clusterCount)
	if logCount != 0 || clusterCount != 0 {
		t.Errorf("logCount=%d clusterCount=%d, want 0/0", logCount, clusterCount)
	}
}

// --- export_logs ---

func TestExportLogs_CSV(t *testing.T) {
	a := newLogOpsTestApp(t)
	ws := "export-ws"
	c := "c1"
	seedLogRow(t, a, ws, "src1", "INFO", "2024-01-01 00:00:00", "hello world", &c, `{"ip":"1.2.3.4"}`)
	seedCluster(t, a, ws, c, "hello *", 1)

	out := filepath.Join(t.TempDir(), "export.csv")
	res, rpcErr := a.ExportLogs(models.ExportLogsRequest{WorkspaceID: ws, Filepath: out, Format: "csv"})
	m := logopsAsMap(t, res, rpcErr)
	if m["status"] != "ok" {
		t.Fatalf("status = %v", m["status"])
	}
	if m["count"] != 1 {
		t.Fatalf("count = %v, want 1", m["count"])
	}

	f, err := os.Open(out)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	r := csv.NewReader(f)
	records, err := r.ReadAll()
	if err != nil {
		t.Fatalf("reading csv: %v", err)
	}
	if len(records) != 2 {
		t.Fatalf("csv records = %d, want 2 (header + 1 row)", len(records))
	}
	header := records[0]
	for _, forbidden := range header {
		if strings.HasPrefix(forbidden, "_") {
			t.Errorf("header contains internal column %q", forbidden)
		}
	}
	idxOf := func(col string) int {
		for i, h := range header {
			if h == col {
				return i
			}
		}
		t.Fatalf("column %q missing from header %v", col, header)
		return -1
	}
	row := records[1]
	if row[idxOf("raw_text")] != "hello world" {
		t.Errorf("raw_text = %q", row[idxOf("raw_text")])
	}
	if row[idxOf("level")] != "INFO" {
		t.Errorf("level = %q", row[idxOf("level")])
	}
	if row[idxOf("has_comment")] != "False" {
		t.Errorf("has_comment = %q, want Python-style %q", row[idxOf("has_comment")], "False")
	}
}

func TestExportLogs_CSV_Empty(t *testing.T) {
	a := newLogOpsTestApp(t)
	out := filepath.Join(t.TempDir(), "empty.csv")
	res, rpcErr := a.ExportLogs(models.ExportLogsRequest{WorkspaceID: "no-such-ws", Filepath: out, Format: "csv"})
	m := logopsAsMap(t, res, rpcErr)
	if m["count"] != 0 {
		t.Fatalf("count = %v, want 0", m["count"])
	}
	b, err := os.ReadFile(out)
	if err != nil {
		t.Fatal(err)
	}
	if len(b) != 0 {
		t.Errorf("empty export file has %d bytes, want 0", len(b))
	}
}

func TestExportLogs_JSON(t *testing.T) {
	a := newLogOpsTestApp(t)
	ws := "export-json-ws"
	seedLogRow(t, a, ws, "src1", "ERROR", "2024-01-01 00:00:00", "boom", nil, "")

	out := filepath.Join(t.TempDir(), "export.json")
	res, rpcErr := a.ExportLogs(models.ExportLogsRequest{WorkspaceID: ws, Filepath: out, Format: "json"})
	m := logopsAsMap(t, res, rpcErr)
	if m["count"] != 1 {
		t.Fatalf("count = %v", m["count"])
	}

	b, err := os.ReadFile(out)
	if err != nil {
		t.Fatal(err)
	}
	var decoded []map[string]any
	if err := json.Unmarshal(b, &decoded); err != nil {
		t.Fatalf("invalid JSON export: %v", err)
	}
	if len(decoded) != 1 {
		t.Fatalf("decoded len = %d, want 1", len(decoded))
	}
	if decoded[0]["raw_text"] != "boom" {
		t.Errorf("raw_text = %v", decoded[0]["raw_text"])
	}
}

// --- get_sample_lines / update_source_parser ---

func TestGetSampleLines_UsesFastPathAfterIngest(t *testing.T) {
	a := newLogOpsTestApp(t)
	ws, src := "sample-ws", "sample-src"

	ingestRes, rpcErr := a.IngestLogs(models.IngestLogsRequest{Logs: []models.IngestLogEntry{
		{WorkspaceID: ws, SourceID: src, RawText: "first line", Level: "INFO"},
		{WorkspaceID: ws, SourceID: src, RawText: "second line", Level: "INFO"},
	}})
	_ = logopsAsMap(t, ingestRes, rpcErr)

	res, rpcErr := a.GetSampleLines(models.GetSampleLinesRequest{WorkspaceID: ws, SourceID: src, Limit: 10})
	if rpcErr != nil {
		t.Fatalf("GetSampleLines error: %+v", rpcErr)
	}
	lines, ok := res.([]string)
	if !ok {
		t.Fatalf("result type = %T, want []string", res)
	}
	if len(lines) != 2 || lines[0] != "first line" || lines[1] != "second line" {
		t.Fatalf("lines = %v", lines)
	}
}

func TestUpdateSourceParser(t *testing.T) {
	a := newLogOpsTestApp(t)
	ws, src := "parser-ws", "parser-src"

	updRes, rpcErr := a.UpdateFusionConfig(models.UpdateFusionConfigRequest{
		WorkspaceID: ws,
		FusionID:    "default",
		Sources:     []models.FusionSourceConfig{{SourceID: src, Enabled: true}},
	})
	_ = logopsAsMap(t, updRes, rpcErr)

	res, rpcErr := a.UpdateSourceParser(models.UpdateSourceParserRequest{WorkspaceID: ws, SourceID: src, ParserConfig: `{"regex":"foo"}`})
	m := logopsAsMap(t, res, rpcErr)
	if m["status"] != "ok" {
		t.Fatalf("status = %v", m["status"])
	}

	var stored string
	if err := a.DB.Conn.QueryRow(`SELECT parser_config FROM fusion_configs WHERE workspace_id = ? AND source_id = ?`, ws, src).Scan(&stored); err != nil {
		t.Fatal(err)
	}
	if stored != `{"regex":"foo"}` {
		t.Errorf("parser_config = %q", stored)
	}
}

// --- fusion config + fused logs ---

func TestFusionConfigRoundTrip(t *testing.T) {
	a := newLogOpsTestApp(t)
	ws := "fusion-ws"

	res, rpcErr := a.UpdateFusionConfig(models.UpdateFusionConfigRequest{
		WorkspaceID: ws,
		FusionID:    "default",
		Sources: []models.FusionSourceConfig{
			{SourceID: "s1", Enabled: true, TzOffset: 2, CustomFormat: strPtr("custom")},
			{SourceID: "s2", Enabled: false, TzOffset: -1},
		},
	})
	_ = logopsAsMap(t, res, rpcErr)

	getRes, rpcErr := a.GetFusionConfig(models.GetFusionConfigRequest{WorkspaceID: ws, FusionID: "default"})
	m := logopsAsMap(t, getRes, rpcErr)
	sources, ok := m["sources"].([]map[string]any)
	if !ok || len(sources) != 2 {
		t.Fatalf("sources = %+v", m["sources"])
	}
	bySource := map[string]map[string]any{}
	for _, s := range sources {
		bySource[s["source_id"].(string)] = s
	}
	if bySource["s1"]["enabled"] != true || bySource["s1"]["tz_offset"] != int64(2) {
		t.Errorf("s1 = %+v", bySource["s1"])
	}
	if bySource["s1"]["custom_format"] != "custom" {
		t.Errorf("s1.custom_format = %v", bySource["s1"]["custom_format"])
	}
	if bySource["s2"]["enabled"] != false || bySource["s2"]["tz_offset"] != int64(-1) {
		t.Errorf("s2 = %+v", bySource["s2"])
	}
}

func TestGetFusedLogs_TimezoneNormalizationAndSourceRestriction(t *testing.T) {
	a := newLogOpsTestApp(t)
	ws := "fused-ws"

	res, rpcErr := a.UpdateFusionConfig(models.UpdateFusionConfigRequest{
		WorkspaceID: ws,
		FusionID:    "default",
		Sources: []models.FusionSourceConfig{
			{SourceID: "enabled-src", Enabled: true, TzOffset: 3},
			{SourceID: "disabled-src", Enabled: false, TzOffset: 5},
		},
	})
	_ = logopsAsMap(t, res, rpcErr)

	seedLogRow(t, a, ws, "enabled-src", "INFO", "2024-01-01 10:00:00", "from enabled", nil, "")
	seedLogRow(t, a, ws, "disabled-src", "INFO", "2024-01-01 10:00:00", "from disabled", nil, "")

	fusedRes, rpcErr := a.GetFusedLogs(models.GetFusedLogsRequest{WorkspaceID: ws, FusionID: "default", Limit: 100, SortBy: "id", SortOrder: "ASC"})
	m := logopsAsMap(t, fusedRes, rpcErr)
	logs, ok := m["logs"].([]map[string]any)
	if !ok {
		t.Fatalf("logs = %+v (%T)", m["logs"], m["logs"])
	}
	if len(logs) != 1 {
		t.Fatalf("fused logs count = %d, want 1 (disabled-src must be excluded)", len(logs))
	}
	if logs[0]["source_id"] != "enabled-src" {
		t.Errorf("source_id = %v", logs[0]["source_id"])
	}
	// tz_offset=3 hours: 10:00:00 -> 13:00:00.
	if logs[0]["timestamp"] != "2024-01-01 13:00:00" {
		t.Errorf("timestamp = %v, want 2024-01-01 13:00:00", logs[0]["timestamp"])
	}
}

func TestGetFusedLogs_NoEnabledSourcesReturnsEmpty(t *testing.T) {
	a := newLogOpsTestApp(t)
	ws := "fused-empty-ws"
	seedLogRow(t, a, ws, "some-src", "INFO", "2024-01-01 00:00:00", "x", nil, "")

	// No fusion_configs rows at all for this workspace/fusion_id.
	res, rpcErr := a.GetFusedLogs(models.GetFusedLogsRequest{WorkspaceID: ws, FusionID: "default", Limit: 100})
	m := logopsAsMap(t, res, rpcErr)
	if m["total"] != 0 {
		t.Errorf("total = %v, want 0", m["total"])
	}
}

// --- get_sample_logs ---

func TestGetSampleLogs(t *testing.T) {
	a := newLogOpsTestApp(t)
	ws := "samplelogs-ws"
	for i := 0; i < 5; i++ {
		seedLogRow(t, a, ws, "src", "INFO", "2024-01-01 00:00:00", fmt.Sprintf("raw %d", i), nil, "")
	}

	res, rpcErr := a.GetSampleLogs(models.GetSampleLogsRequest{WorkspaceID: ws, Limit: 3})
	m := logopsAsMap(t, res, rpcErr)
	samples, ok := m["samples"].([]string)
	if !ok {
		t.Fatalf("samples = %+v (%T)", m["samples"], m["samples"])
	}
	if len(samples) != 3 {
		t.Fatalf("samples len = %d, want 3", len(samples))
	}
	for _, s := range samples {
		if !strings.HasPrefix(s, "raw ") {
			t.Errorf("unexpected sample %q", s)
		}
	}
}

// --- update_log_comment ---

func TestUpdateLogComment_SetAndClear(t *testing.T) {
	a := newLogOpsTestApp(t)
	id := seedLogRow(t, a, "comment-ws", "src", "INFO", "2024-01-01 00:00:00", "line", nil, "")

	res, rpcErr := a.UpdateLogComment(models.UpdateCommentRequest{LogID: int(id), Comment: "investigate this"})
	_ = logopsAsMap(t, res, rpcErr)

	var comment string
	var hasComment bool
	if err := a.DB.Conn.QueryRow(`SELECT comment, has_comment FROM logs WHERE id = ?`, id).Scan(&comment, &hasComment); err != nil {
		t.Fatal(err)
	}
	if comment != "investigate this" || !hasComment {
		t.Errorf("comment=%q hasComment=%v", comment, hasComment)
	}

	res, rpcErr = a.UpdateLogComment(models.UpdateCommentRequest{LogID: int(id), Comment: ""})
	_ = logopsAsMap(t, res, rpcErr)
	if err := a.DB.Conn.QueryRow(`SELECT comment, has_comment FROM logs WHERE id = ?`, id).Scan(&comment, &hasComment); err != nil {
		t.Fatal(err)
	}
	if hasComment {
		t.Errorf("has_comment still true after clearing")
	}
}

// --- read_file ---

func TestReadFile(t *testing.T) {
	a := newLogOpsTestApp(t)
	path := filepath.Join(t.TempDir(), "sample.txt")
	content := "line one\nline two with unicode: café\n"
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	res, rpcErr := a.ReadFile(models.ReadFileRequest{Filepath: path})
	if rpcErr != nil {
		t.Fatalf("unexpected error: %+v", rpcErr)
	}
	if res != content {
		t.Errorf("content = %q, want %q", res, content)
	}
}

func TestReadFile_NotFound(t *testing.T) {
	a := newLogOpsTestApp(t)
	_, rpcErr := a.ReadFile(models.ReadFileRequest{Filepath: filepath.Join(t.TempDir(), "does-not-exist.txt")})
	if rpcErr == nil {
		t.Fatal("expected an error for a missing file")
	}
}

// --- ingestion jobs ---

func TestGetIngestionJobs_QueuePositionAndCleanup(t *testing.T) {
	a := newLogOpsTestApp(t)
	ws := "jobs-ws"

	insertJob := func(status string, processed int, createdAt time.Time) int64 {
		var id int64
		err := a.DB.Conn.QueryRow(`
			INSERT INTO ingestion_jobs (workspace_id, source_id, status, total_lines, processed_lines, created_at, updated_at)
			VALUES (?, 'src', ?, 100, ?, ?, ?) RETURNING id
		`, ws, status, processed, createdAt, createdAt).Scan(&id)
		if err != nil {
			t.Fatalf("insertJob: %v", err)
		}
		return id
	}

	// All timestamps are recent (relative to time.Now()), not a fixed past
	// date: cleanup_ingestion_jobs purges zero-progress rows older than 30
	// minutes OR explicitly 'failed' -- using a fixed historical date here
	// would make every zero-progress row "old" regardless of status,
	// defeating the point of distinguishing the two purge criteria.
	base := time.Now().Add(-5 * time.Minute)
	oldestQueued := insertJob("queued", 0, base)
	middleProcessing := insertJob("processing", 10, base.Add(time.Second))
	newestQueued := insertJob("queued", 0, base.Add(2*time.Second))
	insertJob("completed", 100, base.Add(3*time.Second))
	staleFailed := insertJob("failed", 0, base.Add(4*time.Second))
	_ = staleFailed

	res, rpcErr := a.GetIngestionJobs(models.GetIngestionJobsRequest{WorkspaceID: strPtr(ws)})
	if rpcErr != nil {
		t.Fatalf("unexpected error: %+v", rpcErr)
	}
	jobs, ok := res.([]map[string]any)
	if !ok {
		t.Fatalf("result type = %T", res)
	}
	if len(jobs) != 5 {
		t.Fatalf("jobs len = %d, want 5", len(jobs))
	}

	posByID := map[int64]int{}
	for _, j := range jobs {
		id := j["id"].(int64)
		posByID[id] = j["queue_position"].(int)
	}
	if posByID[oldestQueued] != 1 {
		t.Errorf("oldestQueued queue_position = %d, want 1", posByID[oldestQueued])
	}
	if posByID[middleProcessing] != 2 {
		t.Errorf("middleProcessing queue_position = %d, want 2", posByID[middleProcessing])
	}
	if posByID[newestQueued] != 3 {
		t.Errorf("newestQueued queue_position = %d, want 3", posByID[newestQueued])
	}

	// cleanup_ingestion_jobs purges zero-progress jobs that are either
	// 'failed' or older than 30 minutes -- staleFailed qualifies (status
	// failed, processed_lines=0); the still-queued zero-progress job
	// (oldestQueued) is recent, so it must survive.
	cleanupRes, rpcErr := a.CleanupIngestionJobs(models.CleanupIngestionJobsRequest{WorkspaceID: ws})
	m := logopsAsMap(t, cleanupRes, rpcErr)
	if m["purged_count"] != int64(1) {
		t.Fatalf("purged_count = %v, want 1", m["purged_count"])
	}
	var remaining int
	_ = a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM ingestion_jobs WHERE id = ?`, staleFailed).Scan(&remaining)
	if remaining != 0 {
		t.Errorf("staleFailed job still present after cleanup")
	}
	_ = a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM ingestion_jobs WHERE id = ?`, oldestQueued).Scan(&remaining)
	if remaining != 1 {
		t.Errorf("oldestQueued job was incorrectly purged")
	}
}

// --- get_log_distribution ---

func TestGetLogDistribution_ZeroFillsAndPicksSecondBuckets(t *testing.T) {
	a := newLogOpsTestApp(t)
	ws := "dist-ws"

	seedLogRow(t, a, ws, "src", "INFO", "2024-01-01 00:00:00", "l0", nil, "")
	seedLogRow(t, a, ws, "src", "ERROR", "2024-01-01 00:00:00", "l0e", nil, "")
	seedLogRow(t, a, ws, "src", "INFO", "2024-01-01 00:00:03", "l3", nil, "")
	// 00:00:01 and 00:00:02 deliberately left empty to exercise zero-fill.

	req := models.GetLogDistributionRequest{
		WorkspaceID: ws,
		StartTime:   strPtr("2024-01-01 00:00:00"),
		EndTime:     strPtr("2024-01-01 00:00:03"),
	}
	res, rpcErr := a.GetLogDistribution(req)
	m := logopsAsMap(t, res, rpcErr)
	if m["bucket_interval"] != "1 second" {
		t.Fatalf("bucket_interval = %v, want %q (duration=3s <= 10s threshold)", m["bucket_interval"], "1 second")
	}
	buckets, ok := m["buckets"].([]map[string]any)
	if !ok {
		t.Fatalf("buckets type = %T", m["buckets"])
	}
	if len(buckets) != 4 {
		t.Fatalf("buckets len = %d, want 4 (00:00:00..00:00:03 inclusive)", len(buckets))
	}
	if buckets[0]["bucket"] != "2024-01-01 00:00:00" {
		t.Errorf("first bucket = %v", buckets[0]["bucket"])
	}
	if buckets[0]["INFO"] != int64(1) || buckets[0]["ERROR"] != int64(1) {
		t.Errorf("first bucket levels = %+v", buckets[0])
	}
	// Zero-filled bucket must still carry every level key at 0.
	if buckets[1]["bucket"] != "2024-01-01 00:00:01" {
		t.Errorf("second bucket = %v", buckets[1]["bucket"])
	}
	for _, lvl := range []string{"DEBUG", "INFO", "WARN", "ERROR"} {
		if buckets[1][lvl] != int64(0) {
			t.Errorf("empty bucket[%s] = %v, want 0", lvl, buckets[1][lvl])
		}
	}
	if buckets[3]["INFO"] != int64(1) {
		t.Errorf("last bucket INFO = %v", buckets[3]["INFO"])
	}
}

func TestGetLogDistribution_NoLogsReturnsEmptyBuckets(t *testing.T) {
	a := newLogOpsTestApp(t)
	res, rpcErr := a.GetLogDistribution(models.GetLogDistributionRequest{WorkspaceID: "empty-ws"})
	m := logopsAsMap(t, res, rpcErr)
	buckets, ok := m["buckets"].([]any)
	if !ok || len(buckets) != 0 {
		t.Fatalf("buckets = %+v (%T)", m["buckets"], m["buckets"])
	}
	if _, hasInterval := m["bucket_interval"]; hasInterval {
		t.Errorf("bucket_interval should be absent on the empty-result early return, got %v", m["bucket_interval"])
	}
}

// --- log_trace ---

func TestLogTrace_WritesWhenEnvEnabled(t *testing.T) {
	a := newLogOpsTestApp(t)

	t.Setenv("INGESTION_TRACE", "true")
	res, rpcErr := a.LogTrace(models.LogTraceRequest{Message: "hello from frontend"})
	m := logopsAsMap(t, res, rpcErr)
	if m["status"] != "success" {
		t.Fatalf("status = %v", m["status"])
	}

	logPath := filepath.Join(filepath.Dir(a.dataDir), "logs", "ingestion_trace.log")
	b, err := os.ReadFile(logPath)
	if err != nil {
		t.Fatalf("trace log not written: %v", err)
	}
	if !strings.Contains(string(b), "[Backend] [Frontend] hello from frontend") {
		t.Errorf("trace log content = %q", string(b))
	}
}

func TestLogTrace_NoOpWhenEnvDisabled(t *testing.T) {
	a := newLogOpsTestApp(t)
	t.Setenv("INGESTION_TRACE", "false")

	res, rpcErr := a.LogTrace(models.LogTraceRequest{Message: "should not be written"})
	m := logopsAsMap(t, res, rpcErr)
	if m["status"] != "success" {
		t.Fatalf("status = %v", m["status"])
	}
	logPath := filepath.Join(filepath.Dir(a.dataDir), "logs", "ingestion_trace.log")
	if _, err := os.Stat(logPath); err == nil {
		t.Errorf("trace log should not exist when INGESTION_TRACE is not \"true\"")
	}
}

// --- start_ssh_tail ---

// testSSHServer is a minimal in-process SSH server (mirrors
// internal/ingestion/ssh_test.go's testSSHServer) used here as an
// integration smoke test for StartSSHTail's real dial/auth/exec/read path
// plus the FileTailer subscriber that flushes observed lines into `logs`.
type testSSHServer struct {
	addr, username, password string
}

func startTestSSHServer(t *testing.T, onExec func(ch ssh.Channel, cmd string)) testSSHServer {
	t.Helper()
	const username, password = "sshuser", "sshpass"

	_, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generating host key: %v", err)
	}
	signer, err := ssh.NewSignerFromSigner(priv)
	if err != nil {
		t.Fatalf("building signer: %v", err)
	}

	config := &ssh.ServerConfig{
		PasswordCallback: func(conn ssh.ConnMetadata, pass []byte) (*ssh.Permissions, error) {
			if conn.User() == username && string(pass) == password {
				return nil, nil
			}
			return nil, fmt.Errorf("denied")
		},
	}
	config.AddHostKey(signer)

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	t.Cleanup(func() { _ = ln.Close() })

	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			go func() {
				sshConn, chans, reqs, err := ssh.NewServerConn(conn, config)
				if err != nil {
					return
				}
				defer sshConn.Close()
				go ssh.DiscardRequests(reqs)
				for newCh := range chans {
					if newCh.ChannelType() != "session" {
						_ = newCh.Reject(ssh.UnknownChannelType, "unsupported")
						continue
					}
					channel, requests, err := newCh.Accept()
					if err != nil {
						continue
					}
					go func() {
						defer channel.Close()
						for req := range requests {
							if req.Type == "exec" {
								var payload struct{ Command string }
								_ = ssh.Unmarshal(req.Payload, &payload)
								_ = req.Reply(true, nil)
								onExec(channel, payload.Command)
							} else if req.WantReply {
								_ = req.Reply(false, nil)
							}
						}
					}()
				}
			}()
		}
	}()

	return testSSHServer{addr: ln.Addr().String(), username: username, password: password}
}

func TestStartSSHTail_EndToEnd(t *testing.T) {
	var mu sync.Mutex
	var gotCmd string
	srv := startTestSSHServer(t, func(ch ssh.Channel, cmd string) {
		mu.Lock()
		gotCmd = cmd
		mu.Unlock()
		fmt.Fprint(ch, "remote line one\n")
		fmt.Fprint(ch, "remote line two\n")
		// Left open deliberately, like a real `tail -f`.
	})
	host, portStr, err := net.SplitHostPort(srv.addr)
	if err != nil {
		t.Fatal(err)
	}
	port, err := strconv.Atoi(portStr)
	if err != nil {
		t.Fatal(err)
	}

	a := newLogOpsTestApp(t)
	ws := "ssh-ws"

	res, rpcErr := a.StartSSHTail(models.StartSSHTailRequest{
		Host: host, Port: port, Username: srv.username, Password: strPtr(srv.password),
		Filepath: "/var/log/remote.log", WorkspaceID: ws,
	})
	m := logopsAsMap(t, res, rpcErr)
	if m["status"] != "started" {
		t.Fatalf("status = %v", m["status"])
	}
	sourceID, _ := m["source_id"].(string)
	wantSourceID := "ssh:" + ws + ":" + host + ":/var/log/remote.log"
	if sourceID != wantSourceID {
		t.Errorf("source_id = %q, want %q", sourceID, wantSourceID)
	}

	// Calling again with the same resolved source_id must be a no-op,
	// mirroring api.py's `if key in self.tailers: return already tailing`.
	res2, rpcErr2 := a.StartSSHTail(models.StartSSHTailRequest{
		Host: host, Port: port, Username: srv.username, Password: strPtr(srv.password),
		Filepath: "/var/log/remote.log", WorkspaceID: ws,
	})
	m2 := logopsAsMap(t, res2, rpcErr2)
	if m2["status"] != "already tailing" {
		t.Errorf("second call status = %v, want %q", m2["status"], "already tailing")
	}

	deadline := time.Now().Add(5 * time.Second)
	var rowCount int
	for time.Now().Before(deadline) {
		_ = a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM logs WHERE workspace_id = ? AND source_id = ?`, ws, sourceID).Scan(&rowCount)
		if rowCount >= 2 {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	if rowCount < 2 {
		t.Fatalf("logs rows for %s/%s = %d, want >= 2 within 5s", ws, sourceID, rowCount)
	}

	mu.Lock()
	cmd := gotCmd
	mu.Unlock()
	if cmd != "tail -n 0 -f /var/log/remote.log" {
		t.Errorf("remote command = %q", cmd)
	}
}

func strPtr(s string) *string { return &s }
