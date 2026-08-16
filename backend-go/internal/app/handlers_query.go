package app

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"loglensai/backend-go/internal/models"
	llql "loglensai/backend-go/internal/query"
)

// allowedFilterFields mirrors api.py's _parse_filters `allowed_fields` set.
var allowedFilterFields = map[string]bool{
	"level": true, "source_id": true, "cluster_id": true, "raw_text": true, "has_comment": true,
}

// allowedSortFields mirrors api.py's _get_logs_internal `allowed_sort` list.
var allowedSortFields = map[string]bool{
	"id": true, "timestamp": true, "ingest_timestamp": true, "level": true,
	"source_id": true, "cluster_id": true, "has_comment": true, "cluster_percent": true,
}

// buildFilterClause maps one (field, operator, value) to a SQL fragment,
// mirroring api.py's App._build_filter_clause.
func buildFilterClause(field, op, value string) (string, any) {
	switch op {
	case "contains":
		return field + " ILIKE ?", "%" + value + "%"
	case "not_contains":
		return field + " NOT ILIKE ?", "%" + value + "%"
	case "equals":
		if strings.Contains(field, "source_id") {
			return field + " ILIKE ?", value
		}
		return field + " = ?", value
	case "not_equals":
		return field + " != ?", value
	case "starts_with":
		return field + " ILIKE ?", value + "%"
	case "regex":
		return "regexp_matches(" + field + ", ?)", value
	default:
		return "", nil
	}
}

// parseFilters mirrors api.py's App._parse_filters / _process_single_filter:
// filters sharing the same resolved SQL field are OR'd together within their
// group, and every group is AND'd into the final WHERE clause.
func parseFilters(filters []models.LogFilter) ([]string, []any) {
	type item struct {
		clause string
		param  any
	}
	groups := make(map[string][]item)
	var order []string

	for _, f := range filters {
		if f.Field == "" {
			continue
		}
		op := f.Operator
		if op == "" {
			op = "contains"
		}

		var fieldSQL string
		if strings.HasPrefix(f.Field, "facets.") {
			facetKey := strings.TrimPrefix(f.Field, "facets.")
			fieldSQL = "json_extract_string(l.facets, '$." + facetKey + "')"
		} else if allowedFilterFields[f.Field] {
			fieldSQL = "l." + f.Field
		} else {
			continue
		}

		clause, param := buildFilterClause(fieldSQL, op, f.Value)
		if clause == "" {
			continue
		}
		if _, ok := groups[fieldSQL]; !ok {
			order = append(order, fieldSQL)
		}
		groups[fieldSQL] = append(groups[fieldSQL], item{clause, param})
	}

	var whereClauses []string
	var params []any
	for _, key := range order {
		items := groups[key]
		clauses := make([]string, len(items))
		for i, it := range items {
			clauses[i] = it.clause
			params = append(params, it.param)
		}
		if len(clauses) > 1 {
			whereClauses = append(whereClauses, "("+strings.Join(clauses, " OR ")+")")
		} else {
			whereClauses = append(whereClauses, clauses[0])
		}
	}
	return whereClauses, params
}

// normalizeQueryTimestamp mirrors api.py's App._normalize_query_timestamp.
func normalizeQueryTimestamp(ts string) string {
	if ts == "" {
		return ""
	}
	norm := strings.ReplaceAll(ts, "T", " ")
	norm = strings.ReplaceAll(norm, "Z", "")
	if idx := strings.Index(norm, "."); idx != -1 {
		msPart := norm[idx+1:]
		for len(msPart) < 3 {
			msPart += "0"
		}
		msPart = msPart[:3]
		if msPart == "000" {
			return norm[:idx]
		}
		return norm[:idx] + "." + msPart
	}
	return norm
}

// buildLogsWhereClause mirrors api.py's App._build_logs_where_clause. The
// returned bool is false only when sourceIDs is non-nil but empty (mirrors
// Python's `if not source_ids: return None, []`), signaling "no rows can
// possibly match, skip the query entirely".
func (a *App) buildLogsWhereClause(
	workspaceID string,
	sourceIDs []string,
	filters []models.LogFilter,
	query *string,
	startTime, endTime *string,
) (string, []any, bool) {
	whereClauses := []string{"l.workspace_id = ?"}
	params := []any{workspaceID}

	if sourceIDs != nil {
		if len(sourceIDs) == 0 {
			return "", nil, false
		}
		placeholders := make([]string, len(sourceIDs))
		for i, id := range sourceIDs {
			placeholders[i] = "?"
			params = append(params, id)
		}
		whereClauses = append(whereClauses, "l.source_id IN ("+strings.Join(placeholders, ",")+")")
	}

	if len(filters) > 0 {
		fClauses, fParams := parseFilters(filters)
		whereClauses = append(whereClauses, fClauses...)
		params = append(params, fParams...)
	}

	if query != nil && strings.TrimSpace(*query) != "" {
		llqlSQL, llqlParams := llql.ParseLLQL(*query)
		if llqlSQL != "" {
			whereClauses = append(whereClauses, "("+llqlSQL+")")
			params = append(params, llqlParams...)
		}
	}

	if startTime != nil && *startTime != "" {
		whereClauses = append(whereClauses, "l.timestamp >= ?")
		params = append(params, normalizeQueryTimestamp(*startTime))
	}
	if endTime != nil && *endTime != "" {
		whereClauses = append(whereClauses, "l.timestamp <= ?")
		params = append(params, normalizeQueryTimestamp(*endTime))
	}

	return strings.Join(whereClauses, " AND "), params, true
}

// normalizeSQLValue converts driver-specific byte-slice representations of
// text/JSON columns to plain Go strings so the result marshals cleanly to
// JSON (mirrors Python's driver, which always hands back native str/int/
// float/bool/None from DuckDB).
func normalizeSQLValue(v any) any {
	if b, ok := v.([]byte); ok {
		return string(b)
	}
	return v
}

// hydrateLog fills in raw_text/message for one log row, preferring an
// already-inlined raw_text and falling back to a fast-path mmap lookup by
// (source_id, line_id) — mirrors api.py's App._hydrate_log.
func (a *App) hydrateLog(logDict map[string]any) {
	if rt, ok := logDict["raw_text"].(string); ok && rt != "" {
		logDict["message"] = rt
		return
	}

	sourceID, _ := logDict["source_id"].(string)
	lineID, hasLineID := toInt64(logDict["line_id"])

	if sourceID != "" && hasLineID {
		if content, err := a.FastPath.GetLine(sourceID, lineID); err == nil {
			logDict["raw_text"] = content
			logDict["message"] = content
			return
		}
		logDict["raw_text"] = "<Missing log content>"
		logDict["message"] = "<Missing log content>"
		return
	}

	if logDict["raw_text"] == nil {
		logDict["raw_text"] = ""
	}
	logDict["message"] = ""
}

func toInt64(v any) (int64, bool) {
	switch t := v.(type) {
	case int64:
		return t, true
	case int32:
		return int64(t), true
	case int:
		return int64(t), true
	case float64:
		return int64(t), true
	default:
		return 0, false
	}
}

// shiftTimestamp adds shiftSec seconds to a "YYYY-MM-DD HH:MM:SS[.mmm]"
// timestamp string, mirroring api.py's App._apply_temporal_offsets inline
// parse/shift/format logic. Returns ok=false (leave the original value
// untouched) on any parse failure, matching Python's bare `except Exception:
// pass`.
func shiftTimestamp(ts string, shiftSec int64) (string, bool) {
	tsStr := strings.ReplaceAll(ts, "T", " ")
	msPart := ""
	if idx := strings.Index(tsStr, "."); idx != -1 {
		msPart = tsStr[idx:]
		tsStr = tsStr[:idx]
	}
	if len(tsStr) < 19 {
		return "", false
	}
	t, err := time.Parse("2006-01-02 15:04:05", tsStr[:19])
	if err != nil {
		return "", false
	}
	t = t.Add(time.Duration(shiftSec) * time.Second)
	return t.Format("2006-01-02 15:04:05") + msPart, true
}

// applyTemporalOffsets mirrors api.py's App._apply_temporal_offsets: shifts
// each log's timestamp by its source's configured offset, if any are
// configured for workspaceID at all (a no-op fast path when the
// temporal_offsets table has nothing for this workspace).
func (a *App) applyTemporalOffsets(workspaceID string, logs []map[string]any) {
	rows, err := a.DB.Conn.Query(
		`SELECT source_id, offset_seconds FROM temporal_offsets WHERE workspace_id = ?`, workspaceID,
	)
	if err != nil {
		return
	}
	defer rows.Close()

	offsets := make(map[string]int64)
	for rows.Next() {
		var src string
		var off int64
		if rows.Scan(&src, &off) == nil {
			offsets[src] = off
		}
	}
	if len(offsets) == 0 {
		return
	}

	for _, l := range logs {
		srcID, _ := l["source_id"].(string)
		shift := offsets[srcID]
		if shift == 0 {
			continue
		}
		ts, _ := l["timestamp"].(string)
		if ts == "" {
			continue
		}
		if shifted, ok := shiftTimestamp(ts, shift); ok {
			l["timestamp"] = shifted
		}
	}
}

// getLogsInternal is the shared fetch path behind GetLogs, mirroring api.py's
// App._get_logs_internal: builds the WHERE clause, runs a COUNT(*), then the
// paginated/sorted data query joined against `clusters` for cluster_percent,
// hydrates raw text, and applies temporal offsets.
func (a *App) getLogsInternal(
	workspaceID string,
	offset, limit int,
	filters []models.LogFilter,
	query *string,
	sortBy, sortOrder string,
	sourceIDs []string,
	startTime, endTime *string,
) map[string]any {
	whereSQL, params, ok := a.buildLogsWhereClause(workspaceID, sourceIDs, filters, query, startTime, endTime)
	if !ok {
		return map[string]any{"total": 0, "logs": []map[string]any{}, "offset": offset, "limit": limit}
	}

	var total int
	_ = a.DB.Conn.QueryRow("SELECT COUNT(*) FROM logs l WHERE "+whereSQL, params...).Scan(&total)

	baseQuery := `
		WITH workspace_total AS (
			SELECT count(*) as total_count FROM logs WHERE workspace_id = ?
		)
		SELECT
			l.*,
			c.count as _cluster_count,
			c.template as cluster_template,
			CAST(c.count AS DOUBLE) * 100.0 / NULLIF(workspace_total.total_count, 0) as cluster_percent
		FROM logs l
		CROSS JOIN workspace_total
		LEFT JOIN clusters c ON l.workspace_id = c.workspace_id AND l.cluster_id = c.cluster_id
		WHERE ` + whereSQL

	paramsForData := append([]any{workspaceID}, params...)

	finalSortBy := sortBy
	if !allowedSortFields[finalSortBy] {
		finalSortBy = "id"
	}
	if finalSortBy == "cluster_id" {
		finalSortBy = "cluster_percent"
	}
	finalSortOrder := "DESC"
	if strings.EqualFold(sortOrder, "ASC") {
		finalSortOrder = "ASC"
	}

	dataQuery := baseQuery + fmt.Sprintf(" ORDER BY %s %s, l.id %s LIMIT ? OFFSET ?", finalSortBy, finalSortOrder, finalSortOrder)
	execParams := append(append([]any{}, paramsForData...), limit, offset)

	logs := []map[string]any{}
	rows, err := a.DB.Conn.Query(dataQuery, execParams...)
	if err == nil {
		cols, _ := rows.Columns()
		for rows.Next() {
			values := make([]any, len(cols))
			ptrs := make([]any, len(cols))
			for i := range values {
				ptrs[i] = &values[i]
			}
			if scanErr := rows.Scan(ptrs...); scanErr != nil {
				continue
			}

			logDict := make(map[string]any, len(cols))
			for i, c := range cols {
				logDict[c] = normalizeSQLValue(values[i])
			}

			switch f := logDict["facets"].(type) {
			case string:
				if f == "" {
					logDict["facets"] = map[string]any{}
				} else {
					var parsed map[string]any
					if json.Unmarshal([]byte(f), &parsed) == nil {
						logDict["facets"] = parsed
					} else {
						logDict["facets"] = map[string]any{}
					}
				}
			case map[string]any:
				// go-duckdb auto-decodes the JSON-typed `facets` column into
				// a native Go value on generic (any) scans rather than raw
				// text — already the shape we want, pass through as-is.
			case nil:
				logDict["facets"] = map[string]any{}
			default:
				logDict["facets"] = map[string]any{}
			}

			a.hydrateLog(logDict)
			logs = append(logs, logDict)
		}
		rows.Close()
	}

	a.applyTemporalOffsets(workspaceID, logs)

	return map[string]any{"total": total, "logs": logs, "offset": offset, "limit": limit}
}

// GetLogs implements the get_logs RPC method, mirroring api.py's
// App.method_get_logs.
func (a *App) GetLogs(req models.GetLogsRequest) (any, *models.RPCError) {
	return a.getLogsInternal(req.WorkspaceID, req.Offset, req.Limit, req.Filters, req.Query, req.SortBy, req.SortOrder, nil, req.StartTime, req.EndTime), nil
}

// --- get_metadata_facets ---

// baseFacetKeys mirrors db.py's LogDatabase._get_facet_keys static priority
// list. Dynamic facet-key discovery (db.py's _get_dynamic_facet_keys, which
// samples the `facets` column for keys not already in this list or the
// facet_extractions rules) is NOT ported here — a known, documented parity
// gap for this core-subset wiring pass (see docs/migration/STATUS.md): a
// facet whose name isn't in this static list and wasn't defined via a
// facet_extractions rule won't surface from get_metadata_facets in Go even
// though Python would eventually discover it by sampling.
var baseFacetKeys = []string{
	"ip", "uuid", "user_id", "host", "thread", "logger", "status", "method",
	"level", "email", "http_method", "http_status",
}

func (a *App) facetKeys(workspaceID string) []string {
	keys := append([]string{}, baseFacetKeys...)
	seen := make(map[string]bool, len(keys))
	for _, k := range keys {
		seen[k] = true
	}

	global, ws, err := a.DB.FacetExtractionRulesJSON(workspaceID)
	if err == nil {
		for _, raw := range []string{global, ws} {
			if raw == "" {
				continue
			}
			var rules []struct {
				Name string `json:"name"`
			}
			if json.Unmarshal([]byte(raw), &rules) == nil {
				for _, r := range rules {
					if r.Name != "" && !seen[r.Name] {
						seen[r.Name] = true
						keys = append(keys, r.Name)
					}
				}
			}
		}
	}
	return keys
}

func sanitizeFacetKey(key string) string {
	var b strings.Builder
	for _, r := range key {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// GetMetadataFacets implements the get_metadata_facets RPC method, mirroring
// api.py's App.method_get_metadata_facets / db.py's
// LogDatabase._get_facet_aggregations (top-10-by-count values per facet
// key), minus dynamic facet-key discovery — see baseFacetKeys' doc comment.
func (a *App) GetMetadataFacets(req models.GetMetadataFacetsRequest) (any, *models.RPCError) {
	results := make(map[string]any)

	for _, key := range a.facetKeys(req.WorkspaceID) {
		var queryField string
		params := []any{req.WorkspaceID}
		whereClauses := []string{"workspace_id = ?"}

		if key == "level" {
			queryField = "level"
			whereClauses = append(whereClauses, "level IS NOT NULL")
		} else {
			safe := sanitizeFacetKey(key)
			queryField = fmt.Sprintf(`json_extract_string(facets, '$."%s"')`, safe)
			whereClauses = append(whereClauses, queryField+" IS NOT NULL")
		}

		if len(req.SourceIDs) > 0 {
			placeholders := make([]string, len(req.SourceIDs))
			for i, id := range req.SourceIDs {
				placeholders[i] = "?"
				params = append(params, id)
			}
			whereClauses = append(whereClauses, "source_id IN ("+strings.Join(placeholders, ",")+")")
		}

		q := fmt.Sprintf(
			`SELECT %s as val, count(*) as cnt FROM logs WHERE %s GROUP BY val ORDER BY cnt DESC LIMIT 10`,
			queryField, strings.Join(whereClauses, " AND "),
		)
		rows, err := a.DB.Conn.Query(q, params...)
		if err != nil {
			continue
		}

		var entries []map[string]any
		for rows.Next() {
			var val any
			var cnt int64
			if rows.Scan(&val, &cnt) == nil {
				entries = append(entries, map[string]any{
					"value": fmt.Sprintf("%v", normalizeSQLValue(val)),
					"count": cnt,
				})
			}
		}
		rows.Close()

		if len(entries) > 0 {
			results[key] = entries
		}
	}

	return results, nil
}

// --- get_log_content ---

// GetLogContent implements the get_log_content RPC method, mirroring api.py's
// App.method_get_log_content: an O(1) mmap fast-path batch read by line_id.
// The response is a positional list aligned with req.LineIDs (nil entries
// for unresolved ids), matching Python's fast_path.get_lines wire shape —
// see logstore.FastPathService.GetLines' doc comment for why its Go-native
// return shape (a map) differs internally, translated back to a list here.
func (a *App) GetLogContent(req models.GetLogContentRequest) (any, *models.RPCError) {
	ids := make([]int64, len(req.LineIDs))
	for i, id := range req.LineIDs {
		ids[i] = int64(id)
	}

	resolved, err := a.FastPath.GetLines(req.SourceID, ids)
	if err != nil {
		resolved = nil
	}

	lines := make([]any, len(ids))
	for i, id := range ids {
		if text, ok := resolved[id]; ok {
			lines[i] = text
		} else {
			lines[i] = nil
		}
	}

	return map[string]any{"lines": lines}, nil
}
