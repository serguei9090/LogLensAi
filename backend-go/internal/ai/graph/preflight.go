// Assume Role: The Backend Engineer (@backend)

package graph

import (
	"database/sql"
	"fmt"
	"sort"
	"strings"

	"loglensai/backend-go/internal/app"
)

// CatalogSource represents a single log source/file in the workspace.
type CatalogSource struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Path     string `json:"path"`
	LogCount int    `json:"log_count"`
}

// ErrorLogSnippet represents an authoritative error log extracted directly from the database.
type ErrorLogSnippet struct {
	ID         int64  `json:"id"`
	Timestamp  string `json:"timestamp"`
	Level      string `json:"level"`
	Message    string `json:"message"`
	SourceID   string `json:"source_id"`
	SourceName string `json:"source_name"`
	ClusterID  string `json:"cluster_id"`
}

// ClusterTriageSummary holds Laya System 1 evaluated triage info for an active cluster.
type ClusterTriageSummary struct {
	ClusterID  string  `json:"cluster_id"`
	Template   string  `json:"template"`
	Category   string  `json:"category"`
	Severity   float64 `json:"severity"`
	IsOutage   bool    `json:"is_outage"`
	Confidence float64 `json:"confidence"`
}

// WorkspaceInventory stores the pre-flight ground-truth facts for the active workspace.
type WorkspaceInventory struct {
	WorkspaceID    string                 `json:"workspace_id"`
	WorkspaceName  string                 `json:"workspace_name"`
	Catalogs       []CatalogSource        `json:"catalogs"`
	TotalLogs      int                    `json:"total_logs"`
	LevelCounts    map[string]int         `json:"level_counts"`
	ErrorCount     int                    `json:"error_count"`
	RecentErrors   []ErrorLogSnippet      `json:"recent_errors"`
	ActiveClusters int                    `json:"active_clusters"`
	ClusterTriages []ClusterTriageSummary `json:"cluster_triages"`
	MinTimestamp   string                 `json:"min_timestamp"`
	MaxTimestamp   string                 `json:"max_timestamp"`
}

func resolveWorkspaceID(a *app.App, inputID string) string {
	cleaned := strings.TrimSpace(inputID)
	if cleaned == "" || strings.EqualFold(cleaned, "default") || strings.EqualFold(cleaned, "default-ws") || strings.EqualFold(cleaned, "default workspace") {
		return "default-ws"
	}
	if a == nil || a.DB == nil || a.DB.Conn == nil {
		return cleaned
	}

	var count int
	_ = a.DB.Conn.QueryRow(`SELECT count(*) FROM log_sources WHERE workspace_id = ?`, cleaned).Scan(&count)
	if count > 0 {
		return cleaned
	}
	_ = a.DB.Conn.QueryRow(`SELECT count(*) FROM logs WHERE workspace_id = ?`, cleaned).Scan(&count)
	if count > 0 {
		return cleaned
	}

	var matchedID string
	err := a.DB.Conn.QueryRow(`SELECT workspace_id FROM log_sources WHERE LOWER(workspace_id) = LOWER(?) LIMIT 1`, cleaned).Scan(&matchedID)
	if err == nil && matchedID != "" {
		return matchedID
	}

	var anyWs string
	if err := a.DB.Conn.QueryRow(`SELECT workspace_id FROM logs WHERE workspace_id IS NOT NULL AND workspace_id != '' LIMIT 1`).Scan(&anyWs); err == nil && anyWs != "" {
		return anyWs
	}
	if err := a.DB.Conn.QueryRow(`SELECT workspace_id FROM log_sources WHERE workspace_id IS NOT NULL AND workspace_id != '' LIMIT 1`).Scan(&anyWs); err == nil && anyWs != "" {
		return anyWs
	}

	return cleaned
}

// InspectWorkspace collects ground-truth stats directly from DuckDB in <5ms.
func InspectWorkspace(a *app.App, workspaceID string) (*WorkspaceInventory, error) {
	if a == nil || a.DB == nil || a.DB.Conn == nil {
		return nil, fmt.Errorf("app database not available")
	}

	wsID := resolveWorkspaceID(a, workspaceID)
	inv := &WorkspaceInventory{
		WorkspaceID: wsID,
		LevelCounts: make(map[string]int),
		Catalogs:    make([]CatalogSource, 0),
	}

	if wsID == "default-ws" || wsID == "default" {
		inv.WorkspaceName = "Default Workspace"
	} else {
		inv.WorkspaceName = wsID
	}

	// 1. Fetch catalogs / sources
	srcMap := make(map[string]*CatalogSource)
	sRows, err := a.DB.Conn.Query(`SELECT id, name, path FROM log_sources WHERE workspace_id = ?`, wsID)
	if err == nil {
		defer sRows.Close()
		for sRows.Next() {
			var cs CatalogSource
			if scanErr := sRows.Scan(&cs.ID, &cs.Name, &cs.Path); scanErr == nil {
				srcMap[cs.ID] = &cs
			}
		}
	}

	// 2. Count logs per source
	cRows, err := a.DB.Conn.Query(`SELECT source_id, count(*) FROM logs WHERE workspace_id = ? GROUP BY source_id`, wsID)
	if err == nil {
		defer cRows.Close()
		for cRows.Next() {
			var sID sql.NullString
			var count int
			if scanErr := cRows.Scan(&sID, &count); scanErr == nil && sID.Valid {
				if cs, exists := srcMap[sID.String]; exists {
					cs.LogCount = count
				} else {
					srcMap[sID.String] = &CatalogSource{
						ID:       sID.String,
						Name:     "unnamed_source",
						LogCount: count,
					}
				}
			}
		}
	}

	for _, cs := range srcMap {
		inv.Catalogs = append(inv.Catalogs, *cs)
	}
	sort.Slice(inv.Catalogs, func(i, j int) bool {
		return inv.Catalogs[i].Name < inv.Catalogs[j].Name
	})

	// 3. Count logs per level & total logs
	lRows, err := a.DB.Conn.Query(`SELECT level, count(*) FROM logs WHERE workspace_id = ? GROUP BY level`, wsID)
	if err == nil {
		defer lRows.Close()
		for lRows.Next() {
			var lvl sql.NullString
			var count int
			if scanErr := lRows.Scan(&lvl, &count); scanErr == nil {
				levelStr := strings.ToUpper(strings.TrimSpace(lvl.String))
				if levelStr == "" {
					levelStr = "UNKNOWN"
				}
				inv.LevelCounts[levelStr] += count
				inv.TotalLogs += count
				if levelStr == "ERROR" || levelStr == "FATAL" || strings.Contains(levelStr, "ERR") {
					inv.ErrorCount += count
				}
			}
		}
	}

	// 4. Fetch recent error log snippets
	eRows, err := a.DB.Conn.Query(`
		SELECT l.id, l.timestamp, l.level, l.raw_text, l.source_id, COALESCE(s.name, ''), COALESCE(l.cluster_id, '')
		FROM logs l
		LEFT JOIN log_sources s ON l.source_id = s.id
		WHERE l.workspace_id = ? AND (l.level = 'ERROR' OR l.level = 'FATAL' OR LOWER(l.level) LIKE '%err%')
		ORDER BY l.timestamp DESC LIMIT 5
	`, wsID)
	if err == nil {
		defer eRows.Close()
		for eRows.Next() {
			var snip ErrorLogSnippet
			var srcID sql.NullString
			if scanErr := eRows.Scan(&snip.ID, &snip.Timestamp, &snip.Level, &snip.Message, &srcID, &snip.SourceName, &snip.ClusterID); scanErr == nil {
				if srcID.Valid {
					snip.SourceID = srcID.String
				}
				if snip.SourceName == "" && snip.SourceID != "" {
					if cs, ok := srcMap[snip.SourceID]; ok {
						snip.SourceName = cs.Name
					}
				}
				inv.RecentErrors = append(inv.RecentErrors, snip)
			}
		}
	}

	// 5. Active clusters count
	_ = a.DB.Conn.QueryRow(`SELECT count(DISTINCT cluster_id) FROM logs WHERE workspace_id = ? AND cluster_id IS NOT NULL AND cluster_id != ''`, wsID).Scan(&inv.ActiveClusters)

	// 6. Time Range Bounds
	var minTs, maxTs sql.NullString
	_ = a.DB.Conn.QueryRow(`SELECT CAST(min(timestamp) AS VARCHAR), CAST(max(timestamp) AS VARCHAR) FROM logs WHERE workspace_id = ?`, wsID).Scan(&minTs, &maxTs)
	if minTs.Valid {
		inv.MinTimestamp = minTs.String
	}
	if maxTs.Valid {
		inv.MaxTimestamp = maxTs.String
	}

	// 7. Active Cluster Triage Information (from Laya System 1 Triage)
	tRows, err := a.DB.Conn.Query(`
		SELECT cluster_id, template, category, severity, is_outage, confidence
		FROM cluster_triage
		WHERE workspace_id = ?
		ORDER BY severity DESC, confidence DESC
		LIMIT 8
	`, wsID)
	if err == nil {
		defer tRows.Close()
		for tRows.Next() {
			var ct ClusterTriageSummary
			if scanErr := tRows.Scan(&ct.ClusterID, &ct.Template, &ct.Category, &ct.Severity, &ct.IsOutage, &ct.Confidence); scanErr == nil {
				inv.ClusterTriages = append(inv.ClusterTriages, ct)
			}
		}
	}

	return inv, nil
}

// FormatGroundedSystemPromptContext produces an un-hallucinatable fact block to inject into LLM system prompt.
func (inv *WorkspaceInventory) FormatGroundedSystemPromptContext() string {
	var sb strings.Builder
	sb.WriteString("\n\n[Active Workspace Context]\n")
	sb.WriteString(fmt.Sprintf("Active Workspace: %q (ID: %q)\n", inv.WorkspaceName, inv.WorkspaceID))
	sb.WriteString(fmt.Sprintf("Total Logs: %d, Total Error Logs: %d, Active Clusters: %d\n", inv.TotalLogs, inv.ErrorCount, inv.ActiveClusters))
	if inv.MinTimestamp != "" && inv.MaxTimestamp != "" {
		sb.WriteString(fmt.Sprintf("Observed Log Time Range: %s to %s\n", inv.MinTimestamp, inv.MaxTimestamp))
	}
	sb.WriteString("Attached Catalogs/Files:\n")
	for _, c := range inv.Catalogs {
		sb.WriteString(fmt.Sprintf(" - %s (source_id: %q, lines: %d)\n", c.Name, c.ID, c.LogCount))
	}
	if len(inv.ClusterTriages) > 0 {
		sb.WriteString("Known Cluster Categories (from Laya Triage):\n")
		for _, ct := range inv.ClusterTriages {
			outageTag := ""
			if ct.IsOutage {
				outageTag = " [OUTAGE ALERT]"
			}
			sb.WriteString(fmt.Sprintf(" - Cluster #%s [%s, Sev: %.1f%s]: %s\n", ct.ClusterID, ct.Category, ct.Severity, outageTag, ct.Template))
		}
	}
	sb.WriteString("Grounding & Catalog Scoping Rules:\n")
	sb.WriteString("1. The above facts represent the active workspace state. When the user asks you to investigate, search, explain, or diagnose errors, you MUST immediately call the appropriate tools (such as search_logs, get_log_timeline, or get_clusters) in this turn. Never merely say 'Let me look at the logs' or 'I will search' without emitting a tool call.\n")
	sb.WriteString("2. If the user mentions or scopes one or more catalogs (e.g. '[TARGET CATALOGS: fileA.log (source_id: \"id1\"), fileB.log (source_id: \"id2\")]'):\n")
	sb.WriteString("   - For comparative histograms / timeline volume trends: pass the list of source_ids to get_log_timeline (e.g. source_ids=[\"id1\", \"id2\"]) or query each individually to compare side-by-side volume.\n")
	sb.WriteString("   - For log search: restrict queries to the requested source_ids using source_id or LLQL source filtering.\n")
	sb.WriteString("3. If you already have the required log data from tools, synthesize your findings into a comprehensive diagnosis, comparative breakdown, or histogram chart with actionable next steps.")
	return sb.String()
}
