package app

import (
	"encoding/json"
	"strings"
	"testing"

	"loglensai/backend-go/internal/db"
	"loglensai/backend-go/internal/models"
)

func newAIExtraTestApp(t *testing.T) *App {
	t.Helper()
	a, err := NewApp(db.MemoryDB)
	if err != nil {
		t.Fatalf("NewApp: %v", err)
	}
	t.Cleanup(func() { _ = a.Close() })
	return a
}

func mustMap(t *testing.T, v any, rpcErr *models.RPCError) map[string]any {
	t.Helper()
	if rpcErr != nil {
		t.Fatalf("unexpected RPCError: %+v", rpcErr)
	}
	m, ok := v.(map[string]any)
	if !ok {
		t.Fatalf("unexpected result type %T: %+v", v, v)
	}
	return m
}

func mustSlice(t *testing.T, v any, rpcErr *models.RPCError) []map[string]any {
	t.Helper()
	if rpcErr != nil {
		t.Fatalf("unexpected RPCError: %+v", rpcErr)
	}
	s, ok := v.([]map[string]any)
	if !ok {
		t.Fatalf("unexpected result type %T: %+v", v, v)
	}
	return s
}

// --- AI session management ---------------------------------------------

func TestGetAISessions_ListsForWorkspaceOrderedByLastModified(t *testing.T) {
	a := newAIExtraTestApp(t)

	if _, err := a.DB.Conn.Exec(
		`INSERT INTO ai_sessions (session_id, workspace_id, name, created_at, last_modified) VALUES (?, ?, ?, '2024-01-01 00:00:00', '2024-01-01 00:00:00')`,
		"s1", "ws1", "First",
	); err != nil {
		t.Fatalf("seed s1: %v", err)
	}
	if _, err := a.DB.Conn.Exec(
		`INSERT INTO ai_sessions (session_id, workspace_id, name, created_at, last_modified) VALUES (?, ?, ?, '2024-01-02 00:00:00', '2024-01-02 00:00:00')`,
		"s2", "ws1", "Second",
	); err != nil {
		t.Fatalf("seed s2: %v", err)
	}
	if _, err := a.DB.Conn.Exec(
		`INSERT INTO ai_sessions (session_id, workspace_id, name, created_at, last_modified) VALUES (?, ?, ?, '2024-01-01 00:00:00', '2024-01-01 00:00:00')`,
		"s3", "ws2", "Other workspace",
	); err != nil {
		t.Fatalf("seed s3: %v", err)
	}

	result, rpcErr := a.GetAISessions("ws1")
	rows := mustSlice(t, result, rpcErr)
	if len(rows) != 2 {
		t.Fatalf("expected 2 sessions for ws1, got %d: %+v", len(rows), rows)
	}
	if rows[0]["session_id"] != "s2" || rows[1]["session_id"] != "s1" {
		t.Errorf("expected s2 (newer last_modified) before s1, got %+v", rows)
	}
	if rows[0]["name"] != "Second" {
		t.Errorf("name = %v, want Second", rows[0]["name"])
	}
}

func TestGetAIMessages_ReturnsOrderedRowsWithContextLogsAndA2UI(t *testing.T) {
	a := newAIExtraTestApp(t)

	if _, err := a.DB.Conn.Exec(
		`INSERT INTO ai_messages (session_id, role, content, context_logs, timestamp) VALUES (?, ?, ?, ?, '2024-01-01 00:00:00')`,
		"s1", "user", "what is going on", `[1,2,3]`,
	); err != nil {
		t.Fatalf("seed msg1: %v", err)
	}
	if _, err := a.DB.Conn.Exec(
		`INSERT INTO ai_messages (session_id, role, content, a2ui_payload, timestamp) VALUES (?, ?, ?, ?, '2024-01-01 00:00:01')`,
		"s1", "assistant", "here's a column", `{"type":"add_column","label":"IP"}`,
	); err != nil {
		t.Fatalf("seed msg2: %v", err)
	}
	if _, err := a.DB.Conn.Exec(
		`INSERT INTO ai_messages (session_id, role, content, timestamp) VALUES (?, ?, ?, '2024-01-01 00:00:00')`,
		"other-session", "user", "unrelated",
	); err != nil {
		t.Fatalf("seed msg3: %v", err)
	}

	result, rpcErr := a.GetAIMessages("s1")
	rows := mustSlice(t, result, rpcErr)
	if len(rows) != 2 {
		t.Fatalf("expected 2 messages for s1, got %d: %+v", len(rows), rows)
	}

	if rows[0]["role"] != "user" || rows[0]["content"] != "what is going on" {
		t.Errorf("unexpected row[0]: %+v", rows[0])
	}
	ctxLogs, ok := rows[0]["context_logs"].([]int)
	if !ok || len(ctxLogs) != 3 {
		t.Errorf("context_logs = %+v (%T), want [1 2 3]", rows[0]["context_logs"], rows[0]["context_logs"])
	}

	if rows[1]["role"] != "assistant" {
		t.Errorf("unexpected row[1]: %+v", rows[1])
	}
	a2ui, ok := rows[1]["a2ui_payload"].(map[string]any)
	if !ok || a2ui["type"] != "add_column" {
		t.Errorf("a2ui_payload = %+v", rows[1]["a2ui_payload"])
	}

	// A message with no context_logs must decode to [] (Python parity), not nil.
	msg2CtxLogs, ok := rows[1]["context_logs"].([]int)
	if !ok || len(msg2CtxLogs) != 0 {
		t.Errorf("expected empty (non-nil) context_logs slice for row[1], got %+v", rows[1]["context_logs"])
	}
}

func TestRenameAISession_UpdatesNameAndLastModified(t *testing.T) {
	a := newAIExtraTestApp(t)
	if _, err := a.DB.Conn.Exec(
		`INSERT INTO ai_sessions (session_id, workspace_id, name, last_modified) VALUES (?, ?, ?, '2020-01-01 00:00:00')`,
		"s1", "ws1", "Old name",
	); err != nil {
		t.Fatalf("seed: %v", err)
	}

	result, rpcErr := a.RenameAISession("s1", "New name")
	m := mustMap(t, result, rpcErr)
	if m["status"] != "ok" {
		t.Errorf("status = %v", m["status"])
	}

	var name, lastModified string
	if err := a.DB.Conn.QueryRow(`SELECT name, last_modified FROM ai_sessions WHERE session_id = ?`, "s1").Scan(&name, &lastModified); err != nil {
		t.Fatalf("query: %v", err)
	}
	if name != "New name" {
		t.Errorf("name = %q, want %q", name, "New name")
	}
	if lastModified == "2020-01-01 00:00:00" {
		t.Errorf("expected last_modified to be updated, still %q", lastModified)
	}
}

func TestDeleteAISession_RemovesSessionAndMessages(t *testing.T) {
	a := newAIExtraTestApp(t)
	if _, err := a.DB.Conn.Exec(`INSERT INTO ai_sessions (session_id, workspace_id, name) VALUES (?, ?, ?)`, "s1", "ws1", "X"); err != nil {
		t.Fatalf("seed session: %v", err)
	}
	if _, err := a.DB.Conn.Exec(`INSERT INTO ai_messages (session_id, role, content) VALUES (?, ?, ?)`, "s1", "user", "hi"); err != nil {
		t.Fatalf("seed message: %v", err)
	}
	if _, err := a.DB.Conn.Exec(`INSERT INTO ai_sessions (session_id, workspace_id, name) VALUES (?, ?, ?)`, "s2", "ws1", "Y"); err != nil {
		t.Fatalf("seed other session: %v", err)
	}

	result, rpcErr := a.DeleteAISession("s1")
	m := mustMap(t, result, rpcErr)
	if m["status"] != "ok" {
		t.Errorf("status = %v", m["status"])
	}

	var sessionCount, msgCount, otherCount int
	_ = a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM ai_sessions WHERE session_id = 's1'`).Scan(&sessionCount)
	_ = a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM ai_messages WHERE session_id = 's1'`).Scan(&msgCount)
	_ = a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM ai_sessions WHERE session_id = 's2'`).Scan(&otherCount)
	if sessionCount != 0 || msgCount != 0 {
		t.Errorf("expected s1's session+messages fully deleted, got session=%d messages=%d", sessionCount, msgCount)
	}
	if otherCount != 1 {
		t.Errorf("expected s2 untouched, got count=%d", otherCount)
	}
}

func TestGetAIMapping_BuildsLogIDToSessionIDMap(t *testing.T) {
	a := newAIExtraTestApp(t)
	if _, err := a.DB.Conn.Exec(`INSERT INTO ai_sessions (session_id, workspace_id, name) VALUES (?, ?, ?)`, "s1", "ws1", "X"); err != nil {
		t.Fatalf("seed session: %v", err)
	}
	if _, err := a.DB.Conn.Exec(`INSERT INTO ai_messages (session_id, role, content, context_logs) VALUES (?, ?, ?, ?)`, "s1", "user", "hi", `[10, 20]`); err != nil {
		t.Fatalf("seed message: %v", err)
	}
	// A session in a different workspace must not leak into the mapping.
	if _, err := a.DB.Conn.Exec(`INSERT INTO ai_sessions (session_id, workspace_id, name) VALUES (?, ?, ?)`, "s2", "ws2", "Y"); err != nil {
		t.Fatalf("seed other session: %v", err)
	}
	if _, err := a.DB.Conn.Exec(`INSERT INTO ai_messages (session_id, role, content, context_logs) VALUES (?, ?, ?, ?)`, "s2", "user", "hi", `[30]`); err != nil {
		t.Fatalf("seed other message: %v", err)
	}

	result, rpcErr := a.GetAIMapping("ws1")
	m := mustMap(t, result, rpcErr)
	if m["10"] != "s1" || m["20"] != "s1" {
		t.Errorf("mapping = %+v, want {10:s1, 20:s1}", m)
	}
	if _, ok := m["30"]; ok {
		t.Errorf("expected log 30 (workspace ws2) not to leak into ws1's mapping: %+v", m)
	}
}

// --- Anomalies -----------------------------------------------------------

func TestGetAnomalies_ReadsPersistedRowsMostRecentFirst(t *testing.T) {
	a := newAIExtraTestApp(t)
	if _, err := a.DB.Conn.Exec(
		`INSERT INTO anomalies (workspace_id, cluster_id, timestamp, z_score, current_rate, mean_rate) VALUES (?, ?, ?, ?, ?, ?)`,
		"ws1", "c1", "2024-01-01 00:00:00", 4.5, 30.0, 2.0,
	); err != nil {
		t.Fatalf("seed: %v", err)
	}
	if _, err := a.DB.Conn.Exec(
		`INSERT INTO anomalies (workspace_id, cluster_id, timestamp, z_score, current_rate, mean_rate) VALUES (?, ?, ?, ?, ?, ?)`,
		"ws1", "c2", "2024-01-02 00:00:00", 5.5, 40.0, 3.0,
	); err != nil {
		t.Fatalf("seed: %v", err)
	}
	if _, err := a.DB.Conn.Exec(
		`INSERT INTO anomalies (workspace_id, cluster_id, timestamp, z_score, current_rate, mean_rate) VALUES (?, ?, ?, ?, ?, ?)`,
		"ws-other", "c3", "2024-01-03 00:00:00", 6.5, 50.0, 4.0,
	); err != nil {
		t.Fatalf("seed: %v", err)
	}

	result, rpcErr := a.GetAnomalies(models.GetAnomaliesRequest{WorkspaceID: "ws1"})
	m := mustMap(t, result, rpcErr)
	anomalies, ok := m["anomalies"].([]map[string]any)
	if !ok {
		t.Fatalf("unexpected anomalies type %T", m["anomalies"])
	}
	if len(anomalies) != 2 {
		t.Fatalf("expected 2 anomalies for ws1, got %d: %+v", len(anomalies), anomalies)
	}
	if anomalies[0]["cluster_id"] != "c2" {
		t.Errorf("expected most recent (c2) first, got %+v", anomalies[0])
	}
}

func TestDetectAnomalies_FlagsAndPersistsHighZScoreCluster(t *testing.T) {
	a := newAIExtraTestApp(t)

	// Baseline: 5 hourly buckets of count=2 for cluster c1, all inside the
	// [day_ago_bucket, ten_mins_ago_bucket) window relative to the reference
	// time established below (2024-01-02 12:00:00).
	for _, hour := range []string{
		"2024-01-01 13", "2024-01-01 14", "2024-01-01 15", "2024-01-01 16", "2024-01-01 17",
	} {
		if _, err := a.DB.Conn.Exec(
			`INSERT INTO hourly_cluster_counts (workspace_id, cluster_id, hour_bucket, count) VALUES (?, ?, ?, ?)`,
			"ws1", "c1", hour, 2,
		); err != nil {
			t.Fatalf("seed hourly_cluster_counts: %v", err)
		}
	}

	// Reference/"now" marker (max(timestamp) for the workspace).
	if _, err := a.DB.Conn.Exec(
		`INSERT INTO logs (workspace_id, source_id, cluster_id, timestamp, level, processed) VALUES (?, ?, NULL, ?, ?, TRUE)`,
		"ws1", "src1", "2024-01-02 12:00:00", "INFO",
	); err != nil {
		t.Fatalf("seed marker log: %v", err)
	}

	// A burst of recent logs for c1 in the last 10 minutes: 5 rows -> rate
	// 5*6=30, mean=2, stddev floored to 0.1 -> z=280 (well over the 3.0
	// threshold, rate well over 5.0).
	for i := 0; i < 5; i++ {
		if _, err := a.DB.Conn.Exec(
			`INSERT INTO logs (workspace_id, source_id, cluster_id, timestamp, level, processed) VALUES (?, ?, ?, ?, ?, TRUE)`,
			"ws1", "src1", "c1", "2024-01-02 11:55:00", "ERROR",
		); err != nil {
			t.Fatalf("seed burst log %d: %v", i, err)
		}
	}

	if err := a.detectAnomalies("ws1"); err != nil {
		t.Fatalf("detectAnomalies: %v", err)
	}

	var count int
	if err := a.DB.Conn.QueryRow(
		`SELECT COUNT(*) FROM anomalies WHERE workspace_id = ? AND cluster_id = ?`, "ws1", "c1",
	).Scan(&count); err != nil {
		t.Fatalf("count anomalies: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected exactly 1 persisted anomaly for c1, got %d", count)
	}

	var zScore, currentRate, meanRate float64
	if err := a.DB.Conn.QueryRow(
		`SELECT z_score, current_rate, mean_rate FROM anomalies WHERE workspace_id = ? AND cluster_id = ?`,
		"ws1", "c1",
	).Scan(&zScore, &currentRate, &meanRate); err != nil {
		t.Fatalf("query anomalies: %v", err)
	}
	if currentRate != 30.0 {
		t.Errorf("current_rate = %v, want 30.0", currentRate)
	}
	if meanRate != 2.0 {
		t.Errorf("mean_rate = %v, want 2.0", meanRate)
	}
	if zScore < 100 {
		t.Errorf("z_score = %v, want a large value (~280)", zScore)
	}
}

func TestDetectAnomalies_HighRateWithNoBaselineIsNotPersisted(t *testing.T) {
	a := newAIExtraTestApp(t)

	// Reference marker.
	if _, err := a.DB.Conn.Exec(
		`INSERT INTO logs (workspace_id, source_id, cluster_id, timestamp, level, processed) VALUES (?, ?, NULL, ?, ?, TRUE)`,
		"ws1", "src1", "2024-01-02 12:00:00", "INFO",
	); err != nil {
		t.Fatalf("seed marker log: %v", err)
	}

	// A cluster with a very high recent rate but NO hourly_cluster_counts
	// baseline at all -- anomalies.py flags this internally but never
	// persists it (only the z-score branch inserts a row); reproduced here.
	for i := 0; i < 10; i++ {
		if _, err := a.DB.Conn.Exec(
			`INSERT INTO logs (workspace_id, source_id, cluster_id, timestamp, level, processed) VALUES (?, ?, ?, ?, ?, TRUE)`,
			"ws1", "src1", "brand-new-cluster", "2024-01-02 11:55:00", "ERROR",
		); err != nil {
			t.Fatalf("seed burst log %d: %v", i, err)
		}
	}

	if err := a.detectAnomalies("ws1"); err != nil {
		t.Fatalf("detectAnomalies: %v", err)
	}

	var count int
	if err := a.DB.Conn.QueryRow(
		`SELECT COUNT(*) FROM anomalies WHERE workspace_id = ? AND cluster_id = ?`,
		"ws1", "brand-new-cluster",
	).Scan(&count); err != nil {
		t.Fatalf("query anomalies: %v", err)
	}
	if count != 0 {
		t.Errorf("expected no-baseline high-rate cluster to NOT be persisted, got %d rows", count)
	}
}

func TestDetectAnomalies_ThrottlesRepeatedCallsWithinTenSeconds(t *testing.T) {
	a := newAIExtraTestApp(t)
	key := anomalyThrottleKey(a, "ws-throttle")

	anomalyThrottleMu.Lock()
	_, seenBefore := anomalyLastRun[key]
	anomalyThrottleMu.Unlock()
	if seenBefore {
		t.Fatalf("test setup assumption violated: throttle key already present")
	}

	if err := a.detectAnomalies("ws-throttle"); err != nil {
		t.Fatalf("first detectAnomalies call: %v", err)
	}
	anomalyThrottleMu.Lock()
	firstRun, ok := anomalyLastRun[key]
	anomalyThrottleMu.Unlock()
	if !ok {
		t.Fatal("expected a throttle timestamp to be recorded after the first call")
	}

	if err := a.detectAnomalies("ws-throttle"); err != nil {
		t.Fatalf("second (throttled) detectAnomalies call: %v", err)
	}
	anomalyThrottleMu.Lock()
	secondRun := anomalyLastRun[key]
	anomalyThrottleMu.Unlock()
	if !secondRun.Equal(firstRun) {
		t.Errorf("expected the second immediate call to be throttled (timestamp unchanged), first=%v second=%v", firstRun, secondRun)
	}
}

// --- Dashboard stats -------------------------------------------------------

func TestGetDashboardStats_AggregatesBasicMetrics(t *testing.T) {
	a := newAIExtraTestApp(t)

	rows := []struct {
		sourceID, clusterID, timestamp, level string
	}{
		{"src1", "c1", "2024-01-01 10:00:00", "INFO"},
		{"src1", "c1", "2024-01-01 10:05:00", "INFO"},
		{"src1", "c2", "2024-01-01 11:00:00", "ERROR"},
	}
	for _, r := range rows {
		if _, err := a.DB.Conn.Exec(
			`INSERT INTO logs (workspace_id, source_id, cluster_id, timestamp, level, processed) VALUES (?, ?, ?, ?, ?, TRUE)`,
			"ws1", r.sourceID, r.clusterID, r.timestamp, r.level,
		); err != nil {
			t.Fatalf("seed log: %v", err)
		}
	}
	if _, err := a.DB.Conn.Exec(
		`INSERT INTO clusters (workspace_id, cluster_id, template, count) VALUES (?, ?, ?, ?)`,
		"ws1", "c1", "User <*> logged in", 2,
	); err != nil {
		t.Fatalf("seed cluster: %v", err)
	}

	ws := "ws1"
	result, rpcErr := a.GetDashboardStats(models.GetDashboardStatsRequest{WorkspaceID: &ws})
	m := mustMap(t, result, rpcErr)

	if got, ok := m["total_logs"].(int64); !ok || got != 3 {
		t.Errorf("total_logs = %v (%T), want 3", m["total_logs"], m["total_logs"])
	}
	if got, ok := m["total_clusters"].(int64); !ok || got != 2 {
		t.Errorf("total_clusters = %v (%T), want 2", m["total_clusters"], m["total_clusters"])
	}
	levelCounts, ok := m["level_counts"].(map[string]int64)
	if !ok || levelCounts["INFO"] != 2 || levelCounts["ERROR"] != 1 {
		t.Errorf("level_counts = %+v", m["level_counts"])
	}
	topClusters, ok := m["top_clusters"].([]map[string]any)
	if !ok || len(topClusters) != 2 {
		t.Fatalf("top_clusters = %+v", m["top_clusters"])
	}
	// c1 has 2 logs, c2 has 1 -- c1 (with its real template) must sort first.
	if topClusters[0]["cluster_id"] != "c1" || topClusters[0]["template"] != "User <*> logged in" {
		t.Errorf("top_clusters[0] = %+v", topClusters[0])
	}
	topErrorClusters, ok := m["top_error_clusters"].([]map[string]any)
	if !ok || len(topErrorClusters) != 1 || topErrorClusters[0]["cluster_id"] != "c2" {
		t.Errorf("top_error_clusters = %+v", m["top_error_clusters"])
	}
	if _, ok := m["bucket_interval"].(string); !ok {
		t.Errorf("bucket_interval missing/wrong type: %+v", m["bucket_interval"])
	}
	bounds, ok := m["time_bounds"].(map[string]any)
	if !ok || bounds["min"] == "" || bounds["max"] == "" {
		t.Errorf("time_bounds = %+v", m["time_bounds"])
	}
	if _, ok := m["active_tailers"].(int); !ok {
		t.Errorf("active_tailers missing/wrong type: %+v", m["active_tailers"])
	}
}

func TestGetDashboardStats_EmptyWorkspaceReturnsZeroedStats(t *testing.T) {
	a := newAIExtraTestApp(t)
	ws := "empty-ws"
	result, rpcErr := a.GetDashboardStats(models.GetDashboardStatsRequest{WorkspaceID: &ws})
	m := mustMap(t, result, rpcErr)
	if got, ok := m["total_logs"].(int64); !ok || got != 0 {
		t.Errorf("total_logs = %v, want 0", m["total_logs"])
	}
	if got, ok := m["bucket_interval"].(string); !ok || got != "1 hour" {
		t.Errorf("bucket_interval = %v, want default '1 hour' when there's no data", m["bucket_interval"])
	}
}

// --- normalizeQueryTimestamp / determineBucketInterval sanity -------------

func TestDetermineBucketInterval_Thresholds(t *testing.T) {
	cases := []struct {
		seconds float64
		want    string
	}{
		{5, "1 second"},
		{60, "5 seconds"},
		{3600, "1 minute"},
		{86400, "15 minutes"},
		{2592000, "12 hours"},
		{99999999, "30 days"},
	}
	for _, c := range cases {
		if got := determineBucketInterval(c.seconds); got != c.want {
			t.Errorf("determineBucketInterval(%v) = %q, want %q", c.seconds, got, c.want)
		}
	}
}

func TestFormatAnyTimestamp_HandlesNilAndTypes(t *testing.T) {
	if formatAnyTimestamp(nil) != nil {
		t.Errorf("expected nil passthrough")
	}
	if got := formatAnyTimestamp(""); got != nil {
		t.Errorf("expected empty string to become nil, got %v", got)
	}
	if got := formatAnyTimestamp("2024-01-01 00:00:00"); got != "2024-01-01 00:00:00" {
		t.Errorf("string passthrough failed: %v", got)
	}
}

// jsonRoundTrip is a small sanity check that GetAIMessages' context_logs
// default really does encode as `[]`, not `null`, matching Python's
// `json.loads(row[3]) if row[3] else []`.
func TestGetAIMessages_ContextLogsJSONEncodesAsEmptyArrayNotNull(t *testing.T) {
	a := newAIExtraTestApp(t)
	if _, err := a.DB.Conn.Exec(`INSERT INTO ai_messages (session_id, role, content) VALUES (?, ?, ?)`, "s1", "user", "hi"); err != nil {
		t.Fatalf("seed: %v", err)
	}
	result, rpcErr := a.GetAIMessages("s1")
	rows := mustSlice(t, result, rpcErr)
	b, err := json.Marshal(rows[0])
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if !strings.Contains(string(b), `"context_logs":[]`) {
		t.Errorf("expected context_logs to encode as [], got %s", b)
	}
}
