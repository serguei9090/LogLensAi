package app

import (
	"strconv"

	"loglensai/backend-go/internal/db"
	"loglensai/backend-go/internal/models"
	"loglensai/backend-go/internal/services/clustering"
)

// GetClusters implements the get_clusters RPC method, mirroring api.py's
// App.method_get_clusters: returns every cluster currently tracked by
// workspaceID's Drain3 miner, enriched with Laya System 1 triage metadata when available.
func (a *App) GetClusters(workspaceID string) (any, *models.RPCError) {
	miner, err := a.GetDrainParser(workspaceID)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	clusters := miner.Clusters()

	var triageMap map[string]db.ClusterTriage
	if a.DB != nil {
		triageMap, _ = a.DB.GetClusterTriageMap(workspaceID)
	}

	out := make([]map[string]any, len(clusters))
	for i, c := range clusters {
		cIDStr := strconv.Itoa(c.ID)
		entry := map[string]any{"id": c.ID, "template": c.Template(), "size": c.Size}
		if t, ok := triageMap[cIDStr]; ok {
			entry["category"] = t.Category
			entry["severity"] = t.Severity
			entry["is_outage"] = t.IsOutage
			entry["confidence"] = t.Confidence
			if t.RAGTag != "" {
				entry["rag_tag"] = t.RAGTag
				entry["is_known_issue"] = t.IsKnownIssue
				entry["matched_signature"] = t.MatchedSignature
				entry["known_resolution"] = t.KnownResolution
				entry["match_score"] = t.MatchScore
			}
		}
		out[i] = entry
	}
	return out, nil
}

// GetClusteringStatus implements the get_clustering_status RPC method,
// mirroring api.py's App.method_get_clustering_status.
func (a *App) GetClusteringStatus(_ models.GetClusteringStatusRequest) (any, *models.RPCError) {
	status, err := a.Cluster.GetStatus()
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	return map[string]any{
		"mode":              string(status.Mode),
		"running":           status.Running,
		"paused":            status.Paused,
		"backlog":           status.Backlog,
		"processed_session": status.ProcessedSession,
	}, nil
}

// SetClusteringMode implements the set_clustering_mode RPC method, mirroring
// api.py's App.method_set_clustering_mode.
func (a *App) SetClusteringMode(req models.SetClusteringModeRequest) (any, *models.RPCError) {
	if err := a.Cluster.SetMode(clustering.Mode(req.Mode)); err != nil {
		return nil, &models.RPCError{Code: errInvalidParams, Message: err.Error()}
	}
	status, err := a.Cluster.GetStatus()
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	return map[string]any{"status": "success", "mode": string(status.Mode), "paused": status.Paused}, nil
}

// SetClusteringPaused implements the set_clustering_paused RPC method,
// mirroring api.py's App.method_set_clustering_paused.
func (a *App) SetClusteringPaused(req models.SetClusteringPausedRequest) (any, *models.RPCError) {
	a.Cluster.SetPaused(req.Paused)
	status, err := a.Cluster.GetStatus()
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	return map[string]any{"status": "success", "paused": status.Paused}, nil
}
