package app

import (
	"time"

	"loglensai/backend-go/internal/models"
)

// GetHealth implements the get_health RPC method, mirroring api.py's
// App.method_get_health. The clustering quarantine_size metric is always 0
// here: Go's clustering.Worker has no retry-quarantine map (see
// clustering.LineHydrator's doc comment — a hydration miss commits directly
// to MISSING instead of being retried across cycles), so there is nothing
// to report a size for.
func (a *App) GetHealth() (any, *models.RPCError) {
	var totalLogs, totalClusters int64
	_ = a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM logs`).Scan(&totalLogs)
	_ = a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM clusters`).Scan(&totalClusters)

	a.tailersMu.Lock()
	activeTailers := make([]string, 0, len(a.tailers))
	for k, t := range a.tailers {
		if t.Running() {
			activeTailers = append(activeTailers, k)
		}
	}
	a.tailersMu.Unlock()

	clusteringRunning := false
	if status, err := a.Cluster.GetStatus(); err == nil {
		clusteringRunning = status.Running
	}

	return map[string]any{
		"status": "ok",
		"uptime": int64(time.Since(a.startTime).Seconds()),
		"database": map[string]any{
			"logs":     totalLogs,
			"clusters": totalClusters,
		},
		"active_tailers": len(activeTailers),
		"tailer_keys":    activeTailers,
		"hydration": map[string]any{
			"misses":          a.FastPath.HydrateMisses(),
			"quarantine_size": 0,
		},
		"workers": map[string]any{
			"clustering": clusteringRunning,
			"ingestion":  true,
		},
	}, nil
}
