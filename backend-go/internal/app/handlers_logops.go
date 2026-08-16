// This file wires the "log data operations" RPC subset onto *App: delete,
// export, sampling, per-source parser/fusion config, fused-log interleaving,
// comments, raw file reading, SSH tailing, trace logging, and ingestion-job
// management. Mirrors the corresponding method_* handlers in
// sidecar/src/api.py (grep that file for the exact method name, e.g.
// "def method_delete_logs", to cross-reference any handler below).
//
// Scope note: this is a NEW file (per docs/migration/STATUS.md's
// method-group ownership split for this migration pass) so it deliberately
// does not touch app.go / handlers_query.go / handlers_tail.go /
// handlers_ingest.go / handlers_misc.go / handlers_cluster.go -- it only
// adds new methods on *App and reuses already-exported/unexported helpers
// those files define (getLogsInternal, parseFilters, normalizeQueryTimestamp,
// normalizeAbsPath, errInternal, a.tailers/a.tailersMu, a.dataDir, ...),
// since everything in this file lives in the same package.
package app

import (
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"loglensai/backend-go/internal/ingestion"
	"loglensai/backend-go/internal/models"
	llql "loglensai/backend-go/internal/query"
)

// --- delete_logs ---

// DeleteLogs implements the delete_logs RPC method, mirroring db.py's
// LogDatabase.delete_logs (called directly by api.py's method_delete_logs,
// which takes no filter parameters despite what a first glance at "delete
// logs with an optional filter" might suggest -- Python's actual signature
// is `(workspace_id: str, source_id: str | None = None)`, no LLQL/structured
// filters at all). When source_id is given, the workspace's whole cluster
// cache is rebuilt from the surviving rows using a placeholder "Pattern
// <id>" template (losing the real Drain3 template text) -- a pre-existing
// simplification in the Python original, reproduced verbatim rather than
// "fixed" here.
func (a *App) DeleteLogs(req models.DeleteLogsRequest) (any, *models.RPCError) {
	sourceID := ""
	if req.SourceID != nil {
		sourceID = *req.SourceID
	}

	if sourceID != "" {
		if _, err := a.DB.Conn.Exec(`DELETE FROM logs WHERE workspace_id = ? AND source_id = ?`, req.WorkspaceID, sourceID); err != nil {
			return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
		}
		if _, err := a.DB.Conn.Exec(`DELETE FROM clusters WHERE workspace_id = ?`, req.WorkspaceID); err != nil {
			return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
		}
		if _, err := a.DB.Conn.Exec(`
			INSERT INTO clusters (workspace_id, cluster_id, template, count)
			SELECT workspace_id, cluster_id, 'Pattern ' || cluster_id, count(*)
			FROM logs WHERE workspace_id = ? AND cluster_id IS NOT NULL GROUP BY workspace_id, cluster_id
		`, req.WorkspaceID); err != nil {
			return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
		}
	} else {
		if _, err := a.DB.Conn.Exec(`DELETE FROM logs WHERE workspace_id = ?`, req.WorkspaceID); err != nil {
			return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
		}
		if _, err := a.DB.Conn.Exec(`DELETE FROM clusters WHERE workspace_id = ?`, req.WorkspaceID); err != nil {
			return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
		}
	}

	return map[string]any{"status": "success"}, nil
}

// --- export_logs ---

// exportColumnOrder is the CSV header order export_logs writes, reconstructed
// from api.py's SQL SELECT clause behind _get_logs_internal/get_fused_logs
// (`l.*, c.count as _cluster_count, c.template as cluster_template,
// cluster_percent`, then `message` appended last by _hydrate_log) minus
// `_cluster_count` (api.py's CSV writer drops every key starting with "_").
// Python's dict preserves this exact insertion order naturally; Go's
// map[string]any (what getLogsInternal returns per row) does not, so this
// fixed list reconstructs the same visible column order deterministically
// rather than depending on Go map iteration order.
var exportColumnOrder = []string{
	"id", "workspace_id", "source_id", "line_id", "raw_text", "timestamp", "ingest_timestamp",
	"level", "cluster_id", "has_comment", "comment", "facets", "processed",
	"cluster_template", "cluster_percent", "message",
}

// ExportLogs implements the export_logs RPC method, mirroring api.py's
// App.method_export_logs.
//
// Deviation note (intentional, matches an actual Python quirk): Python
// routes the non-fusion export path through method_get_logs, whose
// GetLogsRequest pydantic model has NO source_ids field -- so
// ExportLogsRequest.source_ids is silently dropped by pydantic's
// extra="ignore" default before _get_logs_internal ever sees it, meaning
// source_ids has NO effect on a non-fusion export in the real Python
// backend today. The fusion path similarly ignores it (fused exports are
// restricted by fusion_configs' enabled sources, not req.source_ids). This
// port reproduces that behavior exactly: ExportLogsRequest.SourceIDs is
// deliberately never read here.
func (a *App) ExportLogs(req models.ExportLogsRequest) (any, *models.RPCError) {
	format := req.Format
	if format == "" {
		format = "csv"
	}

	var logs []map[string]any
	if req.FusionID != nil && *req.FusionID != "" {
		fusedReq := models.GetFusedLogsRequest{
			WorkspaceID: req.WorkspaceID,
			FusionID:    *req.FusionID,
			Offset:      0,
			Limit:       1000000,
			Filters:     req.Filters,
			Query:       req.Query,
			SortBy:      "id",
			SortOrder:   "DESC",
			StartTime:   req.StartTime,
			EndTime:     req.EndTime,
		}
		res, rpcErr := a.GetFusedLogs(fusedReq)
		if rpcErr != nil {
			return nil, rpcErr
		}
		if m, ok := res.(map[string]any); ok {
			logs, _ = m["logs"].([]map[string]any)
		}
	} else {
		result := a.getLogsInternal(req.WorkspaceID, 0, 1000000, req.Filters, req.Query, "id", "DESC", nil, req.StartTime, req.EndTime)
		logs, _ = result["logs"].([]map[string]any)
	}

	var count int
	var err error
	if format == "csv" {
		count, err = writeLogsCSV(req.Filepath, logs)
	} else {
		count, err = writeLogsJSON(req.Filepath, logs)
	}
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}

	return map[string]any{"status": "ok", "count": count}, nil
}

// writeLogsCSV mirrors api.py's export_logs write_to_file CSV branch:
// csv.DictWriter with header = every non-"_"-prefixed key of the first row,
// UTF-8, "\r\n" line endings (Python's csv module default dialect, which is
// why the caller opens the file with newline="" -- Go's csv.Writer needs
// UseCRLF explicitly to match).
func writeLogsCSV(path string, logs []map[string]any) (int, error) {
	f, err := os.Create(path)
	if err != nil {
		return 0, err
	}
	defer f.Close()

	if len(logs) == 0 {
		return 0, nil
	}

	var header []string
	for _, col := range exportColumnOrder {
		if _, ok := logs[0][col]; ok {
			header = append(header, col)
		}
	}

	w := csv.NewWriter(f)
	w.UseCRLF = true
	if err := w.Write(header); err != nil {
		return 0, err
	}
	for _, row := range logs {
		rec := make([]string, len(header))
		for i, col := range header {
			rec[i] = csvFieldValue(row[col])
		}
		if err := w.Write(rec); err != nil {
			return 0, err
		}
	}
	w.Flush()
	if err := w.Error(); err != nil {
		return 0, err
	}
	return len(logs), nil
}

// csvFieldValue formats one cell, mirroring the effective behavior of
// Python's csv module writing a raw (non-string) Python value: None becomes
// an empty field, bool becomes "True"/"False" (Python's str(bool)).
//
// Deviation: a dict/list value (only ever the `facets` column here) is
// JSON-encoded rather than reproduced as Python's str(dict) single-quoted
// repr syntax (e.g. Python would write {'ip': '1.2.3.4'}, this writes
// {"ip":"1.2.3.4"}) -- a cosmetic difference confined to that one column,
// judged not worth hand-rolling a Python-repr formatter for.
func csvFieldValue(v any) string {
	switch t := v.(type) {
	case nil:
		return ""
	case string:
		return t
	case bool:
		if t {
			return "True"
		}
		return "False"
	case map[string]any:
		b, _ := json.Marshal(t)
		return string(b)
	default:
		return fmt.Sprintf("%v", t)
	}
}

// writeLogsJSON mirrors api.py's export_logs JSON branch: json.dump(logs, f,
// indent=2). Go's encoding/json sorts map keys alphabetically when
// marshaling a map[string]any, whereas Python's dict preserves insertion
// (SQL column) order -- a cosmetic-only difference (both are valid JSON with
// identical key/value content; JSON object member order is not semantically
// significant), not worth a custom ordered-marshaler for.
func writeLogsJSON(path string, logs []map[string]any) (int, error) {
	if logs == nil {
		logs = []map[string]any{}
	}
	b, err := json.MarshalIndent(logs, "", "  ")
	if err != nil {
		return 0, err
	}
	if err := os.WriteFile(path, b, 0o644); err != nil {
		return 0, err
	}
	return len(logs), nil
}

// --- get_sample_lines / update_source_parser ---

// GetSampleLines implements the get_sample_lines RPC method, mirroring
// api.py's App.method_get_sample_lines: the first `limit` line_ids for
// (workspace_id, source_id), hydrated via the fast-path mmap reader (an
// unresolved line becomes "", matching Python's `... or ""`).
func (a *App) GetSampleLines(req models.GetSampleLinesRequest) (any, *models.RPCError) {
	limit := req.Limit
	if limit <= 0 {
		limit = 10 // Python's pydantic default when the field is omitted.
	}

	rows, err := a.DB.Conn.Query(`SELECT line_id FROM logs WHERE workspace_id = ? AND source_id = ? LIMIT ?`, req.WorkspaceID, req.SourceID, limit)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	defer rows.Close()

	var lineIDs []int64
	for rows.Next() {
		var id sql.NullInt64
		if rows.Scan(&id) == nil && id.Valid {
			lineIDs = append(lineIDs, id.Int64)
		}
	}

	lines := make([]string, len(lineIDs))
	for i, id := range lineIDs {
		text, getErr := a.FastPath.GetLine(req.SourceID, id)
		if getErr != nil {
			text = ""
		}
		lines[i] = text
	}
	return lines, nil
}

// UpdateSourceParser implements the update_source_parser RPC method,
// mirroring api.py's App.method_update_source_parser -- including that it
// updates every fusion_configs row for (workspace_id, source_id) regardless
// of fusion_id (Python's UPDATE has no fusion_id predicate either).
func (a *App) UpdateSourceParser(req models.UpdateSourceParserRequest) (any, *models.RPCError) {
	if _, err := a.DB.Conn.Exec(`UPDATE fusion_configs SET parser_config = ? WHERE workspace_id = ? AND source_id = ?`,
		req.ParserConfig, req.WorkspaceID, req.SourceID); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	return map[string]any{"status": "ok"}, nil
}

// --- get_fusion_config / update_fusion_config / get_fused_logs ---

// defaultFusionID compensates for a documented, pre-existing gap in this
// migration (see internal/models/shared.go's package doc comment): Go has
// no pydantic-style default-substitution at the transport layer, so a
// request that omits fusion_id decodes to "" rather than Python's "default".
// Applied at each fusion handler below rather than fixed at the transport
// layer, since that layer's simplification is deliberately shared/global.
func defaultFusionID(id string) string {
	if id == "" {
		return "default"
	}
	return id
}

// GetFusionConfig implements the get_fusion_config RPC method, mirroring
// api.py's App.method_get_fusion_config.
func (a *App) GetFusionConfig(req models.GetFusionConfigRequest) (any, *models.RPCError) {
	fusionID := defaultFusionID(req.FusionID)

	rows, err := a.DB.Conn.Query(
		`SELECT source_id, enabled, tz_offset, custom_format, parser_config FROM fusion_configs WHERE workspace_id = ? AND fusion_id = ?`,
		req.WorkspaceID, fusionID,
	)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	defer rows.Close()

	sources := []map[string]any{}
	for rows.Next() {
		var sourceID string
		var enabled bool
		var tzOffset int64
		var customFormat, parserConfig sql.NullString
		if err := rows.Scan(&sourceID, &enabled, &tzOffset, &customFormat, &parserConfig); err != nil {
			continue
		}
		m := map[string]any{"source_id": sourceID, "enabled": enabled, "tz_offset": tzOffset}
		if customFormat.Valid {
			m["custom_format"] = customFormat.String
		} else {
			m["custom_format"] = nil
		}
		if parserConfig.Valid {
			m["parser_config"] = parserConfig.String
		} else {
			m["parser_config"] = nil
		}
		sources = append(sources, m)
	}

	return map[string]any{"sources": sources}, nil
}

// UpdateFusionConfig implements the update_fusion_config RPC method,
// mirroring api.py's App.method_update_fusion_config: one upsert per source
// entry.
func (a *App) UpdateFusionConfig(req models.UpdateFusionConfigRequest) (any, *models.RPCError) {
	fusionID := defaultFusionID(req.FusionID)

	for _, src := range req.Sources {
		if _, err := a.DB.Conn.Exec(`
			INSERT INTO fusion_configs (workspace_id, fusion_id, source_id, enabled, tz_offset, custom_format, parser_config)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT (workspace_id, fusion_id, source_id) DO UPDATE SET
				enabled = excluded.enabled,
				tz_offset = excluded.tz_offset,
				custom_format = excluded.custom_format,
				parser_config = excluded.parser_config
		`, req.WorkspaceID, fusionID, src.SourceID, src.Enabled, src.TzOffset, src.CustomFormat, src.ParserConfig); err != nil {
			return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
		}
	}

	return map[string]any{"status": "ok"}, nil
}

// GetFusedLogs implements the get_fused_logs RPC method, mirroring api.py's
// App.method_get_fused_logs: resolve enabled sources + their tz_offset from
// fusion_configs, delegate to the shared log fetcher restricted to those
// sources, then shift each returned log's timestamp by its source's
// tz_offset (hours).
func (a *App) GetFusedLogs(req models.GetFusedLogsRequest) (any, *models.RPCError) {
	fusionID := defaultFusionID(req.FusionID)

	rows, err := a.DB.Conn.Query(
		`SELECT source_id, tz_offset FROM fusion_configs WHERE workspace_id = ? AND fusion_id = ? AND enabled = TRUE`,
		req.WorkspaceID, fusionID,
	)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	// Deliberately non-nil even when zero rows match: getLogsInternal's
	// "sourceIDs != nil but empty" check must trigger the same "no sources
	// enabled -> zero results" short-circuit api.py's
	// `_get_logs_internal(source_ids=[])` produces (see
	// buildLogsWhereClause's doc comment in handlers_query.go).
	enabledIDs := []string{}
	tzOffsets := map[string]int64{}
	for rows.Next() {
		var id string
		var tz int64
		if rows.Scan(&id, &tz) == nil {
			enabledIDs = append(enabledIDs, id)
			tzOffsets[id] = tz
		}
	}
	rows.Close()

	result := a.getLogsInternal(req.WorkspaceID, req.Offset, req.Limit, req.Filters, req.Query, req.SortBy, req.SortOrder, enabledIDs, req.StartTime, req.EndTime)

	if logs, ok := result["logs"].([]map[string]any); ok {
		for _, logRow := range logs {
			srcID, _ := logRow["source_id"].(string)
			offset := tzOffsets[srcID]
			if offset == 0 {
				continue
			}
			ts, _ := logRow["timestamp"].(string)
			if ts == "" {
				continue
			}
			if shifted, ok := shiftFusionTimestamp(ts, offset); ok {
				logRow["timestamp"] = shifted
			}
		}
	}

	return result, nil
}

// shiftFusionTimestamp adds offsetHours hours to a "YYYY-MM-DD
// HH:MM:SS[...]" timestamp, mirroring api.py's get_fused_logs inline
// shift block exactly -- including that, unlike _apply_temporal_offsets
// (see handlers_query.go's shiftTimestamp), it does NOT preserve a
// fractional-seconds suffix: the reformatted string is always
// "YYYY-MM-DD HH:MM:SS", silently truncating milliseconds if present. This
// is a real difference between the two Python offset mechanisms (temporal
// offsets vs. fusion tz_offset), reproduced deliberately, not a bug in this
// port.
func shiftFusionTimestamp(ts string, offsetHours int64) (string, bool) {
	tsStr := strings.ReplaceAll(ts, "T", " ")
	if len(tsStr) < 19 {
		return "", false
	}
	t, err := time.Parse("2006-01-02 15:04:05", tsStr[:19])
	if err != nil {
		return "", false
	}
	t = t.Add(time.Duration(offsetHours) * time.Hour)
	return t.Format("2006-01-02 15:04:05"), true
}

// --- get_sample_logs ---

// GetSampleLogs implements the get_sample_logs RPC method, mirroring api.py's
// App.method_get_sample_logs: up to `limit` (clamped [1,50]) random raw_text
// values sampled from the first 200 rows (by id) for the workspace, or
// optionally restricted to one source.
func (a *App) GetSampleLogs(req models.GetSampleLogsRequest) (any, *models.RPCError) {
	limit := req.Limit
	if limit == 0 {
		limit = 10 // Python's pydantic default when the field is omitted.
	}
	if limit > 50 {
		limit = 50
	}
	if limit < 1 {
		limit = 1
	}

	var rows *sql.Rows
	var err error
	if req.SourceID != nil && *req.SourceID != "" {
		rows, err = a.DB.Conn.Query(`SELECT raw_text FROM (
				SELECT raw_text, id FROM logs
				WHERE workspace_id = ? AND source_id = ? AND raw_text IS NOT NULL
				ORDER BY id ASC LIMIT 200
			) ORDER BY RANDOM() LIMIT ?`, req.WorkspaceID, *req.SourceID, limit)
	} else {
		rows, err = a.DB.Conn.Query(`SELECT raw_text FROM (
				SELECT raw_text, id FROM logs
				WHERE workspace_id = ? AND raw_text IS NOT NULL
				ORDER BY id ASC LIMIT 200
			) ORDER BY RANDOM() LIMIT ?`, req.WorkspaceID, limit)
	}
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	defer rows.Close()

	samples := []string{}
	for rows.Next() {
		var raw sql.NullString
		if rows.Scan(&raw) == nil && raw.Valid && raw.String != "" {
			samples = append(samples, raw.String)
		}
	}
	return map[string]any{"samples": samples}, nil
}

// --- update_log_comment ---

// UpdateLogComment implements the update_log_comment RPC method, mirroring
// api.py's App.method_update_log_comment: sets/clears a log row's comment
// and toggles has_comment based on whether the new comment is non-empty.
func (a *App) UpdateLogComment(req models.UpdateCommentRequest) (any, *models.RPCError) {
	if _, err := a.DB.Conn.Exec(`
		UPDATE logs
		SET comment = ?,
			has_comment = CASE WHEN length(?) > 0 THEN TRUE ELSE FALSE END
		WHERE id = ?
	`, req.Comment, req.Comment, req.LogID); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	return map[string]any{"status": "success"}, nil
}

// --- read_file ---

// ReadFile implements the read_file RPC method, mirroring api.py's
// App.method_read_file: reads the whole file as UTF-8, replacing invalid
// byte sequences (matching Python's `errors="replace"`) rather than
// erroring on them.
func (a *App) ReadFile(req models.ReadFileRequest) (any, *models.RPCError) {
	absPath := normalizeAbsPath(req.Filepath)
	if _, err := os.Stat(absPath); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: fmt.Sprintf("File not found: %s", absPath)}
	}
	raw, err := os.ReadFile(absPath)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	return decodeUTF8Replace(raw), nil
}

// decodeUTF8Replace decodes b as UTF-8, substituting U+FFFD for each invalid
// byte, matching Python's open(..., errors="replace") behavior for the
// common case of isolated invalid bytes.
func decodeUTF8Replace(b []byte) string {
	var sb strings.Builder
	sb.Grow(len(b))
	for len(b) > 0 {
		r, size := utf8.DecodeRune(b)
		if r == utf8.RuneError && size <= 1 {
			sb.WriteRune(utf8.RuneError)
			b = b[1:]
			continue
		}
		sb.WriteRune(r)
		b = b[size:]
	}
	return sb.String()
}

// --- start_ssh_tail ---

// sshIngestors holds the "ingestor" SSHLoader half of each SSH-tailed
// source, keyed per *App instance (so multiple App instances in tests don't
// collide) and then by the same "ingestor:ssh:<source_id>" key api.py's
// self.tailers dict uses. This can't live as an *App struct field without
// editing app.go (out of scope for this file/pass -- see the package doc
// comment at the top of this file), so it is a package-level registry
// instead; a.tailers (the App struct field, accessible here since this file
// is still package app) continues to hold the "subscriber" FileTailer half,
// exactly like Python's self.tailers holds both under different keys.
//
// Known parity note: because ingestor entries never live in a.tailers,
// stop_tail (handlers_tail.go) can never reach them -- it only ever matches
// keys starting with "<workspace_id>:" or "ssh:<workspace_id>:", and the
// ingestor key here is "ingestor:ssh:<source_id>". This exactly mirrors
// api.py's method_stop_tail, which has the identical blind spot (its
// ingestor_key = f"ingestor:ssh:{eff_source_id}" is likewise never matched
// by _stop_all_workspace_tailers' or method_stop_tail's key-prefix checks).
// A real SSH connection leak on stop_tail is a pre-existing Python behavior,
// reproduced here rather than silently fixed.
var (
	sshIngestorsMu sync.Mutex
	sshIngestors   = make(map[*App]map[string]*ingestion.SSHLoader)
)

func (a *App) registerSSHIngestor(key string, loader *ingestion.SSHLoader) {
	sshIngestorsMu.Lock()
	defer sshIngestorsMu.Unlock()
	m, ok := sshIngestors[a]
	if !ok {
		m = make(map[string]*ingestion.SSHLoader)
		sshIngestors[a] = m
	}
	m[key] = loader
}

func (a *App) sshIngestor(key string) (*ingestion.SSHLoader, bool) {
	sshIngestorsMu.Lock()
	defer sshIngestorsMu.Unlock()
	m, ok := sshIngestors[a]
	if !ok {
		return nil, false
	}
	l, ok := m[key]
	return l, ok
}

// StartSSHTail implements the start_ssh_tail RPC method, mirroring api.py's
// App.method_start_ssh_tail: starts (idempotently) a shared SSHLoader
// "ingestor" plus a workspace-scoped FileTailer "subscriber", both keyed by
// the resolved source_id.
func (a *App) StartSSHTail(req models.StartSSHTailRequest) (any, *models.RPCError) {
	effWorkspaceID := req.WorkspaceID
	if effWorkspaceID == "" {
		effWorkspaceID = "default"
	}
	effFilepath := req.Filepath

	effSourceID := ""
	if req.SourceID != nil {
		effSourceID = *req.SourceID
	}
	if effSourceID == "" {
		effSourceID = fmt.Sprintf("ssh:%s:%s:%s", effWorkspaceID, req.Host, effFilepath)
	}

	key := effSourceID
	a.tailersMu.Lock()
	_, exists := a.tailers[key]
	a.tailersMu.Unlock()
	if exists {
		return map[string]any{"status": "already tailing"}, nil
	}

	port := req.Port
	if port == 0 {
		port = 22 // Python's pydantic default when the field is omitted.
	}
	password := ""
	if req.Password != nil {
		password = *req.Password
	}

	ingestorKey := "ingestor:ssh:" + effSourceID
	if _, ok := a.sshIngestor(ingestorKey); !ok {
		loader := ingestion.NewSSHLoader(req.Host, port, req.Username, password, effFilepath, effSourceID, a.Shared)
		a.registerSSHIngestor(ingestorKey, loader)
		loader.Start()
	}

	subscriber := ingestion.NewFileTailer(effFilepath, effWorkspaceID, a.DB, a.Shared, effSourceID)
	a.tailersMu.Lock()
	a.tailers[key] = subscriber
	a.tailersMu.Unlock()
	subscriber.Start()

	return map[string]any{"status": "started", "source_id": effSourceID}, nil
}

// --- log_trace ---

var traceFileMu sync.Mutex

// LogTrace implements the log_trace RPC method, mirroring api.py's
// App.method_log_trace / trace_ingestion_event: appends one line to
// "<PROJECT_ROOT>/logs/ingestion_trace.log", gated behind the
// INGESTION_TRACE=true env var (exact string match, same as Python's
// `os.getenv("INGESTION_TRACE") != "true"` guard), a no-op otherwise. The
// RPC always reports success either way, matching Python (the guard is
// inside trace_ingestion_event, which method_log_trace never checks the
// return of).
func (a *App) LogTrace(req models.LogTraceRequest) (any, *models.RPCError) {
	if os.Getenv("INGESTION_TRACE") == "true" {
		traceFileMu.Lock()
		defer traceFileMu.Unlock()

		// a.dataDir is PROJECT_ROOT/data's Go analogue (see app.go's DataDir
		// doc comment); PROJECT_ROOT/logs is therefore its sibling.
		logDir := filepath.Join(filepath.Dir(a.dataDir), "logs")
		if err := os.MkdirAll(logDir, 0o755); err == nil {
			logPath := filepath.Join(logDir, "ingestion_trace.log")
			ts := time.Now().Format("2006-01-02 15:04:05.000")
			line := fmt.Sprintf("[%s] [Backend] [Frontend] %s\n", ts, req.Message)
			if f, openErr := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644); openErr == nil {
				_, _ = f.WriteString(line)
				_ = f.Close()
			}
		}
	}
	return map[string]any{"status": "success"}, nil
}

// --- cleanup_ingestion_jobs / get_ingestion_jobs ---

// CleanupIngestionJobs implements the cleanup_ingestion_jobs RPC method,
// mirroring api.py's App.method_cleanup_ingestion_jobs: purges jobs that
// never made progress (processed_lines = 0) and are either explicitly
// failed, or older than 30 minutes.
func (a *App) CleanupIngestionJobs(req models.CleanupIngestionJobsRequest) (any, *models.RPCError) {
	cutoff := time.Now().Add(-30 * time.Minute).Format("2006-01-02 15:04:05")
	res, err := a.DB.Conn.Exec(
		`DELETE FROM ingestion_jobs WHERE workspace_id = ? AND processed_lines = 0 AND (status = 'failed' OR created_at < CAST(? AS TIMESTAMP))`,
		req.WorkspaceID, cutoff,
	)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	count, _ := res.RowsAffected()
	return map[string]any{"status": "success", "purged_count": count}, nil
}

// pyIsoFormat mirrors Python's datetime.isoformat(): "YYYY-MM-DDTHH:MM:SS",
// with a ".ffffff" microsecond suffix appended only when the value has a
// nonzero fractional-second component (Python omits it entirely rather than
// printing ".000000").
func pyIsoFormat(t time.Time) string {
	base := t.Format("2006-01-02T15:04:05")
	if t.Nanosecond() == 0 {
		return base
	}
	return fmt.Sprintf("%s.%06d", base, t.Nanosecond()/1000)
}

// GetIngestionJobs implements the get_ingestion_jobs RPC method, mirroring
// db.py's LogDatabase.get_ingestion_jobs (called directly by api.py's
// method_get_ingestion_jobs): lists jobs (optionally scoped to one
// workspace, else the 50 most recent overall), with a computed
// queue_position -- 1-based rank by (created_at, id) among each workspace's
// currently-active (queued/processing/pending) jobs, 0 for everything else.
func (a *App) GetIngestionJobs(req models.GetIngestionJobsRequest) (any, *models.RPCError) {
	var rows *sql.Rows
	var err error
	if req.WorkspaceID != nil && *req.WorkspaceID != "" {
		rows, err = a.DB.Conn.Query(
			`SELECT id, workspace_id, source_id, status, total_lines, processed_lines, created_at, updated_at
			 FROM ingestion_jobs WHERE workspace_id = ? ORDER BY created_at DESC`,
			*req.WorkspaceID,
		)
	} else {
		rows, err = a.DB.Conn.Query(
			`SELECT id, workspace_id, source_id, status, total_lines, processed_lines, created_at, updated_at
			 FROM ingestion_jobs ORDER BY created_at DESC LIMIT 50`,
		)
	}
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	defer rows.Close()

	type ingestionJob struct {
		id                       int64
		workspaceID, sourceID    string
		status                   string
		totalLines, processedLines int64
		createdAt, updatedAt     sql.NullTime
	}
	var jobs []ingestionJob
	for rows.Next() {
		var j ingestionJob
		if scanErr := rows.Scan(&j.id, &j.workspaceID, &j.sourceID, &j.status, &j.totalLines, &j.processedLines, &j.createdAt, &j.updatedAt); scanErr != nil {
			continue
		}
		jobs = append(jobs, j)
	}

	type activeEntry struct {
		idx       int
		createdAt time.Time
		id        int64
	}
	activeByWS := map[string][]activeEntry{}
	for i, j := range jobs {
		if j.status == "queued" || j.status == "processing" || j.status == "pending" {
			activeByWS[j.workspaceID] = append(activeByWS[j.workspaceID], activeEntry{idx: i, createdAt: j.createdAt.Time, id: j.id})
		}
	}
	queuePos := make(map[int]int, len(jobs))
	for _, entries := range activeByWS {
		sort.Slice(entries, func(x, y int) bool {
			if entries[x].createdAt.Equal(entries[y].createdAt) {
				return entries[x].id < entries[y].id
			}
			return entries[x].createdAt.Before(entries[y].createdAt)
		})
		for pos, e := range entries {
			queuePos[e.idx] = pos + 1
		}
	}

	result := make([]map[string]any, len(jobs))
	for i, j := range jobs {
		m := map[string]any{
			"id": j.id, "workspace_id": j.workspaceID, "source_id": j.sourceID,
			"status": j.status, "total_lines": j.totalLines, "processed_lines": j.processedLines,
			"queue_position": queuePos[i],
		}
		if j.createdAt.Valid {
			m["created_at"] = pyIsoFormat(j.createdAt.Time)
		} else {
			m["created_at"] = nil
		}
		if j.updatedAt.Valid {
			m["updated_at"] = pyIsoFormat(j.updatedAt.Time)
		} else {
			m["updated_at"] = nil
		}
		result[i] = m
	}
	return result, nil
}

// --- get_log_distribution ---

// distributionIntervalSpec pairs a bucket width with both the DuckDB
// strftime format text (%-style, embedded verbatim into the SQL query, same
// as api.py does) and the equivalent Go reference-time layout (used for
// local Go-side slot-label generation in buildDistributionSlots) -- Python
// gets away with one format string for both jobs since datetime.strftime
// and DuckDB's strftime share the same %-code system; Go's time.Format does
// not, so this port needs both spellings of each format.
type distributionIntervalSpec struct {
	delta      time.Duration
	duckFormat string
	goLayout   string
}

// distributionIntervals mirrors api.py's INTERVALS dict verbatim (module
// constants INTERVAL_1_SEC.."30_days").
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

// determineBucketInterval ports api.py's _determine_bucket_interval. Reused
// from handlers_ai_extra.go (the dashboard-stats method group, wired
// concurrently against this same package by another migration pass), which
// already defines a package-level function of this exact name/behavior for
// its own bucket-interval selection -- not redefined here to avoid a
// duplicate-declaration collision between the two new files.
//
// parseFlexibleTs ports api.py's module-level _parse_ts: tries progressively
// shorter "YYYY-MM-DD[ HH[:MM[:SS]]]"-family formats against the
// T/Z-normalized, trimmed input, returning the first that parses.
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

// parseStrictTs19 ports the inline parse api.py's _determine_distribution_bounds
// uses for its duration-of-window calculation: normalize T/Z, then strictly
// parse the first 19 characters as "YYYY-MM-DD HH:MM:SS" (no format
// fallback chain, unlike parseFlexibleTs).
func parseStrictTs19(s string) (time.Time, bool) {
	norm := strings.ReplaceAll(strings.ReplaceAll(s, "T", " "), "Z", "")
	if len(norm) < 19 {
		return time.Time{}, false
	}
	t, err := time.Parse("2006-01-02 15:04:05", norm[:19])
	return t, err == nil
}

// floorToBucket ports api.py's _floor_to_bucket: floor t to the nearest
// multiple of delta since the Unix epoch.
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

// buildDistributionSlots ports api.py's _build_distribution_slots: the full,
// zero-filled bucket-label grid between startTs and endTs (inclusive),
// capped at 500 slots -- the "extended_bounds"/"min_doc_count:0" behavior
// method_get_log_distribution's doc comment refers to.
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

// buildDistributionWhereClause ports api.py's
// App._build_distribution_where_clause: same shape as buildLogsWhereClause
// (handlers_query.go) but source restriction can additionally come from
// resolving a fusion_id against fusion_configs, and neither workspace_id nor
// the start/end time comparisons use the "l." alias buildLogsWhereClause's
// filters/query DO use (via the shared parseFilters helper) -- both quirks
// reproduced from Python exactly, since the query this feeds always aliases
// `logs` as `l` and is a single-table query, so the inconsistency is
// harmless there too.
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

// determineDistributionBounds ports api.py's _determine_distribution_bounds:
// resolve missing start/end bounds from MIN/MAX(timestamp) over the
// filtered set, then compute the window's duration in seconds (defaulting
// to 3600 on any parse failure or missing data, matching Python's
// try/except-wrapped block).
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
// mirroring api.py's App.method_get_log_distribution: time-bucketed log
// counts broken down by level, with the bucket width chosen dynamically from
// the query window's duration, and empty buckets zero-filled across the
// full window (Kibana-style extended_bounds / min_doc_count:0).
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
