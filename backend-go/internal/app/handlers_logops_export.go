package app

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"

	"loglensai/backend-go/internal/models"
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

// writeLogsCSV mirrors api.py's export_logs write_to_file CSV branch.
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
// Python's csv module writing a raw value.
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

// writeLogsJSON mirrors api.py's export_logs JSON branch.
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
