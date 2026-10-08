package app

import (
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"loglensai/backend-go/internal/db"
	"loglensai/backend-go/internal/drain3"
	"loglensai/backend-go/internal/ingestion"
	"loglensai/backend-go/internal/models"
	"loglensai/backend-go/internal/services/clustering"
	"loglensai/backend-go/internal/services/logstore"
)

// --- workspace lifecycle ---

// DeleteWorkspace implements the delete_workspace RPC method.
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

// PurgeInactiveWorkspaces implements the purge_inactive_workspaces RPC method.
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

// FactoryReset implements the factory_reset RPC method.
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
