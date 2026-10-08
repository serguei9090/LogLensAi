package graph

import (
	"context"
	"encoding/json"

	"loglensai/backend-go/internal/models"
)

// --- search_logs ---

type searchLogsParams struct {
	WorkspaceID string             `json:"workspace_id"`
	SourceID    *string            `json:"source_id,omitempty"`
	StartTime   *string            `json:"start_time,omitempty"`
	EndTime     *string            `json:"end_time,omitempty"`
	Query       *string            `json:"query"`
	Filters     []models.LogFilter `json:"filters"`
	Limit       int                `json:"limit"`
	Offset      int                `json:"offset"`
}

func (r *ToolRegistry) searchLogs(_ context.Context, args json.RawMessage) (any, error) {
	var p searchLogsParams
	p.Limit = 100
	if err := json.Unmarshal(args, &p); err != nil {
		return map[string]any{"error": err.Error()}, nil
	}

	filters := p.Filters
	if p.SourceID != nil && *p.SourceID != "" {
		filters = append(filters, models.LogFilter{
			Field:    "source_id",
			Operator: "equals",
			Value:    *p.SourceID,
		})
	}

	result, rpcErr := r.app.GetLogs(models.GetLogsRequest{
		WorkspaceID: p.WorkspaceID,
		Offset:      p.Offset,
		Limit:       p.Limit,
		Filters:     filters,
		Query:       p.Query,
		StartTime:   p.StartTime,
		EndTime:     p.EndTime,
	})
	if rpcErr != nil {
		return map[string]any{"error": rpcErr.Message}, nil
	}
	return result, nil
}

// --- get_log_timeline ---

type getLogTimelineParams struct {
	WorkspaceID string   `json:"workspace_id"`
	Query       *string  `json:"query,omitempty"`
	StartTime   *string  `json:"start_time,omitempty"`
	EndTime     *string  `json:"end_time,omitempty"`
	SourceIDs   []string `json:"source_ids,omitempty"`
}

func (r *ToolRegistry) getLogTimeline(_ context.Context, args json.RawMessage) (any, error) {
	var p getLogTimelineParams
	if err := json.Unmarshal(args, &p); err != nil {
		return map[string]any{"error": err.Error()}, nil
	}

	result, rpcErr := r.app.GetLogDistribution(models.GetLogDistributionRequest{
		WorkspaceID: p.WorkspaceID,
		Query:       p.Query,
		StartTime:   p.StartTime,
		EndTime:     p.EndTime,
		SourceIDs:   p.SourceIDs,
	})
	if rpcErr != nil {
		return map[string]any{"error": rpcErr.Message}, nil
	}
	return result, nil
}

// --- get_clusters ---

type getClustersParams struct {
	WorkspaceID string `json:"workspace_id"`
}

func (r *ToolRegistry) getClusters(_ context.Context, args json.RawMessage) (any, error) {
	var p getClustersParams
	if err := json.Unmarshal(args, &p); err != nil {
		return []map[string]any{{"error": err.Error()}}, nil
	}

	result, rpcErr := r.app.GetClusters(p.WorkspaceID)
	if rpcErr != nil {
		return []map[string]any{{"error": rpcErr.Message}}, nil
	}
	return result, nil
}

// --- get_facets ---

type getFacetsParams struct {
	WorkspaceID string `json:"workspace_id"`
}

func (r *ToolRegistry) getFacets(_ context.Context, args json.RawMessage) (any, error) {
	var p getFacetsParams
	if err := json.Unmarshal(args, &p); err != nil {
		return map[string]any{"error": err.Error()}, nil
	}

	result, rpcErr := r.app.GetMetadataFacets(models.GetMetadataFacetsRequest{WorkspaceID: p.WorkspaceID})
	if rpcErr != nil {
		return map[string]any{"error": rpcErr.Message}, nil
	}
	return result, nil
}

// --- get_hierarchy ---

type hierarchyFolder struct {
	ID       string             `json:"id"`
	Name     string             `json:"name"`
	ParentID *string            `json:"parent_id"`
	Children []*hierarchyFolder `json:"children"`
	Sources  []hierarchySource  `json:"sources"`
}

type hierarchySource struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Type       string  `json:"type"`
	Path       string  `json:"path"`
	FolderID   *string `json:"folder_id"`
	IsUploaded bool    `json:"is_uploaded"`
}

type getHierarchyParams struct {
	WorkspaceID string `json:"workspace_id"`
}

func (r *ToolRegistry) getHierarchy(_ context.Context, args json.RawMessage) (any, error) {
	var p getHierarchyParams
	if err := json.Unmarshal(args, &p); err != nil {
		return map[string]any{"error": err.Error()}, nil
	}

	conn := r.app.DB.Conn

	folderRows, err := conn.Query(`SELECT id, name, parent_id FROM folders WHERE workspace_id = ?`, p.WorkspaceID)
	if err != nil {
		return map[string]any{"error": err.Error()}, nil
	}
	folderMap := make(map[string]*hierarchyFolder)
	var folderOrder []string
	for folderRows.Next() {
		var f hierarchyFolder
		var parentID *string
		if scanErr := folderRows.Scan(&f.ID, &f.Name, &parentID); scanErr != nil {
			continue
		}
		f.ParentID = parentID
		f.Children = []*hierarchyFolder{}
		f.Sources = []hierarchySource{}
		folderMap[f.ID] = &f
		folderOrder = append(folderOrder, f.ID)
	}
	folderRows.Close()

	sourceRows, err := conn.Query(
		`SELECT id, name, type, path, folder_id, is_uploaded FROM log_sources WHERE workspace_id = ?`, p.WorkspaceID,
	)
	if err != nil {
		return map[string]any{"error": err.Error()}, nil
	}
	var sources []hierarchySource
	for sourceRows.Next() {
		var s hierarchySource
		var folderID *string
		if scanErr := sourceRows.Scan(&s.ID, &s.Name, &s.Type, &s.Path, &folderID, &s.IsUploaded); scanErr != nil {
			continue
		}
		s.FolderID = folderID
		sources = append(sources, s)
	}
	sourceRows.Close()

	var rootFolders []*hierarchyFolder
	for _, id := range folderOrder {
		f := folderMap[id]
		if f.ParentID != nil && folderMap[*f.ParentID] != nil {
			parent := folderMap[*f.ParentID]
			parent.Children = append(parent.Children, f)
		} else {
			rootFolders = append(rootFolders, f)
		}
	}

	var rootSources []hierarchySource
	for _, s := range sources {
		if s.FolderID != nil && folderMap[*s.FolderID] != nil {
			folder := folderMap[*s.FolderID]
			folder.Sources = append(folder.Sources, s)
		} else {
			rootSources = append(rootSources, s)
		}
	}

	return map[string]any{
		"workspace_id": p.WorkspaceID,
		"root": map[string]any{
			"id":       "root",
			"name":     "Root",
			"type":     "folder",
			"children": rootFolders,
			"sources":  rootSources,
		},
	}, nil
}
