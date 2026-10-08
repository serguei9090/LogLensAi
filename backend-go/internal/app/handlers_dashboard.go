package app

import (
	"database/sql"
	"log"
	"regexp"
	"sort"
	"strings"
	"time"

	"loglensai/backend-go/internal/models"
)

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

// GetDashboardStats implements the get_dashboard_stats RPC method.
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

func (a *App) prepareDashboardWhere(workspaceID, sourceID, startTime, endTime string, activeWorkspaceIDs []string) (string, []any, string) {
	var clauses []string
	var params []any
	normStart := ""

	if workspaceID != "" {
		clauses = append(clauses, "l.workspace_id = ?")
		params = append(params, workspaceID)
	} else if len(activeWorkspaceIDs) > 0 {
		placeholders := make([]string, len(activeWorkspaceIDs))
		for i, id := range activeWorkspaceIDs {
			placeholders[i] = "?"
			params = append(params, id)
		}
		clauses = append(clauses, "l.workspace_id IN ("+strings.Join(placeholders, ", ")+")")
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

	whereSQL := ""
	if len(clauses) > 0 {
		whereSQL = " WHERE " + strings.Join(clauses, " AND ")
	}
	return whereSQL, params, normStart
}

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
			entry := map[string]any{"template": template.String, "count": count, "cluster_id": clusterID.String}
			if a.DB != nil && clusterID.Valid && clusterID.String != "" {
				row := a.DB.Conn.QueryRow(`
					SELECT category, severity, is_outage, confidence
					FROM cluster_triage
					WHERE cluster_id = ?
					LIMIT 1
				`, clusterID.String)
				var cat string
				var sev, conf float64
				var isOutage bool
				if row.Scan(&cat, &sev, &isOutage, &conf) == nil {
					entry["category"] = cat
					entry["severity"] = sev
					entry["is_outage"] = isOutage
					entry["confidence"] = conf
				}
			}
			out = append(out, entry)
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
	var n int64
	if len(activeWorkspaceIDs) > 0 {
		placeholders := make([]string, len(activeWorkspaceIDs))
		args := make([]any, len(activeWorkspaceIDs))
		for i, id := range activeWorkspaceIDs {
			placeholders[i] = "?"
			args[i] = id
		}
		q := `SELECT COUNT(DISTINCT workspace_id) FROM logs WHERE workspace_id IN (` + strings.Join(placeholders, ", ") + `)`
		_ = a.DB.Conn.QueryRow(q, args...).Scan(&n)
	} else {
		q := `SELECT COUNT(DISTINCT workspace_id) FROM logs`
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

func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
