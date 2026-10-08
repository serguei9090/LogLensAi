package app

import (
	"database/sql"
	"strings"

	"github.com/google/uuid"

	"loglensai/backend-go/internal/models"
)

// --- log_source CRUD ---

// CreateLogSource implements the create_log_source RPC method, mirroring
// api.py's method_create_log_source + db.py's upsert_log_source: a fresh
// UUID id, INSERT OR REPLACE preserving any pre-existing is_uploaded flag
// for that id (irrelevant for a brand new UUID, but kept for parity since
// upsert_log_source is also reused — conceptually — by the ingest path in
// Python; this handler only ever inserts a genuinely new id).
func (a *App) CreateLogSource(req models.CreateLogSourceRequest) (any, *models.RPCError) {
	sourceID := uuid.NewString()
	var folderID any
	if req.FolderID != nil {
		folderID = *req.FolderID
	}
	if _, err := a.DB.Conn.Exec(`
		INSERT OR REPLACE INTO log_sources (id, workspace_id, folder_id, name, type, path, is_uploaded)
		VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT is_uploaded FROM log_sources WHERE id = ?), FALSE))
	`, sourceID, req.WorkspaceID, folderID, req.Name, req.Type, req.Path, sourceID); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	return map[string]any{"status": "success", "source_id": sourceID}, nil
}

// UpdateLogSource implements the update_log_source RPC method.
func (a *App) UpdateLogSource(req models.SourceUpdateRequest) (any, *models.RPCError) {
	var setClauses []string
	var params []any
	if req.Name != nil {
		setClauses = append(setClauses, "name = ?")
		params = append(params, *req.Name)
	}
	if req.Type != nil {
		setClauses = append(setClauses, "type = ?")
		params = append(params, *req.Type)
	}
	if req.Path != nil {
		setClauses = append(setClauses, "path = ?")
		params = append(params, *req.Path)
	}
	if req.FolderID != nil {
		setClauses = append(setClauses, "folder_id = ?")
		if *req.FolderID == "" {
			params = append(params, nil)
		} else {
			params = append(params, *req.FolderID)
		}
	}
	if len(setClauses) == 0 {
		return map[string]any{"status": "success"}, nil
	}
	params = append(params, req.SourceID)
	query := "UPDATE log_sources SET " + strings.Join(setClauses, ", ") + " WHERE id = ?"
	if _, err := a.DB.Conn.Exec(query, params...); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	return map[string]any{"status": "success"}, nil
}

// DeleteLogSource implements the delete_log_source RPC method.
func (a *App) DeleteLogSource(req models.DeleteLogSourceRequest) (any, *models.RPCError) {
	tx, err := a.DB.Conn.Begin()
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	if _, err := tx.Exec(`DELETE FROM logs WHERE source_id = ?`, req.SourceID); err != nil {
		_ = tx.Rollback()
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	if _, err := tx.Exec(`DELETE FROM ingestion_jobs WHERE source_id = ?`, req.SourceID); err != nil {
		_ = tx.Rollback()
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	if _, err := tx.Exec(`DELETE FROM log_sources WHERE id = ?`, req.SourceID); err != nil {
		_ = tx.Rollback()
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	if err := tx.Commit(); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}

	if err := a.LogStore.DeleteSourceFiles(req.SourceID); err != nil {
		println("[App] Error deleting physical files for source", req.SourceID, err)
	}

	return map[string]any{"status": "success"}, nil
}

// GetWorkspaceSources implements the get_workspace_sources RPC method.
func (a *App) GetWorkspaceSources(req models.GetWorkspaceSourcesRequest) (any, *models.RPCError) {
	rows, err := a.DB.Conn.Query(`SELECT DISTINCT source_id FROM logs WHERE workspace_id = ?`, req.WorkspaceID)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	set := make(map[string]struct{})
	for rows.Next() {
		var v sql.NullString
		if err := rows.Scan(&v); err != nil {
			rows.Close()
			return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
		}
		if v.Valid {
			set[v.String] = struct{}{}
		}
	}
	rerr := rows.Err()
	rows.Close()
	if rerr != nil {
		return nil, &models.RPCError{Code: errInternal, Message: rerr.Error()}
	}

	rows2, err := a.DB.Conn.Query(`SELECT path FROM log_sources WHERE workspace_id = ?`, req.WorkspaceID)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	for rows2.Next() {
		var v sql.NullString
		if err := rows2.Scan(&v); err != nil {
			rows2.Close()
			return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
		}
		if v.Valid {
			set[v.String] = struct{}{}
		}
	}
	rerr2 := rows2.Err()
	rows2.Close()
	if rerr2 != nil {
		return nil, &models.RPCError{Code: errInternal, Message: rerr2.Error()}
	}

	out := make([]string, 0, len(set))
	for v := range set {
		out = append(out, v)
	}
	return out, nil
}

// GetTimeBoundaries implements the get_time_boundaries RPC method.
func (a *App) GetTimeBoundaries(req models.GetTimeBoundariesRequest) (any, *models.RPCError) {
	where := "workspace_id = ?"
	args := []any{req.WorkspaceID}
	if len(req.SourceIDs) > 0 {
		placeholders := make([]string, len(req.SourceIDs))
		for i, sid := range req.SourceIDs {
			placeholders[i] = "?"
			args = append(args, sid)
		}
		where += " AND source_id IN (" + strings.Join(placeholders, ",") + ")"
	}

	var exists bool
	if err := a.DB.Conn.QueryRow(`SELECT EXISTS(SELECT 1 FROM logs WHERE `+where+`)`, args...).Scan(&exists); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	if !exists {
		return map[string]any{"min_time": "", "max_time": ""}, nil
	}

	var minT, maxT sql.NullString
	if err := a.DB.Conn.QueryRow(
		`SELECT MIN(timestamp), MAX(timestamp) FROM logs WHERE `+where, args...,
	).Scan(&minT, &maxT); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}

	min, max := "", ""
	if minT.Valid {
		min = minT.String
	}
	if maxT.Valid {
		max = maxT.String
	}
	return map[string]any{"min_time": min, "max_time": max}, nil
}
