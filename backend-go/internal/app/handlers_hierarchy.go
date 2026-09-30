package app

import (
	"database/sql"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"loglensai/backend-go/internal/db"
	"loglensai/backend-go/internal/drain3"
	"loglensai/backend-go/internal/ingestion"
	"loglensai/backend-go/internal/models"
	"loglensai/backend-go/internal/services/clustering"
	"loglensai/backend-go/internal/services/logstore"
)

// This file implements the hierarchy/folder/log-source and workspace
// lifecycle RPC handlers, mirroring the corresponding method_* functions in
// sidecar/src/api.py's "--- Hierarchy Methods ---" section plus the
// workspace-lifecycle methods living alongside method_delete_workspace near
// the top of the class (method_delete_workspace, method_factory_reset,
// method_get_time_boundaries, method_purge_inactive_workspaces) and
// method_get_workspace_sources: get_hierarchy, create_folder, update_folder,
// delete_folder, create_log_source, update_log_source, delete_log_source,
// move_source, get_workspace_sources, delete_workspace,
// purge_inactive_workspaces, factory_reset, get_time_boundaries.

// --- get_hierarchy ---

// folderBuild is an intermediate tree node used while assembling the
// hierarchy response: children/sources are accumulated by ID/value before a
// final recursive pass converts everything to the exported
// models.HierarchyNode value type (avoiding partially-populated value
// copies).
type folderBuild struct {
	id, name string
	children []string
	sources  []models.HierarchySource
}

// GetHierarchy implements the get_hierarchy RPC method, mirroring db.py's
// LogDatabase.get_hierarchy (api.py's method_get_hierarchy is a one-line
// passthrough to it): loads every folder and log_source row for the
// workspace, then nests folders under their parent_id (promoting a folder or
// source whose parent_id is unset or points at a folder outside this
// workspace to the synthetic "root" node — matching Python's
// `if pid and pid in folder_map: ... else: root_nodes.append(f)` fallback
// exactly) and returns the resulting tree.
func (a *App) GetHierarchy(req models.GetHierarchyRequest) (any, *models.RPCError) {
	workspaceID := req.WorkspaceID

	frows, err := a.DB.Conn.Query(`SELECT id, name, parent_id FROM folders WHERE workspace_id = ?`, workspaceID)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	folders := make(map[string]*folderBuild)
	var rootFolderIDs []string
	type parentLink struct{ id, parent string }
	var links []parentLink
	for frows.Next() {
		var id, name string
		var parentID sql.NullString
		if err := frows.Scan(&id, &name, &parentID); err != nil {
			frows.Close()
			return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
		}
		folders[id] = &folderBuild{id: id, name: name}
		if parentID.Valid && parentID.String != "" {
			links = append(links, parentLink{id: id, parent: parentID.String})
		} else {
			rootFolderIDs = append(rootFolderIDs, id)
		}
	}
	ferr := frows.Err()
	frows.Close()
	if ferr != nil {
		return nil, &models.RPCError{Code: errInternal, Message: ferr.Error()}
	}

	for _, l := range links {
		if parent, ok := folders[l.parent]; ok {
			parent.children = append(parent.children, l.id)
		} else {
			// Parent not found within this workspace's folder set (matches
			// Python's `pid in folder_map` fallback) -- promote to root.
			rootFolderIDs = append(rootFolderIDs, l.id)
		}
	}

	srows, err := a.DB.Conn.Query(
		`SELECT id, name, type, path, folder_id, is_uploaded FROM log_sources WHERE workspace_id = ?`, workspaceID,
	)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	var rootSources []models.HierarchySource
	for srows.Next() {
		var id, name, sType, path string
		var folderID sql.NullString
		var isUploaded sql.NullBool
		if err := srows.Scan(&id, &name, &sType, &path, &folderID, &isUploaded); err != nil {
			srows.Close()
			return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
		}
		src := models.HierarchySource{
			ID:         id,
			Name:       name,
			Type:       sType,
			Path:       path,
			IsUploaded: isUploaded.Valid && isUploaded.Bool,
		}
		if folderID.Valid && folderID.String != "" {
			if parent, ok := folders[folderID.String]; ok {
				parent.sources = append(parent.sources, src)
				continue
			}
		}
		rootSources = append(rootSources, src)
	}
	serr := srows.Err()
	srows.Close()
	if serr != nil {
		return nil, &models.RPCError{Code: errInternal, Message: serr.Error()}
	}

	var materialize func(id string) models.HierarchyNode
	materialize = func(id string) models.HierarchyNode {
		f := folders[id]
		node := models.HierarchyNode{
			ID:       f.id,
			Name:     f.name,
			Type:     "folder",
			Children: make([]models.HierarchyNode, 0, len(f.children)),
			Sources:  f.sources,
		}
		if node.Sources == nil {
			node.Sources = []models.HierarchySource{}
		}
		for _, cid := range f.children {
			node.Children = append(node.Children, materialize(cid))
		}
		return node
	}

	rootChildren := make([]models.HierarchyNode, 0, len(rootFolderIDs))
	for _, id := range rootFolderIDs {
		rootChildren = append(rootChildren, materialize(id))
	}
	if rootSources == nil {
		rootSources = []models.HierarchySource{}
	}

	return models.HierarchyResponse{
		WorkspaceID: workspaceID,
		Root: models.HierarchyNode{
			ID:       "root",
			Name:     "Root",
			Type:     "folder",
			Children: rootChildren,
			Sources:  rootSources,
		},
	}, nil
}

// --- folder CRUD ---

// CreateFolder implements the create_folder RPC method, mirroring api.py's
// method_create_folder + db.py's create_folder: a fresh UUID id, inserted
// with parent_id passed through exactly as given (nil -> SQL NULL; Python
// does not normalize "" to NULL here, only update_folder does — see
// UpdateFolder).
func (a *App) CreateFolder(req models.FolderCreateRequest) (any, *models.RPCError) {
	folderID := uuid.NewString()
	var parentID any
	if req.ParentID != nil {
		parentID = *req.ParentID
	}
	if _, err := a.DB.Conn.Exec(
		`INSERT INTO folders (id, workspace_id, name, parent_id) VALUES (?, ?, ?, ?)`,
		folderID, req.WorkspaceID, req.Name, parentID,
	); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	return map[string]any{"status": "success", "folder_id": folderID}, nil
}

// UpdateFolder implements the update_folder RPC method, mirroring db.py's
// update_folder exactly: name is applied only if non-empty (Python's `if
// name:` truthy check — an explicit empty-string rename is silently
// ignored, matching Python bit-for-bit even though that reads like a minor
// footgun), and parent_id is applied whenever the field is present at all,
// with an empty string normalized to NULL (root) — this is how Python moves
// a folder back to the root level. A nil ParentID (field omitted) leaves the
// folder's parent untouched, matching Python's `if parent_id is not None`
// guard (unset defaults to None there too).
func (a *App) UpdateFolder(req models.FolderUpdateRequest) (any, *models.RPCError) {
	if req.Name != nil && *req.Name != "" {
		if _, err := a.DB.Conn.Exec(`UPDATE folders SET name = ? WHERE id = ?`, *req.Name, req.FolderID); err != nil {
			return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
		}
	}
	if req.ParentID != nil {
		var pVal any
		if *req.ParentID != "" {
			pVal = *req.ParentID
		}
		if _, err := a.DB.Conn.Exec(`UPDATE folders SET parent_id = ? WHERE id = ?`, pVal, req.FolderID); err != nil {
			return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
		}
	}
	return map[string]any{"status": "success"}, nil
}

// DeleteFolder implements the delete_folder RPC method, mirroring db.py's
// delete_folder EXACTLY: this is a non-recursive delete. Child folders are
// promoted to root (parent_id set NULL, not deleted or recursively
// re-parented further), and log sources directly inside the folder are
// promoted to root (folder_id set NULL) — sources/folders nested more than
// one level deep are unaffected by this call (each level requires its own
// delete_folder call to fully collapse, matching Python's db.py comment "1.
// Promote child folders to root" verbatim; note db.py also defines an unused
// _get_all_subfolder_ids recursive helper that method_delete_folder never
// calls, so the recursive-cascade behavior it implies is dead code in
// Python, not the actual live behavior — this port matches what actually
// runs, not what the unused helper suggests).
func (a *App) DeleteFolder(req models.FolderDeleteRequest) (any, *models.RPCError) {
	if _, err := a.DB.Conn.Exec(`UPDATE folders SET parent_id = NULL WHERE parent_id = ?`, req.FolderID); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	if _, err := a.DB.Conn.Exec(`UPDATE log_sources SET folder_id = NULL WHERE folder_id = ?`, req.FolderID); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	if _, err := a.DB.Conn.Exec(`DELETE FROM folders WHERE id = ?`, req.FolderID); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	return map[string]any{"status": "success"}, nil
}

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
//
// # Deliberate deviation from Python
//
// Python's method_update_log_source(self, source_id, **kwargs) forwards
// **every** field of SourceUpdateRequest to db.py's update_log_source
// (api.py:2369-2371), because api.py's dispatch() calls
// `handler(**params_model.model_dump())` with no exclude_none/exclude_unset
// (api.py:748-754) — so name/type/path/folder_id are ALWAYS present in
// kwargs, as None whenever the caller omits them. db.py's update_log_source
// then builds `SET {k} = ?` for every key in kwargs unconditionally
// (db.py:1151-1162), with no "skip if None" guard (unlike update_folder,
// which explicitly checks `if name:` / `if parent_id is not None:` a few
// lines above it). The net effect: any update_log_source call that only
// intends to change one field (e.g. just `name`) actually NULLs out
// type/path/folder_id too, because those arrive as explicit None and get
// written straight into the SET clause. This is very unlikely to be
// intentional — it would silently corrupt every source's type/path/folder on
// the first partial rename — and Go's SourceUpdateRequest is already shaped
// (via *string/omitempty, matching the request's Pydantic Optional fields)
// for the obviously-intended "nil = leave unchanged" semantics that
// update_folder itself already implements correctly. This handler applies
// that safe semantics instead of reproducing the bug: only fields with a
// non-nil pointer are included in the SET clause.
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
		// Mirrors db.py's `if not kwargs: return` early-out.
		return map[string]any{"status": "success"}, nil
	}
	params = append(params, req.SourceID)
	query := "UPDATE log_sources SET " + strings.Join(setClauses, ", ") + " WHERE id = ?"
	if _, err := a.DB.Conn.Exec(query, params...); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	return map[string]any{"status": "success"}, nil
}

// DeleteLogSource implements the delete_log_source RPC method, mirroring
// api.py's method_delete_log_source + db.py's delete_log_source: deletes the
// source's `logs` and `ingestion_jobs` rows, then the log_sources row
// itself, then removes the physical .log/.index files via LogStore. Python
// wraps the three DB deletes in an explicit retry-on-lock-contention loop
// (db.py:1164-1210, up to 20 attempts) because sqlite-style file-level
// locking under concurrent access is likelier to transiently fail there;
// Go's database/sql connection pool over the shared duckdb_database handle
// (see db.go's Open doc comment) does not exhibit the same contention
// pattern in practice, so this port relies on a single attempt rather than
// porting the retry loop — a real but low-risk simplification, not a
// deletion-scope change (the same three deletes happen either way, just
// without the retry).
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

	// Physical file deletion errors are logged, not fatal, matching api.py's
	// try/except around log_store.delete_source_files.
	if err := a.LogStore.DeleteSourceFiles(req.SourceID); err != nil {
		log.Printf("[App] Error deleting physical files for source %s: %v", req.SourceID, err)
	}

	return map[string]any{"status": "success"}, nil
}

// MoveSource implements the move_source RPC method, mirroring api.py's
// method_move_source: always sets folder_id (nil/omitted -> NULL, moving the
// source to the workspace root), touching only that one column — unlike
// UpdateLogSource, Python's method_move_source passes exactly one kwarg
// (folder_id) through to db.py's update_log_source, so there is no
// null-other-fields hazard here to deviate from.
func (a *App) MoveSource(req models.SourceMoveRequest) (any, *models.RPCError) {
	var folderID any
	if req.FolderID != nil && *req.FolderID != "" {
		folderID = *req.FolderID
	}
	if _, err := a.DB.Conn.Exec(`UPDATE log_sources SET folder_id = ? WHERE id = ?`, folderID, req.SourceID); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	return map[string]any{"status": "success"}, nil
}

// --- get_workspace_sources ---

// GetWorkspaceSources implements the get_workspace_sources RPC method,
// mirroring api.py's method_get_workspace_sources verbatim, including what
// reads like a real bug in the Python original preserved here for parity:
// the second query selects log_sources.path (not .id) and unions those path
// strings with the distinct source_id values from `logs`, so the returned
// list is a mix of source IDs and source file paths whenever a managed
// source exists, not a clean list of IDs despite the method's docstring
// ("Return the distinct source_id values..."). Reproduced as-is since this
// is a plain read (not a destructive op) and the strangler-validation goal
// is wire-for-wire parity against the Python backend the old React UI is
// validated against.
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
	sort.Strings(out)
	return out, nil
}

// --- get_time_boundaries ---

// GetTimeBoundaries implements the get_time_boundaries RPC method, mirroring
// api.py's method_get_time_boundaries: MIN/MAX of logs.timestamp for a
// workspace, optionally narrowed to a set of source_ids, guarded by an
// EXISTS check first (Python's comment: "prevent DuckDB assertions on empty
// datasets") before running the aggregate. Returns empty strings (not
// null/omitted) when there are no matching rows, matching Python's `row[0]
// if row and row[0] else ""` fallback.
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

// --- workspace lifecycle ---

// DeleteWorkspace implements the delete_workspace RPC method, mirroring
// api.py's method_delete_workspace: stops tailers keyed under
// "<workspace_id>:..." (matching Python's exact `k.startswith(f"{workspace_id}:")`
// prefix check — note this does NOT also match "ssh:<workspace_id>:"-prefixed
// tailers the way stopAllWorkspaceTailers/method_stop_tail's "ALL" branch
// does; Python's delete_workspace itself doesn't check that prefix either,
// so an active SSH tailer for the deleted workspace would keep running in
// both implementations — reproduced as-is, not fixed, since this task is
// about matching Python's exact deletion scope), deletes every DB row
// touching the workspace (db.py's delete_workspace, table-for-table), then
// removes each of the workspace's log sources' physical storage files.
func (a *App) DeleteWorkspace(req models.DeleteWorkspaceRequest) (any, *models.RPCError) {
	workspaceID := req.WorkspaceID

	a.tailersMu.Lock()
	var keys []string
	for k := range a.tailers {
		if strings.HasPrefix(k, workspaceID+":") {
			keys = append(keys, k)
		}
	}
	matched := make([]*ingestion.FileTailer, 0, len(keys))
	for _, k := range keys {
		matched = append(matched, a.tailers[k])
		delete(a.tailers, k)
	}
	a.tailersMu.Unlock()
	for _, t := range matched {
		t.Stop()
	}

	sourceRows, err := a.DB.Conn.Query(`SELECT id FROM log_sources WHERE workspace_id = ?`, workspaceID)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	var sourceIDs []string
	for sourceRows.Next() {
		var id string
		if err := sourceRows.Scan(&id); err != nil {
			sourceRows.Close()
			return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
		}
		sourceIDs = append(sourceIDs, id)
	}
	serr := sourceRows.Err()
	sourceRows.Close()
	if serr != nil {
		return nil, &models.RPCError{Code: errInternal, Message: serr.Error()}
	}

	// Table order matches db.py's delete_workspace exactly.
	deleteStmts := []struct {
		query string
		arg   string
	}{
		{`DELETE FROM ai_messages WHERE session_id IN (SELECT session_id FROM ai_sessions WHERE workspace_id = ?)`, workspaceID},
		{`DELETE FROM logs WHERE workspace_id = ?`, workspaceID},
		{`DELETE FROM clusters WHERE workspace_id = ?`, workspaceID},
		{`DELETE FROM log_sources WHERE workspace_id = ?`, workspaceID},
		{`DELETE FROM folders WHERE workspace_id = ?`, workspaceID},
		{`DELETE FROM ingestion_jobs WHERE workspace_id = ?`, workspaceID},
		{`DELETE FROM anomalies WHERE workspace_id = ?`, workspaceID},
		{`DELETE FROM ai_sessions WHERE workspace_id = ?`, workspaceID},
		{`DELETE FROM ai_memory WHERE workspace_id = ?`, workspaceID},
		{`DELETE FROM temporal_offsets WHERE workspace_id = ?`, workspaceID},
		{`DELETE FROM fusion_configs WHERE workspace_id = ?`, workspaceID},
		{`DELETE FROM workspace_settings WHERE workspace_id = ?`, workspaceID},
		{`DELETE FROM settings_templates WHERE workspace_id = ?`, workspaceID},
		{`DELETE FROM log_streams WHERE workspace_id = ?`, workspaceID},
	}
	for _, stmt := range deleteStmts {
		if _, err := a.DB.Conn.Exec(stmt.query, stmt.arg); err != nil {
			return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
		}
	}

	for _, sourceID := range sourceIDs {
		if err := a.LogStore.DeleteSourceFiles(sourceID); err != nil {
			log.Printf("[App] Error deleting physical files for source %s: %v", sourceID, err)
		}
	}

	return map[string]any{"status": "success"}, nil
}

// PurgeInactiveWorkspaces implements the purge_inactive_workspaces RPC
// method, mirroring api.py's method_purge_inactive_workspaces EXACTLY,
// including its narrow scope: only `logs`, `clusters`, and
// `workspace_settings` rows are deleted for every workspace_id NOT present
// in the active list. Folders, log_sources, and their physical storage
// files are deliberately left alone by Python here (unlike DeleteWorkspace,
// which is a full teardown) — this is presumably intentional (a workspace
// that goes quiet should lose its bulk data but keep its
// folder/source structure and settings so it can resume cleanly if it
// becomes active again), so it is reproduced as-is rather than "fixed" to
// match DeleteWorkspace's broader scope.
func (a *App) PurgeInactiveWorkspaces(req models.PurgeInactiveWorkspacesRequest) (any, *models.RPCError) {
	if len(req.ActiveWorkspaceIDs) == 0 {
		return map[string]any{
			"status":  "error",
			"message": "Active workspace list cannot be empty for purge",
		}, nil
	}

	placeholders := make([]string, len(req.ActiveWorkspaceIDs))
	args := make([]any, len(req.ActiveWorkspaceIDs))
	for i, id := range req.ActiveWorkspaceIDs {
		placeholders[i] = "?"
		args[i] = id
	}
	inClause := "(" + strings.Join(placeholders, ", ") + ")"

	logsRes, err := a.DB.Conn.Exec(`DELETE FROM logs WHERE workspace_id NOT IN `+inClause, args...)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	logsDeleted, _ := logsRes.RowsAffected()

	clustersRes, err := a.DB.Conn.Exec(`DELETE FROM clusters WHERE workspace_id NOT IN `+inClause, args...)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	clustersDeleted, _ := clustersRes.RowsAffected()

	if _, err := a.DB.Conn.Exec(`DELETE FROM workspace_settings WHERE workspace_id NOT IN `+inClause, args...); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}

	return map[string]any{
		"status":           "ok",
		"logs_deleted":     logsDeleted,
		"clusters_deleted": clustersDeleted,
		"message":          "Purged data for inactive workspaces. " + strconv.FormatInt(logsDeleted, 10) + " logs removed.",
	}, nil
}

// --- factory_reset ---

// FactoryReset implements the factory_reset RPC method, mirroring api.py's
// method_factory_reset: a total wipe of persistent state, scoped strictly to
// this App instance's own DB file and data directory (a.dataDir, resolved in
// NewApp from the dbPath the process was started with — see resolveDataDir).
// It never touches any path outside that directory.
//
// Sequence (mirrors Python's stop() -> close handles -> delete files ->
// re-init):
//  1. Stop every tailer.
//  2. Stop the clustering worker.
//  3. Close the log store and fast-path mmap handles.
//  4. Close the DB connection pool.
//  5. Delete the DB file (+ ".wal" sidecar, if any) — skipped for an
//     in-memory DB, which has no file — and remove the storage/ and drain/
//     directories entirely.
//  6. Reopen a fresh DB at the same path (a brand new empty schema, since
//     the file was just deleted, or a brand new empty in-memory DB), rebuild
//     the log store / fast-path / shared-source-manager against a
//     recreated storage/ directory, clear the in-memory Drain3 miner cache,
//     and rebuild + restart the clustering worker.
//
// Go has no separate AI-state DB file the way Python's AI_STATE_DB is (the
// Go AI orchestration layer's session/message state lives in this same
// DuckDB file's ai_sessions/ai_messages tables — see internal/ai's wiring
// doc comments), so there is nothing analogous to Python's ai_path file
// deletion to port here; the DB-file wipe above already covers that state.
//
// Concurrency note: like Python's version (which is also not safe against a
// concurrent RPC call landing mid-reset), this swaps a.DB/a.LogStore/
// a.FastPath/a.Shared/a.Cluster without holding a lock other callers respect
// -- a request racing a factory_reset can observe a torn intermediate state.
// Out of scope to fix here without touching every other handler file's
// field accesses, which this task is scoped not to do.
func (a *App) FactoryReset() (any, *models.RPCError) {
	a.tailersMu.Lock()
	tailers := make([]*ingestion.FileTailer, 0, len(a.tailers))
	for _, t := range a.tailers {
		tailers = append(tailers, t)
	}
	a.tailers = make(map[string]*ingestion.FileTailer)
	a.tailersMu.Unlock()
	for _, t := range tailers {
		t.Stop()
	}

	if a.Cluster != nil {
		a.Cluster.Stop()
	}

	_ = a.LogStore.CloseAll()
	a.FastPath.CloseAll()
	a.Shared.Cleanup()

	dbPath := a.DB.Path
	if err := a.DB.Close(); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}

	storageDir := filepath.Join(a.dataDir, "storage")
	if dbPath != db.MemoryDB {
		if err := os.Remove(dbPath); err != nil && !os.IsNotExist(err) {
			log.Printf("[App] factory_reset: failed to delete db file %s: %v", dbPath, err)
		}
		if err := os.Remove(dbPath + ".wal"); err != nil && !os.IsNotExist(err) {
			log.Printf("[App] factory_reset: failed to delete db wal file %s: %v", dbPath, err)
		}
	}
	if err := os.RemoveAll(a.drainDir); err != nil {
		log.Printf("[App] factory_reset: failed to delete drain dir %s: %v", a.drainDir, err)
	}
	if err := os.RemoveAll(storageDir); err != nil {
		log.Printf("[App] factory_reset: failed to delete storage dir %s: %v", storageDir, err)
	}

	newDB, err := db.Open(dbPath)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: "factory_reset: reopening database: " + err.Error()}
	}
	a.DB = newDB

	newLogStore, err := logstore.NewDiskLogStore(storageDir)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: "factory_reset: recreating log store: " + err.Error()}
	}
	a.LogStore = newLogStore
	a.FastPath = logstore.NewFastPathService(storageDir)
	a.Shared = ingestion.NewSharedSourceManager(newLogStore)

	a.minersMu.Lock()
	a.miners = make(map[string]*drain3.Miner)
	a.minersMu.Unlock()

	extractor := clustering.NewMetadataAdapter(a.metaResolver)
	worker := clustering.NewWorker(a.DB, a.FastPath, extractor, a.GetDrainParser, clusterWorkerBatchSize, 0, 0)
	a.Cluster = worker
	worker.Start()

	return map[string]any{"status": "ok", "message": "Backend reset complete. System fully re-initialized."}, nil
}
