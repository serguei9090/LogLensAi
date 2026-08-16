package app

import (
	"strings"

	"loglensai/backend-go/internal/ingestion"
	"loglensai/backend-go/internal/models"
)

// StartTail implements the start_tail RPC method, mirroring api.py's
// App.method_start_tail: registers (idempotently) and starts a FileTailer
// keyed by source_id if given, else by "<workspace_id>:<abs_path>".
func (a *App) StartTail(req models.StartTailRequest) (any, *models.RPCError) {
	absPath := normalizeAbsPath(req.Filepath)
	var sourceID string
	if req.SourceID != nil {
		sourceID = *req.SourceID
	}
	key := sourceID
	if key == "" {
		key = req.WorkspaceID + ":" + absPath
	}

	a.tailersMu.Lock()
	if t, ok := a.tailers[key]; ok && t.Running() {
		a.tailersMu.Unlock()
		return map[string]any{"status": "already tailing"}, nil
	}
	tailer := ingestion.NewFileTailer(absPath, req.WorkspaceID, a.DB, a.Shared, sourceID)
	a.tailers[key] = tailer
	a.tailersMu.Unlock()

	tailer.Start()
	return map[string]any{"status": "started", "source_id": req.SourceID}, nil
}

// StopTail implements the stop_tail RPC method, mirroring api.py's
// App.method_stop_tail, including its "ALL" sentinel (stop every tailer for
// the workspace) and its substring-match fallback for keys that don't match
// the primary source_id/path key exactly (e.g. SSH-prefixed keys).
func (a *App) StopTail(req models.StartTailRequest) (any, *models.RPCError) {
	if req.Filepath == "ALL" {
		count := a.stopAllWorkspaceTailers(req.WorkspaceID)
		return map[string]any{"status": "stopped", "count": count}, nil
	}

	absPath := normalizeAbsPath(req.Filepath)
	var sourceID string
	if req.SourceID != nil {
		sourceID = *req.SourceID
	}
	key := sourceID
	if key == "" {
		key = req.WorkspaceID + ":" + absPath
	}

	a.tailersMu.Lock()
	if t, ok := a.tailers[key]; ok {
		delete(a.tailers, key)
		a.tailersMu.Unlock()
		t.Stop()
		return map[string]any{"status": "stopped", "count": 1, "source_id": req.SourceID}, nil
	}

	var matchKeys []string
	for k := range a.tailers {
		if (strings.HasPrefix(k, req.WorkspaceID+":") || strings.HasPrefix(k, "ssh:"+req.WorkspaceID+":")) &&
			strings.Contains(k, req.Filepath) {
			matchKeys = append(matchKeys, k)
		}
	}
	matched := make([]*ingestion.FileTailer, 0, len(matchKeys))
	for _, k := range matchKeys {
		matched = append(matched, a.tailers[k])
		delete(a.tailers, k)
	}
	a.tailersMu.Unlock()

	for _, t := range matched {
		t.Stop()
	}

	status := "not found"
	if len(matched) > 0 {
		status = "stopped"
	}
	return map[string]any{"status": status, "count": len(matched)}, nil
}

// stopAllWorkspaceTailers stops and unregisters every tailer keyed under
// workspaceID (plain or "ssh:"-prefixed), mirroring api.py's
// App._stop_all_workspace_tailers.
func (a *App) stopAllWorkspaceTailers(workspaceID string) int {
	a.tailersMu.Lock()
	var keys []string
	for k := range a.tailers {
		if strings.HasPrefix(k, workspaceID+":") || strings.HasPrefix(k, "ssh:"+workspaceID+":") {
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
	return len(matched)
}

// IsTailing implements the is_tailing RPC method, mirroring api.py's
// App.method_is_tailing.
func (a *App) IsTailing(filepath, workspaceID string) bool {
	key := workspaceID + ":" + normalizeAbsPath(filepath)
	a.tailersMu.Lock()
	defer a.tailersMu.Unlock()
	t, ok := a.tailers[key]
	return ok && t.Running()
}
