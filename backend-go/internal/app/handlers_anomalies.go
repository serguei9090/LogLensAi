package app

import (
	"database/sql"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"loglensai/backend-go/internal/models"
)

// GetAnomalies implements the get_anomalies RPC method.
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

var (
	anomalyThrottleMu sync.Mutex
	anomalyLastRun    = map[string]time.Time{}
)

func anomalyThrottleKey(a *App, workspaceID string) string {
	return fmt.Sprintf("%p|%s", a, workspaceID)
}

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

	// Heal hourly_cluster_counts for the last 24h
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
		if sd == 0 {
			sd = 0.1
		}
		baselines[[2]string{ws.String, cid.String}] = baselineStat{mean: mean.Float64, stddev: sd}
	}
	brows.Close()

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
