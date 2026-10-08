package app

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"loglensai/backend-go/internal/models"
)

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

// RenameAISession implements the rename_ai_session RPC method.
func (a *App) RenameAISession(sessionID, name string) (any, *models.RPCError) {
	now := time.Now().UTC().Format(time.RFC3339)
	if _, err := a.DB.Conn.Exec(
		`UPDATE ai_sessions SET name = ?, last_modified = ? WHERE session_id = ?`,
		name, now, sessionID,
	); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	return map[string]any{"status": "ok"}, nil
}

// DeleteAISession implements the delete_ai_session RPC method.
func (a *App) DeleteAISession(sessionID string) (any, *models.RPCError) {
	if _, err := a.DB.Conn.Exec(`DELETE FROM ai_messages WHERE session_id = ?`, sessionID); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	if _, err := a.DB.Conn.Exec(`DELETE FROM ai_sessions WHERE session_id = ?`, sessionID); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	return map[string]any{"status": "ok"}, nil
}

// GetAIMapping implements the get_ai_mapping RPC method: {log_id: session_id}.
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

func nullStringOrNil(s sql.NullString) any {
	if !s.Valid {
		return nil
	}
	return s.String
}

// formatAnyTimestamp normalizes a scanned TIMESTAMP column into an ISO 8601 UTC string.
func formatAnyTimestamp(v any) any {
	switch t := v.(type) {
	case nil:
		return nil
	case time.Time:
		if t.IsZero() {
			return nil
		}
		return t.UTC().Format(time.RFC3339)
	case string:
		if t == "" {
			return nil
		}
		if parsed, err := time.Parse("2006-01-02 15:04:05", t); err == nil {
			return parsed.UTC().Format(time.RFC3339)
		}
		if parsed, err := time.Parse(time.RFC3339, t); err == nil {
			return parsed.UTC().Format(time.RFC3339)
		}
		return t
	case []byte:
		if len(t) == 0 {
			return nil
		}
		s := string(t)
		if parsed, err := time.Parse("2006-01-02 15:04:05", s); err == nil {
			return parsed.UTC().Format(time.RFC3339)
		}
		return s
	default:
		return fmt.Sprintf("%v", t)
	}
}
