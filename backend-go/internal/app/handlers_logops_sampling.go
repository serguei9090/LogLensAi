package app

import (
	"database/sql"
	"fmt"
	"os"
	"strings"
	"unicode/utf8"

	"loglensai/backend-go/internal/models"
)

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

// ReadFile implements the read_file RPC method, mirroring api.py's
// App.method_read_file: reads the whole file as UTF-8, replacing invalid
// byte sequences rather than erroring on them.
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
