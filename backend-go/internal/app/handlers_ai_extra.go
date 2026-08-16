package app

// handlers_ai_extra.go ports the DB-only half of api.py's AI/dashboard/
// anomaly RPC surface: AI session management (get_ai_sessions,
// get_ai_messages, rename_ai_session, delete_ai_session, get_ai_mapping),
// persisted-anomaly reads (get_anomalies) plus the Z-score anomaly
// *detection* algorithm itself (anomalies.py's AnomalyDetector.
// detect_anomalies, since method_get_dashboard_stats triggers it
// synchronously -- see detectAnomalies' doc comment), and dashboard
// aggregate stats (get_dashboard_stats). None of these need the AI
// provider/tool registry -- see internal/ai/rpc_extra.go for the six
// methods that do (analyze_cluster, list_ai_models, test_ai_connection,
// generate_facet_regex, save_memory, search_memory).
//
// This file is new (not an edit to any existing internal/app file) per the
// migration's concurrency plan: three other agents are simultaneously
// wiring other RPC method groups against internal/app.App, and app.go /
// the pre-existing handlers_*.go files are shared/off-limits for this pass
// to avoid merge conflicts.

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"loglensai/backend-go/internal/models"
)

// --- AI session management (mirrors api.py's method_get_ai_sessions /
// method_get_ai_messages / method_rename_ai_session / method_delete_ai_session /
// method_get_ai_mapping) -----------------------------------------------------

// GetAISessions implements the get_ai_sessions RPC method.
func (a *App) GetAISessions(workspaceID string) (any, *models.RPCError) {
	rows, err := a.DB.Conn.Query(
		`SELECT session_id, name, created_at, last_modified FROM ai_sessions WHERE workspace_id = ? ORDER BY last_modified DESC`,
		workspaceID,
	)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	defer rows.Close()

	out := []map[string]any{}
	for rows.Next() {
		var sessionID string
		var name sql.NullString
		var createdAt, lastModified any
		if scanErr := rows.Scan(&sessionID, &name, &createdAt, &lastModified); scanErr != nil {
			return nil, &models.RPCError{Code: errInternal, Message: scanErr.Error()}
		}
		out = append(out, map[string]any{
			"session_id":    sessionID,
			"name":          nullStringOrNil(name),
			"created_at":    formatAnyTimestamp(createdAt),
			"last_modified": formatAnyTimestamp(lastModified),
		})
	}
	return out, nil
}

// GetAIMessages implements the get_ai_messages RPC method.
func (a *App) GetAIMessages(sessionID string) (any, *models.RPCError) {
	rows, err := a.DB.Conn.Query(
		`SELECT id, role, content, context_logs, timestamp, a2ui_payload FROM ai_messages WHERE session_id = ? ORDER BY timestamp ASC`,
		sessionID,
	)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	defer rows.Close()

	out := []map[string]any{}
	for rows.Next() {
		var id int64
		var role, content, contextLogsRaw, a2uiRaw sql.NullString
		var ts any
		if scanErr := rows.Scan(&id, &role, &content, &contextLogsRaw, &ts, &a2uiRaw); scanErr != nil {
			return nil, &models.RPCError{Code: errInternal, Message: scanErr.Error()}
		}

		contextLogs := []int{}
		if contextLogsRaw.Valid && contextLogsRaw.String != "" {
			var parsed []int
			if json.Unmarshal([]byte(contextLogsRaw.String), &parsed) == nil && parsed != nil {
				contextLogs = parsed
			}
		}

		var a2ui any
		if a2uiRaw.Valid && a2uiRaw.String != "" {
			_ = json.Unmarshal([]byte(a2uiRaw.String), &a2ui)
		}

		out = append(out, map[string]any{
			"id":           id,
			"role":         role.String,
			"content":      content.String,
			"context_logs": contextLogs,
			"timestamp":    formatAnyTimestamp(ts),
			"a2ui_payload": a2ui,
		})
	}
	return out, nil
}

// RenameAISession implements the rename_ai_session RPC method. Not present
// in Python's RPC_MODELS (mapped to None -- unvalidated params), so the RPC
// registration decodes {session_id, name} manually; this method just takes
// the already-decoded fields.
func (a *App) RenameAISession(sessionID, name string) (any, *models.RPCError) {
	now := time.Now().Format("2006-01-02 15:04:05")
	if _, err := a.DB.Conn.Exec(
		`UPDATE ai_sessions SET name = ?, last_modified = ? WHERE session_id = ?`,
		name, now, sessionID,
	); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	return map[string]any{"status": "ok"}, nil
}

// DeleteAISession implements the delete_ai_session RPC method: wipes a
// session and its messages. Two explicit DELETEs, not a foreign-key
// cascade -- ai_messages.session_id carries no FK constraint in the schema
// (internal/db/schema.go), matching api.py's own two-statement delete_ai_session.
func (a *App) DeleteAISession(sessionID string) (any, *models.RPCError) {
	if _, err := a.DB.Conn.Exec(`DELETE FROM ai_messages WHERE session_id = ?`, sessionID); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	if _, err := a.DB.Conn.Exec(`DELETE FROM ai_sessions WHERE session_id = ?`, sessionID); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	return map[string]any{"status": "ok"}, nil
}

// GetAIMapping implements the get_ai_mapping RPC method: {log_id: session_id}
// for every log referenced in some session's ai_messages.context_logs,
// mirroring api.py's method_get_ai_mapping. JSON object keys must be
// strings, so log IDs are stringified (json.dumps does the same
// int-key-to-string coercion implicitly on the Python side).
func (a *App) GetAIMapping(workspaceID string) (any, *models.RPCError) {
	rows, err := a.DB.Conn.Query(`
		SELECT m.context_logs, s.session_id
		FROM ai_messages m
		JOIN ai_sessions s ON m.session_id = s.session_id
		WHERE s.workspace_id = ? AND m.context_logs IS NOT NULL
	`, workspaceID)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	defer rows.Close()

	mapping := map[string]any{}
	for rows.Next() {
		var contextLogsRaw sql.NullString
		var sessionID string
		if scanErr := rows.Scan(&contextLogsRaw, &sessionID); scanErr != nil {
			continue
		}
		if !contextLogsRaw.Valid || contextLogsRaw.String == "" {
			continue
		}
		var logIDs []int
		if err := json.Unmarshal([]byte(contextLogsRaw.String), &logIDs); err != nil {
			continue
		}
		for _, lid := range logIDs {
			mapping[strconv.Itoa(lid)] = sessionID
		}
	}
	return mapping, nil
}

// --- Anomalies: persisted read + on-demand Z-score detection (mirrors
// api.py's method_get_anomalies and anomalies.py's AnomalyDetector) --------

// GetAnomalies implements the get_anomalies RPC method: a plain read of
// already-persisted `anomalies` rows. Mirrors api.py's method_get_anomalies
// exactly (detection itself is triggered elsewhere -- by GetDashboardStats
// below, matching Python's own call site: method_get_anomalies never
// triggers detection itself either).
func (a *App) GetAnomalies(req models.GetAnomaliesRequest) (any, *models.RPCError) {
	query := `SELECT cluster_id, timestamp, z_score, current_rate FROM anomalies WHERE workspace_id = ?`
	args := []any{req.WorkspaceID}
	if req.TimeRange != nil && *req.TimeRange != "" {
		query += ` AND timestamp >= ?`
		args = append(args, *req.TimeRange)
	}
	query += ` ORDER BY timestamp DESC LIMIT 50`

	rows, err := a.DB.Conn.Query(query, args...)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	defer rows.Close()

	anomalies := []map[string]any{}
	for rows.Next() {
		var clusterID sql.NullString
		var ts any
		var zScore, currentRate sql.NullFloat64
		if scanErr := rows.Scan(&clusterID, &ts, &zScore, &currentRate); scanErr != nil {
			continue
		}
		anomalies = append(anomalies, map[string]any{
			"cluster_id":   clusterID.String,
			"timestamp":    formatAnyTimestamp(ts),
			"z_score":      zScore.Float64,
			"current_rate": currentRate.Float64,
		})
	}
	return map[string]any{"anomalies": anomalies}, nil
}

// anomalyThrottle tracks the last detectAnomalies run per (App instance,
// workspace) so on-demand detection stays throttled to at most once every
// 10 seconds per workspace, mirroring anomalies.py's AnomalyDetector.
// _last_run/detect_anomalies throttle guard.
//
// This is a package-level map keyed by a string that embeds the *App
// pointer, rather than a field on App itself, because app.go (which defines
// the App struct) is out of scope for this pass -- see this file's package
// doc comment. In the real process there is exactly one long-lived *App, so
// this never leaks meaningfully more state than a struct field would;
// tests that construct many short-lived *App values do leak a few map
// entries each, which is negligible.
var (
	anomalyThrottleMu sync.Mutex
	anomalyLastRun    = map[string]time.Time{}
)

func anomalyThrottleKey(a *App, workspaceID string) string {
	return fmt.Sprintf("%p|%s", a, workspaceID)
}

// detectAnomalies ports anomalies.py's AnomalyDetector.detect_anomalies: a
// simple Z-score moving-average check over hourly_cluster_counts, flagging
// clusters whose current (last-10-minutes, scaled to a per-hour rate)
// volume deviates sharply from their trailing-24h baseline.
//
// Ported (not left as a read-only stub) because method_get_dashboard_stats
// calls detect_anomalies synchronously on every dashboard fetch (throttled
// via the guard above) -- so GetDashboardStats below needs a real
// implementation to have any parity with Python's dashboard response,
// specifically the anomalies persisted for other RPC methods
// (get_anomalies) to read back. See the algorithm's write-up in
// anomalies.py:28-193 for the numbers reproduced here: baseline mean/stddev
// from the last 24h of hourly_cluster_counts (excluding the most recent 10
// minutes), current rate = count in the last 10 minutes * 6 (scaled to an
// hourly rate), flagged when z_score > 3.0 AND rate > 5.0 (with a baseline),
// or rate > 20.0 with no baseline at all (logged as detected but, matching
// Python exactly, NOT persisted to the anomalies table in that no-baseline
// branch -- only the z-score branch inserts a row).
func (a *App) detectAnomalies(workspaceID string) error {
	key := anomalyThrottleKey(a, workspaceID)
	anomalyThrottleMu.Lock()
	if last, ok := anomalyLastRun[key]; ok && time.Since(last) < 10*time.Second {
		anomalyThrottleMu.Unlock()
		return nil
	}
	anomalyLastRun[key] = time.Now()
	anomalyThrottleMu.Unlock()

	conn := a.DB.Conn

	var refTimeRaw sql.NullString
	if workspaceID != "" {
		_ = conn.QueryRow(`SELECT max(timestamp) FROM logs WHERE workspace_id = ?`, workspaceID).Scan(&refTimeRaw)
	} else {
		_ = conn.QueryRow(`SELECT max(timestamp) FROM logs`).Scan(&refTimeRaw)
	}

	refTime := time.Now().UTC()
	if refTimeRaw.Valid && refTimeRaw.String != "" {
		if parsed, ok := parseAnomalyRefTime(refTimeRaw.String); ok {
			refTime = parsed
		}
	}

	tenMinsAgo := refTime.Add(-10 * time.Minute)
	dayAgo := refTime.Add(-24 * time.Hour)
	nowStr := refTime.Format("2006-01-02 15:04:05")
	tenMinsAgoStr := tenMinsAgo.Format("2006-01-02 15:04:05")
	dayAgoStr := dayAgo.Format("2006-01-02 15:04:05")
	dayAgoBucket := dayAgoStr[:13]
	tenMinsAgoBucket := tenMinsAgoStr[:13]

	// Heal hourly_cluster_counts for the last 24h (fixes any bypass/out-of-sync state).
	if _, err := conn.Exec(`
		INSERT INTO hourly_cluster_counts (workspace_id, cluster_id, hour_bucket, count)
		SELECT workspace_id, cluster_id, SUBSTRING(REPLACE(timestamp, 'T', ' '), 1, 13) as hr, count(*)
		FROM logs
		WHERE timestamp >= ? AND cluster_id IS NOT NULL
		GROUP BY workspace_id, cluster_id, hr
		ON CONFLICT (workspace_id, cluster_id, hour_bucket) DO UPDATE SET count = excluded.count
	`, dayAgoStr); err != nil {
		return fmt.Errorf("app: healing hourly_cluster_counts: %w", err)
	}

	// 1. Baseline mean/stddev per (workspace, cluster) over the last 24h,
	// excluding the most recent 10-minute window.
	baselineQuery := `
		WITH hourly_counts AS (
			SELECT workspace_id, cluster_id, hour_bucket, count as cnt
			FROM hourly_cluster_counts
			WHERE hour_bucket >= ? AND hour_bucket < ? AND cluster_id IS NOT NULL`
	baselineArgs := []any{dayAgoBucket, tenMinsAgoBucket}
	if workspaceID != "" {
		baselineQuery += ` AND workspace_id = ?`
		baselineArgs = append(baselineArgs, workspaceID)
	}
	baselineQuery += `
		)
		SELECT workspace_id, cluster_id, avg(cnt) as mean, stddev_pop(cnt) as stddev
		FROM hourly_counts
		GROUP BY workspace_id, cluster_id
	`

	type baselineStat struct{ mean, stddev float64 }
	baselines := map[[2]string]baselineStat{}
	brows, err := conn.Query(baselineQuery, baselineArgs...)
	if err != nil {
		return fmt.Errorf("app: querying anomaly baseline: %w", err)
	}
	for brows.Next() {
		var ws, cid sql.NullString
		var mean, stddev sql.NullFloat64
		if scanErr := brows.Scan(&ws, &cid, &mean, &stddev); scanErr != nil {
			continue
		}
		sd := stddev.Float64
		// Python: `stddev = float(stddev or 0.1)` -- 0.0 is falsy in Python,
		// so a real zero stddev (single-bucket baseline) is also floored to
		// 0.1, not just a NULL/missing stddev. Reproduced exactly.
		if sd == 0 {
			sd = 0.1
		}
		baselines[[2]string{ws.String, cid.String}] = baselineStat{mean: mean.Float64, stddev: sd}
	}
	brows.Close()

	// 2. Current rate: count in the last 10 minutes, scaled x6 to a per-hour rate.
	currentQuery := `
		SELECT workspace_id, cluster_id, CAST(count(*) AS FLOAT) * 6.0 as current_rate
		FROM logs
		WHERE timestamp >= ? AND cluster_id IS NOT NULL`
	currentArgs := []any{tenMinsAgoStr}
	if workspaceID != "" {
		currentQuery += ` AND workspace_id = ?`
		currentArgs = append(currentArgs, workspaceID)
	}
	currentQuery += ` GROUP BY workspace_id, cluster_id`

	crows, err := conn.Query(currentQuery, currentArgs...)
	if err != nil {
		return fmt.Errorf("app: querying current cluster rates: %w", err)
	}
	defer crows.Close()

	for crows.Next() {
		var ws, cid sql.NullString
		var rate sql.NullFloat64
		if scanErr := crows.Scan(&ws, &cid, &rate); scanErr != nil {
			continue
		}
		r := rate.Float64
		baseline, ok := baselines[[2]string{ws.String, cid.String}]
		if !ok {
			// No baseline yet: only a very high absolute rate counts as an
			// anomaly, and (matching anomalies.py:160-164 exactly) it is
			// never persisted to the `anomalies` table in this branch.
			continue
		}

		z := (r - baseline.mean) / baseline.stddev
		if z > 3.0 && r > 5.0 {
			log.Printf("[Anomalies] workspace=%s cluster=%s z=%.2f rate=%.1f mean=%.1f", ws.String, cid.String, z, r, baseline.mean)
			if _, err := conn.Exec(
				`INSERT INTO anomalies (workspace_id, cluster_id, timestamp, z_score, current_rate, mean_rate) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
				ws.String, cid.String, nowStr, z, r, baseline.mean,
			); err != nil {
				log.Printf("[Anomalies] failed to persist anomaly: %v", err)
			}
		}
	}

	return nil
}

// parseAnomalyRefTime ports the timestamp-parsing block inline in
// anomalies.py's detect_anomalies (anomalies.py:62-79): normalize T/Z/
// fractional-second/timezone-offset noise out of a `logs.timestamp` value,
// then parse either a date-only or full datetime layout.
func parseAnomalyRefTime(raw string) (time.Time, bool) {
	normalized := strings.ReplaceAll(raw, "T", " ")
	normalized = strings.SplitN(normalized, "+", 2)[0]
	normalized = strings.SplitN(normalized, "Z", 2)[0]
	normalized = strings.TrimSpace(normalized)

	if strings.Contains(normalized, ".") {
		base := strings.SplitN(normalized, ".", 2)[0]
		if t, err := time.Parse("2006-01-02 15:04:05", base); err == nil {
			return t, true
		}
		return time.Time{}, false
	}
	if len(normalized) == 10 {
		if t, err := time.Parse("2006-01-02", normalized); err == nil {
			return t, true
		}
		return time.Time{}, false
	}
	if t, err := time.Parse("2006-01-02 15:04:05", normalized); err == nil {
		return t, true
	}
	return time.Time{}, false
}

// --- Dashboard stats (mirrors api.py's method_get_dashboard_stats and its
// _fetch_*/_prepare_dashboard_where/_get_dashboard_bucket_params/
// _build_dashboard_* helpers) -----------------------------------------------

// dashboardBucket is one entry of api.py's INTERVALS dict: the DuckDB
// INTERVAL delta and the strftime-style display format for one dynamic
// dashboard bucket size.
type dashboardBucket struct {
	delta  time.Duration
	format string
}

var dashboardIntervals = map[string]dashboardBucket{
	"1 second":   {time.Second, "%Y-%m-%d %H:%M:%S"},
	"5 seconds":  {5 * time.Second, "%Y-%m-%d %H:%M:%S"},
	"15 seconds": {15 * time.Second, "%Y-%m-%d %H:%M:%S"},
	"1 minute":   {time.Minute, "%Y-%m-%d %H:%M"},
	"5 minutes":  {5 * time.Minute, "%Y-%m-%d %H:%M"},
	"15 minutes": {15 * time.Minute, "%Y-%m-%d %H:%M"},
	"1 hour":     {time.Hour, "%Y-%m-%d %H:00"},
	"4 hours":    {4 * time.Hour, "%Y-%m-%d %H:00"},
	"12 hours":   {12 * time.Hour, "%Y-%m-%d %H:00"},
	"1 day":      {24 * time.Hour, "%Y-%m-%d"},
	"30 days":    {30 * 24 * time.Hour, "%Y-%m"},
}

// determineBucketInterval ports api.py's _determine_bucket_interval.
func determineBucketInterval(durationSec float64) string {
	switch {
	case durationSec <= 10:
		return "1 second"
	case durationSec <= 60:
		return "5 seconds"
	case durationSec <= 600:
		return "15 seconds"
	case durationSec <= 3600:
		return "1 minute"
	case durationSec <= 14400:
		return "5 minutes"
	case durationSec <= 86400:
		return "15 minutes"
	case durationSec <= 259200:
		return "1 hour"
	case durationSec <= 604800:
		return "4 hours"
	case durationSec <= 2592000:
		return "12 hours"
	case durationSec <= 15552000:
		return "1 day"
	default:
		return "30 days"
	}
}

// GetDashboardStats implements the get_dashboard_stats RPC method, mirroring
// api.py's method_get_dashboard_stats.
//
// Deviation: Python runs its ten sub-queries across a
// concurrent.futures.ThreadPoolExecutor(max_workers=10); this runs them
// sequentially. Each is already its own function below (fetchTotalLogs,
// fetchLevelCounts, ...), so switching to goroutines is a mechanical
// follow-up if dashboard latency against a real large dataset turns out to
// matter -- sequential was chosen for this pass to keep the DuckDB access
// pattern (a single *sql.DB shared with the async clustering worker)
// simple and deterministic to test, not because concurrency here is known
// to be unsafe.
func (a *App) GetDashboardStats(req models.GetDashboardStatsRequest) (any, *models.RPCError) {
	workspaceID := derefStr(req.WorkspaceID)
	sourceID := derefStr(req.SourceID)
	startTime := derefStr(req.StartTime)
	endTime := derefStr(req.EndTime)

	if err := a.detectAnomalies(workspaceID); err != nil {
		log.Printf("[Anomalies] Failed to run anomaly detection on dashboard stats request: %v", err)
	}

	whereSQL, params, normStart := a.prepareDashboardWhere(workspaceID, sourceID, startTime, endTime, req.ActiveWorkspaceIDs)
	bucketIntervalStr, bucketFormat, tsMinTime, tsMaxTime := a.getDashboardBucketParams(whereSQL, params)

	totalLogs := a.fetchTotalLogs(whereSQL, params)
	levelCounts := a.fetchLevelCounts(whereSQL, params)
	totalClusters := a.fetchTotalClusters(whereSQL, params)
	topClusters := a.fetchTopClusters(whereSQL, params)
	workspaceCount := a.fetchWorkspaceCount(req.ActiveWorkspaceIDs)
	timeSeries := a.fetchTimeSeries(bucketIntervalStr, bucketFormat, whereSQL, params, startTime, endTime, tsMinTime, tsMaxTime)
	topErrorClusters := a.fetchTopErrorClusters(whereSQL, params)
	newPatternsCount := a.fetchPatternDrift(startTime, normStart)
	sourceHeatmap := a.fetchSourceHeatmap(whereSQL, params, bucketFormat)
	latestInsight := a.fetchLatestInsight(workspaceID)

	a.tailersMu.Lock()
	activeTailers := 0
	for _, t := range a.tailers {
		if t.Running() {
			activeTailers++
		}
	}
	a.tailersMu.Unlock()

	return map[string]any{
		"total_logs":         totalLogs,
		"total_clusters":     totalClusters,
		"level_counts":       levelCounts,
		"top_clusters":       topClusters,
		"top_error_clusters": topErrorClusters,
		"time_series":        timeSeries,
		"source_heatmap":     sourceHeatmap,
		"latest_insight":     latestInsight,
		"new_patterns_count": newPatternsCount,
		"workspace_count":    workspaceCount,
		"active_tailers":     activeTailers,
		"bucket_interval":    bucketIntervalStr,
		"time_bounds": map[string]any{
			"min": tsMinTime,
			"max": tsMaxTime,
		},
	}, nil
}

// prepareDashboardWhere ports api.py's _prepare_dashboard_where.
func (a *App) prepareDashboardWhere(workspaceID, sourceID, startTime, endTime string, activeWorkspaceIDs []string) (string, []any, string) {
	var clauses []string
	var params []any
	normStart := ""

	if workspaceID != "" {
		clauses = append(clauses, "l.workspace_id = ?")
		params = append(params, workspaceID)
	}
	if sourceID != "" {
		clauses = append(clauses, "l.source_id = ?")
		params = append(params, sourceID)
	}
	if startTime != "" {
		normStart = normalizeQueryTimestamp(startTime)
		clauses = append(clauses, "l.timestamp >= ?")
		params = append(params, normStart)
	}
	if endTime != "" {
		normEnd := normalizeQueryTimestamp(endTime)
		clauses = append(clauses, "l.timestamp <= ?")
		params = append(params, normEnd)
	}
	if len(activeWorkspaceIDs) > 0 {
		placeholders := make([]string, len(activeWorkspaceIDs))
		for i, id := range activeWorkspaceIDs {
			placeholders[i] = "?"
			params = append(params, id)
		}
		clauses = append(clauses, "l.workspace_id IN ("+strings.Join(placeholders, ", ")+")")
	}

	// Exclude 'local' sources that aren't fully uploaded yet.
	clauses = append(clauses, "l.source_id NOT IN (SELECT id FROM log_sources WHERE type = 'local' AND is_uploaded = false)")

	whereSQL := ""
	if len(clauses) > 0 {
		whereSQL = " WHERE " + strings.Join(clauses, " AND ")
	}
	return whereSQL, params, normStart
}

// normalizeQueryTimestamp is already defined in handlers_query.go (mirrors
// api.py's App._normalize_query_timestamp) -- reused here as-is.

// getDashboardBucketParams ports api.py's _get_dashboard_bucket_params.
func (a *App) getDashboardBucketParams(whereSQL string, params []any) (bucketIntervalStr, bucketFormat, tsMin, tsMax string) {
	bucketIntervalStr = "1 hour"
	bucketFormat = "%Y-%m-%d %H:00:00"

	var minRaw, maxRaw sql.NullString
	if err := a.DB.Conn.QueryRow(`SELECT MIN(l.timestamp), MAX(l.timestamp) FROM logs l`+whereSQL, params...).Scan(&minRaw, &maxRaw); err != nil {
		log.Printf("[Dashboard] Failed to calculate dynamic time bucket size: %v", err)
		return
	}
	if !minRaw.Valid || !maxRaw.Valid || minRaw.String == "" || maxRaw.String == "" {
		return
	}
	tsMin, tsMax = minRaw.String, maxRaw.String

	minDT, okMin := parseDashboardTimestamp(tsMin)
	maxDT, okMax := parseDashboardTimestamp(tsMax)
	if !okMin || !okMax {
		return
	}
	seconds := maxDT.Sub(minDT).Seconds()
	if seconds < 1 {
		seconds = 1
	}
	interval := determineBucketInterval(seconds)
	if cfg, ok := dashboardIntervals[interval]; ok {
		bucketIntervalStr = interval
		bucketFormat = cfg.format
	}
	return
}

// parseDashboardTimestamp ports the inline `_s = ts.replace("T"," ").replace("Z","")[:19]`
// + strptime("%Y-%m-%d %H:%M:%S") parsing used by both
// _get_dashboard_bucket_params and _build_dashboard_filled_slots.
func parseDashboardTimestamp(ts string) (time.Time, bool) {
	s := strings.ReplaceAll(strings.ReplaceAll(ts, "T", " "), "Z", "")
	if len(s) > 19 {
		s = s[:19]
	}
	t, err := time.Parse("2006-01-02 15:04:05", s)
	if err != nil {
		return time.Time{}, false
	}
	return t, true
}

// formatBucketLayout renders t using a Python/C strftime-style pattern
// (only %Y/%m/%d/%H/%M/%S are ever used by dashboardIntervals' formats),
// translated to Go's reference-time layout.
func formatBucketLayout(t time.Time, pattern string) string {
	layout := strings.NewReplacer(
		"%Y", "2006",
		"%m", "01",
		"%d", "02",
		"%H", "15",
		"%M", "04",
		"%S", "05",
	).Replace(pattern)
	return t.Format(layout)
}

func (a *App) fetchTotalLogs(whereSQL string, params []any) int64 {
	var n int64
	_ = a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM logs l`+whereSQL, params...).Scan(&n)
	return n
}

func (a *App) fetchLevelCounts(whereSQL string, params []any) map[string]int64 {
	out := map[string]int64{}
	rows, err := a.DB.Conn.Query(`SELECT l.level, COUNT(*) FROM logs l`+whereSQL+` GROUP BY l.level`, params...)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var level sql.NullString
		var count int64
		if rows.Scan(&level, &count) == nil {
			out[level.String] = count
		}
	}
	return out
}

func (a *App) fetchTotalClusters(whereSQL string, params []any) int64 {
	var n int64
	_ = a.DB.Conn.QueryRow(`SELECT COUNT(DISTINCT l.cluster_id) FROM logs l`+whereSQL, params...).Scan(&n)
	return n
}

// runClusterAggQuery is shared by fetchTopClusters/fetchTopErrorClusters
// (api.py's _fetch_top_clusters/_fetch_top_error_clusters differ only in
// WHERE clause and LIMIT).
func (a *App) runClusterAggQuery(query string, params []any) []map[string]any {
	out := []map[string]any{}
	rows, err := a.DB.Conn.Query(query, params...)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var template, clusterID sql.NullString
		var count int64
		if rows.Scan(&template, &count, &clusterID) == nil {
			out = append(out, map[string]any{"template": template.String, "count": count, "cluster_id": clusterID.String})
		}
	}
	return out
}

func appendClusterWhere(whereSQL, extra string) string {
	if whereSQL == "" {
		return " WHERE " + extra
	}
	return whereSQL + " AND " + extra
}

func (a *App) fetchTopClusters(whereSQL string, params []any) []map[string]any {
	query := `SELECT COALESCE(c.template, 'Pattern ' || l.cluster_id) as template, COUNT(*) as count, l.cluster_id
		FROM logs l LEFT JOIN clusters c ON l.workspace_id = c.workspace_id AND l.cluster_id = c.cluster_id` +
		appendClusterWhere(whereSQL, "l.cluster_id IS NOT NULL") +
		` GROUP BY template, l.cluster_id ORDER BY count DESC LIMIT 10`
	return a.runClusterAggQuery(query, params)
}

func (a *App) fetchTopErrorClusters(whereSQL string, params []any) []map[string]any {
	query := `SELECT COALESCE(c.template, 'Pattern ' || l.cluster_id) as template, COUNT(*) as count, l.cluster_id
		FROM logs l LEFT JOIN clusters c ON l.workspace_id = c.workspace_id AND l.cluster_id = c.cluster_id` +
		appendClusterWhere(whereSQL, "l.level IN ('ERROR', 'FATAL', 'CRITICAL') AND l.cluster_id IS NOT NULL") +
		` GROUP BY template, l.cluster_id ORDER BY count DESC LIMIT 5`
	return a.runClusterAggQuery(query, params)
}

func (a *App) fetchWorkspaceCount(activeWorkspaceIDs []string) int64 {
	excludeSQL := "source_id NOT IN (SELECT id FROM log_sources WHERE type = 'local' AND is_uploaded = false)"
	var n int64
	if len(activeWorkspaceIDs) > 0 {
		placeholders := make([]string, len(activeWorkspaceIDs))
		args := make([]any, len(activeWorkspaceIDs))
		for i, id := range activeWorkspaceIDs {
			placeholders[i] = "?"
			args[i] = id
		}
		q := `SELECT COUNT(DISTINCT workspace_id) FROM logs WHERE workspace_id IN (` + strings.Join(placeholders, ", ") + `) AND ` + excludeSQL
		_ = a.DB.Conn.QueryRow(q, args...).Scan(&n)
	} else {
		q := `SELECT COUNT(DISTINCT workspace_id) FROM logs WHERE ` + excludeSQL
		_ = a.DB.Conn.QueryRow(q).Scan(&n)
	}
	return n
}

func (a *App) fetchPatternDrift(startTime, normStart string) int64 {
	var hasCol int
	if err := a.DB.Conn.QueryRow(
		`SELECT count(*) FROM information_schema.columns WHERE table_name = 'clusters' AND column_name = 'created_at'`,
	).Scan(&hasCol); err != nil || hasCol == 0 {
		return 0
	}
	var n int64
	if startTime != "" {
		_ = a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM clusters WHERE created_at >= ?`, normStart).Scan(&n)
	} else {
		_ = a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM clusters`).Scan(&n)
	}
	return n
}

func (a *App) fetchSourceHeatmap(whereSQL string, params []any, bucketFormat string) []map[string]any {
	out := []map[string]any{}
	query := "SELECT strftime('" + bucketFormat + "', TRY_CAST(l.timestamp AS TIMESTAMP)) as bucket, l.source_id, s.name as source_name, COUNT(*) as count " +
		"FROM logs l LEFT JOIN log_sources s ON l.source_id = s.id" + whereSQL + " GROUP BY bucket, l.source_id, s.name ORDER BY bucket ASC"
	rows, err := a.DB.Conn.Query(query, params...)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var bucket, sourceID, sourceName sql.NullString
		var count int64
		if rows.Scan(&bucket, &sourceID, &sourceName, &count) == nil {
			out = append(out, map[string]any{
				"timestamp":   bucket.String,
				"source_id":   sourceID.String,
				"source_name": sourceName.String,
				"count":       count,
			})
		}
	}
	return out
}

var thinkTagRE = regexp.MustCompile(`(?s)<think>.*?</think>`)

func (a *App) fetchLatestInsight(workspaceID string) any {
	query := `SELECT m.content FROM ai_messages m JOIN ai_sessions s ON m.session_id = s.session_id WHERE m.role = 'assistant'`
	var args []any
	if workspaceID != "" {
		query += ` AND s.workspace_id = ?`
		args = append(args, workspaceID)
	}
	query += ` ORDER BY m.timestamp DESC LIMIT 1`

	var content sql.NullString
	if err := a.DB.Conn.QueryRow(query, args...).Scan(&content); err != nil || !content.Valid {
		return nil
	}
	clean := strings.TrimSpace(thinkTagRE.ReplaceAllString(content.String, ""))
	runes := []rune(clean)
	if len(runes) > 150 {
		return string(runes[:150]) + "..."
	}
	return clean
}

// dashboardTSRow is one raw (bucket, level, count) row from fetchTimeSeries'
// query, before pivoting/gap-filling.
type dashboardTSRow struct {
	bucket string
	level  string
	count  int64
}

func (a *App) fetchTimeSeries(bucketIntervalStr, bucketFormat, whereSQL string, params []any, startTime, endTime, tsMinTime, tsMaxTime string) []map[string]any {
	tsWhere := appendClusterWhere(whereSQL, "l.timestamp IS NOT NULL")
	query := "SELECT strftime(time_bucket(INTERVAL '" + bucketIntervalStr + "', CAST(l.timestamp AS TIMESTAMP)), '" + bucketFormat + "') as bucket, l.level, COUNT(*) as count " +
		"FROM logs l " + tsWhere + " GROUP BY bucket, l.level ORDER BY bucket ASC"

	rows, err := a.DB.Conn.Query(query, params...)
	if err != nil {
		return []map[string]any{}
	}
	defer rows.Close()

	var raw []dashboardTSRow
	for rows.Next() {
		var bucket, level sql.NullString
		var count int64
		if rows.Scan(&bucket, &level, &count) == nil {
			raw = append(raw, dashboardTSRow{bucket: bucket.String, level: level.String, count: count})
		}
	}

	return a.buildDashboardTimeSeries(raw, startTime, endTime, tsMinTime, tsMaxTime, bucketIntervalStr, bucketFormat)
}

// buildDashboardFilledSlots ports api.py's _build_dashboard_filled_slots:
// an epoch-anchored (matching DuckDB's time_bucket) list of bucket labels
// spanning [start, end], capped at 500 slots.
func (a *App) buildDashboardFilledSlots(startTime, endTime, tsMinTime, tsMaxTime, bucketIntervalStr, bucketFormat string) []string {
	delta := time.Hour
	format := bucketFormat
	if cfg, ok := dashboardIntervals[bucketIntervalStr]; ok {
		delta = cfg.delta
		format = cfg.format
	}

	tsMin := startTime
	if tsMin == "" {
		tsMin = tsMinTime
	}
	tsMax := endTime
	if tsMax == "" {
		tsMax = tsMaxTime
	}
	if tsMin == "" || tsMax == "" {
		return nil
	}

	curDT, okS := parseDashboardTimestamp(tsMin)
	endDT, okE := parseDashboardTimestamp(tsMax)
	if !okS || !okE {
		return nil
	}

	if delta > 0 {
		epoch := time.Unix(0, 0).UTC()
		elapsed := curDT.Sub(epoch)
		floored := (elapsed / delta) * delta
		curDT = epoch.Add(floored)
	}

	var slots []string
	for !curDT.After(endDT) && len(slots) < 500 {
		slot := formatBucketLayout(curDT, format)
		if len(slot) == 13 {
			slot += ":00"
		}
		slots = append(slots, slot)
		curDT = curDT.Add(delta)
	}
	return slots
}

// buildDashboardTimeSeries ports api.py's _build_dashboard_time_series:
// pivots raw (bucket, level, count) rows into one map per bucket with a
// key per level, gap-fills every bucket in the requested range with
// DEBUG/INFO/WARN/ERROR = 0 (Kibana's "extended_bounds"/min_doc_count:0
// equivalent), and returns the result sorted by bucket label.
func (a *App) buildDashboardTimeSeries(raw []dashboardTSRow, startTime, endTime, tsMinTime, tsMaxTime, bucketIntervalStr, bucketFormat string) []map[string]any {
	pivot := map[string]map[string]any{}
	for _, r := range raw {
		key := r.bucket
		if len(key) == 13 {
			key += ":00"
		}
		entry, ok := pivot[key]
		if !ok {
			entry = map[string]any{"timestamp": key}
			pivot[key] = entry
		}
		level := r.level
		if level == "" {
			level = "UNKNOWN"
		}
		entry[level] = r.count
	}

	emptyLevels := []string{"DEBUG", "INFO", "WARN", "ERROR"}
	slots := a.buildDashboardFilledSlots(startTime, endTime, tsMinTime, tsMaxTime, bucketIntervalStr, bucketFormat)

	full := map[string]map[string]any{}
	if len(slots) > 0 {
		for _, slot := range slots {
			entry := map[string]any{"timestamp": slot}
			for _, l := range emptyLevels {
				entry[l] = int64(0)
			}
			full[slot] = entry
		}
		for key, data := range pivot {
			if existing, ok := full[key]; ok {
				for k, v := range data {
					existing[k] = v
				}
			} else {
				entry := map[string]any{"timestamp": key}
				for _, l := range emptyLevels {
					entry[l] = int64(0)
				}
				for k, v := range data {
					entry[k] = v
				}
				full[key] = entry
			}
		}
	} else {
		full = pivot
	}

	keys := make([]string, 0, len(full))
	for k := range full {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	result := make([]map[string]any, 0, len(keys))
	for _, k := range keys {
		result = append(result, full[k])
	}
	return result
}

// --- small shared helpers ----------------------------------------------

func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func nullStringOrNil(s sql.NullString) any {
	if !s.Valid {
		return nil
	}
	return s.String
}

// formatAnyTimestamp normalizes a scanned TIMESTAMP column (go-duckdb may
// hand back a time.Time, string, or []byte depending on column/driver
// version) into the "YYYY-MM-DD HH:MM:SS" string form Python's `str(datetime)`
// produces for method_get_ai_sessions/method_get_ai_messages/etc. Returns
// nil for a SQL NULL, matching Python's `str(row[n]) if row[n] else None`.
func formatAnyTimestamp(v any) any {
	switch t := v.(type) {
	case nil:
		return nil
	case time.Time:
		if t.IsZero() {
			return nil
		}
		return t.Format("2006-01-02 15:04:05")
	case string:
		if t == "" {
			return nil
		}
		return t
	case []byte:
		if len(t) == 0 {
			return nil
		}
		return string(t)
	default:
		return fmt.Sprintf("%v", t)
	}
}
