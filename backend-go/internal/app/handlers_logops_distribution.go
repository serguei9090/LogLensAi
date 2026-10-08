package app

import (
	"database/sql"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"loglensai/backend-go/internal/models"
	llql "loglensai/backend-go/internal/query"
)

type distributionIntervalSpec struct {
	delta      time.Duration
	duckFormat string
	goLayout   string
}

var distributionIntervals = map[string]distributionIntervalSpec{
	"1 second":   {time.Second, "%Y-%m-%d %H:%M:%S", "2006-01-02 15:04:05"},
	"5 seconds":  {5 * time.Second, "%Y-%m-%d %H:%M:%S", "2006-01-02 15:04:05"},
	"15 seconds": {15 * time.Second, "%Y-%m-%d %H:%M:%S", "2006-01-02 15:04:05"},
	"1 minute":   {time.Minute, "%Y-%m-%d %H:%M", "2006-01-02 15:04"},
	"5 minutes":  {5 * time.Minute, "%Y-%m-%d %H:%M", "2006-01-02 15:04"},
	"15 minutes": {15 * time.Minute, "%Y-%m-%d %H:%M", "2006-01-02 15:04"},
	"1 hour":     {time.Hour, "%Y-%m-%d %H:00", "2006-01-02 15:00"},
	"4 hours":    {4 * time.Hour, "%Y-%m-%d %H:00", "2006-01-02 15:00"},
	"12 hours":   {12 * time.Hour, "%Y-%m-%d %H:00", "2006-01-02 15:00"},
	"1 day":      {24 * time.Hour, "%Y-%m-%d", "2006-01-02"},
	"30 days":    {30 * 24 * time.Hour, "%Y-%m", "2006-01"},
}

func parseFlexibleTs(s string) (time.Time, bool) {
	if s == "" {
		return time.Time{}, false
	}
	norm := strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(s, "T", " "), "Z", ""))

	formats := []struct {
		layout string
		length int
	}{
		{"2006-01-02 15:04:05", 19},
		{"2006-01-02 15:04", 16},
		{"2006-01-02 15", 13},
		{"2006-01-02", 10},
		{"2006-01", 7},
	}
	for _, f := range formats {
		if len(norm) < f.length {
			continue
		}
		if t, err := time.Parse(f.layout, norm[:f.length]); err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}

func parseStrictTs19(s string) (time.Time, bool) {
	norm := strings.ReplaceAll(strings.ReplaceAll(s, "T", " "), "Z", "")
	if len(norm) < 19 {
		return time.Time{}, false
	}
	t, err := time.Parse("2006-01-02 15:04:05", norm[:19])
	return t, err == nil
}

func floorToBucket(t time.Time, delta time.Duration) time.Time {
	if delta <= 0 {
		return t
	}
	epoch := time.Date(1970, 1, 1, 0, 0, 0, 0, time.UTC)
	totalSecs := t.Sub(epoch).Seconds()
	ivlSecs := delta.Seconds()
	flooredSecs := math.Floor(totalSecs/ivlSecs) * ivlSecs
	return epoch.Add(time.Duration(flooredSecs * float64(time.Second)))
}

func buildDistributionSlots(startTs, endTs *string, delta time.Duration, goLayout string) []string {
	if startTs == nil || endTs == nil || delta <= 0 {
		return nil
	}
	dtStart, okS := parseFlexibleTs(*startTs)
	dtEnd, okE := parseFlexibleTs(*endTs)
	if !okS || !okE {
		return nil
	}

	var slots []string
	current := floorToBucket(dtStart, delta)
	for !current.After(dtEnd) && len(slots) < 500 {
		label := current.Format(goLayout)
		if len(label) == 13 {
			label += ":00"
		}
		slots = append(slots, label)
		current = current.Add(delta)
	}
	return slots
}

func (a *App) buildDistributionWhereClause(req models.GetLogDistributionRequest) (string, []any, bool) {
	whereClauses := []string{"workspace_id = ?"}
	params := []any{req.WorkspaceID}

	effectiveSourceIDs := req.SourceIDs
	haveSourceRestriction := req.SourceIDs != nil

	if req.FusionID != nil && *req.FusionID != "" {
		rows, err := a.DB.Conn.Query(
			`SELECT source_id FROM fusion_configs WHERE workspace_id = ? AND fusion_id = ? AND enabled = TRUE`,
			req.WorkspaceID, *req.FusionID,
		)
		ids := []string{}
		if err == nil {
			for rows.Next() {
				var id string
				if rows.Scan(&id) == nil {
					ids = append(ids, id)
				}
			}
			rows.Close()
		}
		effectiveSourceIDs = ids
		haveSourceRestriction = true
	}

	if haveSourceRestriction {
		if len(effectiveSourceIDs) == 0 {
			return "", nil, false
		}
		placeholders := make([]string, len(effectiveSourceIDs))
		for i, id := range effectiveSourceIDs {
			placeholders[i] = "?"
			params = append(params, id)
		}
		whereClauses = append(whereClauses, "source_id IN ("+strings.Join(placeholders, ",")+")")
	}

	if len(req.Filters) > 0 {
		fClauses, fParams := parseFilters(req.Filters)
		whereClauses = append(whereClauses, fClauses...)
		params = append(params, fParams...)
	}

	if req.Query != nil && strings.TrimSpace(*req.Query) != "" {
		llqlSQL, llqlParams := llql.ParseLLQL(*req.Query)
		if llqlSQL != "" {
			whereClauses = append(whereClauses, "("+llqlSQL+")")
			params = append(params, llqlParams...)
		}
	}

	if req.StartTime != nil && *req.StartTime != "" {
		whereClauses = append(whereClauses, "timestamp >= ?")
		params = append(params, normalizeQueryTimestamp(*req.StartTime))
	}
	if req.EndTime != nil && *req.EndTime != "" {
		whereClauses = append(whereClauses, "timestamp <= ?")
		params = append(params, normalizeQueryTimestamp(*req.EndTime))
	}

	return strings.Join(whereClauses, " AND "), params, true
}

func (a *App) determineDistributionBounds(whereSQL string, params []any, startTime, endTime *string) (*string, *string, float64) {
	var startTs, endTs *string
	if startTime != nil && *startTime != "" {
		startTs = startTime
	}
	if endTime != nil && *endTime != "" {
		endTs = endTime
	}

	if startTs == nil || endTs == nil {
		var minTs, maxTs sql.NullString
		row := a.DB.Conn.QueryRow(`SELECT MIN(timestamp), MAX(timestamp) FROM logs l WHERE `+whereSQL, params...)
		if row.Scan(&minTs, &maxTs) == nil && minTs.Valid && maxTs.Valid && minTs.String != "" && maxTs.String != "" {
			if startTs == nil {
				s := minTs.String
				startTs = &s
			}
			if endTs == nil {
				s := maxTs.String
				endTs = &s
			}
		}
	}

	durationSec := 3600.0
	if startTs != nil && endTs != nil {
		if dtS, okS := parseStrictTs19(*startTs); okS {
			if dtE, okE := parseStrictTs19(*endTs); okE {
				d := dtE.Sub(dtS).Seconds()
				if d < 1.0 {
					d = 1.0
				}
				durationSec = d
			}
		}
	}
	return startTs, endTs, durationSec
}

// GetLogDistribution implements the get_log_distribution RPC method,
// mirroring api.py's App.method_get_log_distribution.
func (a *App) GetLogDistribution(req models.GetLogDistributionRequest) (any, *models.RPCError) {
	whereSQL, params, ok := a.buildDistributionWhereClause(req)
	if !ok {
		return map[string]any{"buckets": []any{}}, nil
	}

	var exists bool
	if err := a.DB.Conn.QueryRow(`SELECT EXISTS(SELECT 1 FROM logs l WHERE `+whereSQL+`)`, params...).Scan(&exists); err != nil || !exists {
		return map[string]any{"buckets": []any{}}, nil
	}

	startTs, endTs, durationSec := a.determineDistributionBounds(whereSQL, params, req.StartTime, req.EndTime)

	intervalStr := determineBucketInterval(durationSec)
	spec := distributionIntervals[intervalStr]

	query := fmt.Sprintf(`
		SELECT
			strftime(time_bucket(INTERVAL '%s', CAST(timestamp AS TIMESTAMP)), '%s') as time_bucket,
			level,
			COUNT(*) as count
		FROM logs l
		WHERE %s
		GROUP BY time_bucket, level
		ORDER BY time_bucket ASC
	`, intervalStr, spec.duckFormat, whereSQL)

	dbBuckets := map[string]map[string]any{}
	if rows, err := a.DB.Conn.Query(query, params...); err == nil {
		for rows.Next() {
			var bucketKey, level string
			var count int64
			if rows.Scan(&bucketKey, &level, &count) != nil {
				continue
			}
			if len(bucketKey) == 13 {
				bucketKey += ":00"
			}
			b, ok := dbBuckets[bucketKey]
			if !ok {
				b = map[string]any{"bucket": bucketKey}
				dbBuckets[bucketKey] = b
			}
			b[level] = count
		}
		rows.Close()
	}

	emptyLevels := []string{"DEBUG", "INFO", "WARN", "ERROR"}
	allSlots := buildDistributionSlots(startTs, endTs, spec.delta, spec.goLayout)

	fullBuckets := map[string]map[string]any{}
	for _, slot := range allSlots {
		m := map[string]any{"bucket": slot}
		for _, lvl := range emptyLevels {
			m[lvl] = int64(0)
		}
		fullBuckets[slot] = m
	}
	for key, data := range dbBuckets {
		if existing, ok := fullBuckets[key]; ok {
			for k, v := range data {
				existing[k] = v
			}
		} else {
			m := map[string]any{}
			for _, lvl := range emptyLevels {
				m[lvl] = int64(0)
			}
			for k, v := range data {
				m[k] = v
			}
			fullBuckets[key] = m
		}
	}

	var finalBuckets []map[string]any
	if len(allSlots) > 0 {
		for _, m := range fullBuckets {
			finalBuckets = append(finalBuckets, m)
		}
	} else {
		for _, m := range dbBuckets {
			finalBuckets = append(finalBuckets, m)
		}
	}
	sort.Slice(finalBuckets, func(i, j int) bool {
		bi, _ := finalBuckets[i]["bucket"].(string)
		bj, _ := finalBuckets[j]["bucket"].(string)
		return bi < bj
	})
	if finalBuckets == nil {
		finalBuckets = []map[string]any{}
	}

	return map[string]any{"buckets": finalBuckets, "bucket_interval": intervalStr}, nil
}
