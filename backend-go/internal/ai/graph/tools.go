package graph

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"loglensai/backend-go/internal/app"
	"loglensai/backend-go/internal/models"
)

// ToolFunc executes one tool call, given its raw (still JSON-encoded)
// arguments. It returns the tool's result value (to be JSON-marshalled into
// the "tool" role message's content, mirroring graph.py's
// json.dumps(result)) or an error. Per-call errors are caught by the caller
// (graph.go's tool-execution step) rather than aborting the whole turn,
// mirroring graph.py's _node_tool_execution try/except-per-call loop.
type ToolFunc func(ctx context.Context, args json.RawMessage) (any, error)

// ToolRegistry is the Go analogue of sidecar/src/ai/tools.py's ToolRegistry:
// a name -> (schema, implementation) registry, wired against a live
// *app.App and an optional MemorySearcher for RAG-backed memory search.
type ToolRegistry struct {
	app    *app.App
	memory MemorySearcher

	order   []string
	tools   map[string]ToolFunc
	schemas map[string]ToolSchema
}

// NewToolRegistry constructs a ToolRegistry wired against a and registers
// all 7 built-in tools (search_logs, get_clusters, search_memory,
// get_facets, get_hierarchy, create_column, create_facet), porting
// ToolRegistry.__init__ + get_tool_schemas from tools.py. memory may be nil
// (e.g. before internal/ai/rag lands) -- search_memory then returns an
// error result per-call rather than panicking; see searchMemory's doc
// comment.
func NewToolRegistry(a *app.App, memory MemorySearcher) *ToolRegistry {
	r := &ToolRegistry{
		app:     a,
		memory:  memory,
		tools:   make(map[string]ToolFunc),
		schemas: make(map[string]ToolSchema),
	}
	r.registerBuiltins()
	return r
}

// Register wires (or overwrites) one tool's schema and implementation,
// mirroring how graph.py's hardcoded tool_mapping associates a name with a
// (ParamModel, func) pair -- generalised here into an explicit registry so
// callers/tests can add or stub tools without editing this package.
func (r *ToolRegistry) Register(name string, schema ToolSchema, fn ToolFunc) {
	if _, exists := r.tools[name]; !exists {
		r.order = append(r.order, name)
	}
	r.tools[name] = fn
	r.schemas[name] = schema
}

// Schemas returns every registered tool's OpenAI-compatible schema, in
// registration order, porting ToolRegistry.get_tool_schemas.
func (r *ToolRegistry) Schemas() []ToolSchema {
	out := make([]ToolSchema, 0, len(r.order))
	for _, name := range r.order {
		out = append(out, r.schemas[name])
	}
	return out
}

// Execute runs the named tool with raw JSON args, porting graph.py's
// _execute_single_tool. An unknown tool name yields
// {"error": "Tool <name> not found"} as a *result* (not a Go error),
// matching Python's return value for the same case -- this lets the
// tool_execution step encode it as ordinary tool-message content just like
// any other result.
func (r *ToolRegistry) Execute(ctx context.Context, name string, args json.RawMessage) (any, error) {
	fn, ok := r.tools[name]
	if !ok {
		return map[string]any{"error": fmt.Sprintf("Tool %s not found", name)}, nil
	}
	return fn(ctx, args)
}

// Has reports whether name is registered.
func (r *ToolRegistry) Has(name string) bool {
	_, ok := r.tools[name]
	return ok
}

func rawSchema(js string) json.RawMessage { return json.RawMessage(js) }

// registerBuiltins wires the 7 tools tools.py exposes. Wiring status against
// the current internal/app surface (see this package's report to the
// caller for the authoritative summary):
//   - search_logs, get_clusters, get_facets: fully wired against existing
//     exported *app.App methods (GetLogs, GetClusters, GetMetadataFacets).
//   - search_memory: wired against the MemorySearcher interface; a no-op
//     "not configured" result until internal/ai/rag provides a concrete
//     implementation to pass into NewToolRegistry.
//   - get_hierarchy, create_facet: internal/app has no exported
//     get_hierarchy/settings-CRUD methods yet (see
//     docs/migration/STATUS.md's Phase 2 "still open" list -- settings CRUD
//     is one of the ~54 stub methods). Implemented here as direct DB
//     queries/updates against a.DB.Conn (mirroring db.py's get_hierarchy and
//     api.py's method_get_settings/method_update_settings) rather than
//     blocking on internal/app growing those methods first.
//   - create_column: a pure function, no app dependency at all (mirrors
//     tools.py: it just formats an A2UI block string for the frontend).
func (r *ToolRegistry) registerBuiltins() {
	r.Register("search_logs", ToolSchema{
		Type: "function",
		Function: ToolFunctionSchema{
			Name:        "search_logs",
			Description: "Search and filter logs in the workspace using LLQL.",
			Parameters: rawSchema(`{
				"type": "object",
				"properties": {
					"workspace_id": {"type": "string", "description": "The workspace ID to search in"},
					"query": {"type": ["string", "null"], "description": "LLQL search query"},
					"filters": {"type": ["array", "null"], "description": "List of filters to apply"},
					"limit": {"type": "integer", "description": "Max logs to return", "default": 100},
					"offset": {"type": "integer", "description": "Offset for pagination", "default": 0}
				},
				"required": ["workspace_id"]
			}`),
		},
	}, r.searchLogs)

	r.Register("get_clusters", ToolSchema{
		Type: "function",
		Function: ToolFunctionSchema{
			Name:        "get_clusters",
			Description: "Get the top log clusters/patterns for a workspace.",
			Parameters: rawSchema(`{
				"type": "object",
				"properties": {
					"workspace_id": {"type": "string", "description": "The workspace ID to get clusters for"}
				},
				"required": ["workspace_id"]
			}`),
		},
	}, r.getClusters)

	r.Register("search_memory", ToolSchema{
		Type: "function",
		Function: ToolFunctionSchema{
			Name:        "search_memory",
			Description: "Search the collective memory for similar issues and resolutions.",
			Parameters: rawSchema(`{
				"type": "object",
				"properties": {
					"workspace_id": {"type": "string", "description": "The workspace ID"},
					"query": {"type": "string", "description": "Search query string"}
				},
				"required": ["workspace_id", "query"]
			}`),
		},
	}, r.searchMemory)

	r.Register("get_facets", ToolSchema{
		Type: "function",
		Function: ToolFunctionSchema{
			Name:        "get_facets",
			Description: "Get top unique metadata facets (IPs, users, etc.) for a workspace.",
			Parameters: rawSchema(`{
				"type": "object",
				"properties": {
					"workspace_id": {"type": "string", "description": "The workspace ID to get facets for"}
				},
				"required": ["workspace_id"]
			}`),
		},
	}, r.getFacets)

	r.Register("get_hierarchy", ToolSchema{
		Type: "function",
		Function: ToolFunctionSchema{
			Name:        "get_hierarchy",
			Description: "Get the folder and source hierarchy for a workspace.",
			Parameters: rawSchema(`{
				"type": "object",
				"properties": {
					"workspace_id": {"type": "string", "description": "The workspace ID to get hierarchy for"}
				},
				"required": ["workspace_id"]
			}`),
		},
	}, r.getHierarchy)

	r.Register("create_column", ToolSchema{
		Type: "function",
		Function: ToolFunctionSchema{
			Name:        "create_column",
			Description: "Instruct the UI to create a custom column for display. Can be 'user' (regex matching on message field) or 'auto' (linked to a backend facet).",
			Parameters: rawSchema(`{
				"type": "object",
				"properties": {
					"label": {"type": "string", "description": "The display label for the column"},
					"source": {"type": "string", "enum": ["auto", "user"], "description": "Either 'auto' (for backend-extracted facets) or 'user' (for frontend regex matching)"},
					"regex": {"type": ["string", "null"], "description": "Regex pattern with a capture group if source is 'user'"},
					"width": {"type": "string", "description": "Initial column width CSS value (e.g. '120px')", "default": "120px"}
				},
				"required": ["label", "source"]
			}`),
		},
	}, r.createColumn)

	r.Register("create_facet", ToolSchema{
		Type: "function",
		Function: ToolFunctionSchema{
			Name:        "create_facet",
			Description: "Create a backend log parsing facet/mask (regex extraction rule) to extract custom fields (IP, username, etc.) from log messages.",
			Parameters: rawSchema(`{
				"type": "object",
				"properties": {
					"workspace_id": {"type": "string", "description": "The workspace ID to apply the facet/mask to"},
					"pattern": {"type": "string", "description": "The regex pattern to extract this facet"},
					"label": {"type": "string", "description": "The label for the extracted parameter (e.g. USER, IP, STATUS)"},
					"enabled": {"type": "boolean", "description": "Whether this masking rule is active", "default": true}
				},
				"required": ["workspace_id", "pattern", "label"]
			}`),
		},
	}, r.createFacet)
}

// --- search_logs ---

type searchLogsParams struct {
	WorkspaceID string             `json:"workspace_id"`
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

	result, rpcErr := r.app.GetLogs(models.GetLogsRequest{
		WorkspaceID: p.WorkspaceID,
		Offset:      p.Offset,
		Limit:       p.Limit,
		Filters:     p.Filters,
		Query:       p.Query,
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

// --- search_memory ---

type searchMemoryParams struct {
	WorkspaceID string `json:"workspace_id"`
	Query       string `json:"query"`
}

// searchMemory delegates to the injected MemorySearcher (satisfied by
// internal/ai/rag's DuckDB-VSS index once reconciled). With no searcher
// configured it returns a single-element error result rather than panicking
// or returning a Go error, matching tools.py's own try/except-wrapped
// error-as-value convention for every tool.
func (r *ToolRegistry) searchMemory(ctx context.Context, args json.RawMessage) (any, error) {
	var p searchMemoryParams
	if err := json.Unmarshal(args, &p); err != nil {
		return []map[string]any{{"error": err.Error()}}, nil
	}

	if r.memory == nil {
		return []map[string]any{{"error": "memory search is not configured"}}, nil
	}

	results, err := r.memory.SearchMemory(ctx, p.WorkspaceID, p.Query, 5)
	if err != nil {
		return []map[string]any{{"error": err.Error()}}, nil
	}
	return results, nil
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
//
// internal/app has no exported get_hierarchy yet (see registerBuiltins' doc
// comment), so this queries folders/log_sources directly and builds the
// same {workspace_id, root: {id, name, type, children, sources}} tree shape
// as db.py's LogDatabase.get_hierarchy.

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

// --- create_column (pure UI-action tool, no backend state) ---

type createColumnParams struct {
	Label  string  `json:"label"`
	Source string  `json:"source"` // "auto" | "user"
	Regex  *string `json:"regex"`
	Width  string  `json:"width"`
}

func (r *ToolRegistry) createColumn(_ context.Context, args json.RawMessage) (any, error) {
	var p createColumnParams
	p.Width = "120px"
	if err := json.Unmarshal(args, &p); err != nil {
		return map[string]any{"error": err.Error()}, nil
	}

	regexJSON := "null"
	if p.Regex != nil {
		if b, err := json.Marshal(*p.Regex); err == nil {
			regexJSON = string(b)
		}
	}

	a2ui := fmt.Sprintf(
		`[[A2UI]]{"type": "add_column", "label": %s, "source": %s, "regex": %s, "width": %s}[[/A2UI]]`,
		mustJSONString(p.Label), mustJSONString(p.Source), regexJSON, mustJSONString(p.Width),
	)

	return map[string]any{
		"status":     "success",
		"message":    "Column request registered. You MUST output the matching A2UI block in your final answer text.",
		"a2ui_block": a2ui,
	}, nil
}

func mustJSONString(s string) string {
	b, err := json.Marshal(s)
	if err != nil {
		return `""`
	}
	return string(b)
}

// --- create_facet (reads/writes the drain_masks setting) ---
//
// internal/app has no exported settings-CRUD methods yet (see
// registerBuiltins' doc comment), so this reads/writes the settings /
// workspace_settings tables directly, mirroring api.py's
// method_get_settings + method_update_settings just for the one
// "drain_masks" key create_facet touches.

type createFacetParams struct {
	WorkspaceID string `json:"workspace_id"`
	Pattern     string `json:"pattern"`
	Label       string `json:"label"`
	Enabled     *bool  `json:"enabled"`
}

type maskRule struct {
	Pattern string `json:"pattern"`
	Label   string `json:"label"`
	Enabled bool   `json:"enabled"`
}

func (r *ToolRegistry) createFacet(_ context.Context, args json.RawMessage) (any, error) {
	var p createFacetParams
	enabled := true
	p.Enabled = &enabled
	if err := json.Unmarshal(args, &p); err != nil {
		return map[string]any{"status": "error", "error": err.Error()}, nil
	}

	conn := r.app.DB.Conn

	masksRaw := r.readDrainMasksSetting(p.WorkspaceID)
	var masks []maskRule
	if masksRaw != "" {
		if unmarshalErr := json.Unmarshal([]byte(masksRaw), &masks); unmarshalErr != nil {
			// Tolerate double-encoded JSON, mirroring tools.py's fallback.
			var inner string
			if json.Unmarshal([]byte(masksRaw), &inner) == nil {
				_ = json.Unmarshal([]byte(inner), &masks)
			}
		}
	}

	exists := false
	for i := range masks {
		if masks[i].Label == p.Label && masks[i].Pattern == p.Pattern {
			masks[i].Enabled = *p.Enabled
			exists = true
			break
		}
	}
	if !exists {
		masks = append(masks, maskRule{Pattern: p.Pattern, Label: p.Label, Enabled: *p.Enabled})
	}

	newRaw, err := json.Marshal(masks)
	if err != nil {
		return map[string]any{"status": "error", "error": err.Error()}, nil
	}

	if writeErr := r.writeDrainMasksSetting(conn, p.WorkspaceID, string(newRaw)); writeErr != nil {
		return map[string]any{"status": "error", "error": writeErr.Error()}, nil
	}

	return map[string]any{
		"status":    "success",
		"message":   fmt.Sprintf("Successfully created/updated facet '%s' with pattern '%s'.", p.Label, p.Pattern),
		"facet_key": strings.ToLower(p.Label),
	}, nil
}

// readDrainMasksSetting mirrors method_get_settings' merge-then-override
// behavior for a single key: workspace_settings.drain_masks overrides
// settings.drain_masks when workspaceID is non-empty and has an override
// row.
func (r *ToolRegistry) readDrainMasksSetting(workspaceID string) string {
	conn := r.app.DB.Conn

	var value string
	_ = conn.QueryRow(`SELECT value FROM settings WHERE key = 'drain_masks'`).Scan(&value)

	if workspaceID != "" {
		var wsValue string
		if err := conn.QueryRow(
			`SELECT value FROM workspace_settings WHERE workspace_id = ? AND key = 'drain_masks'`, workspaceID,
		).Scan(&wsValue); err == nil {
			return wsValue
		}
	}
	return value
}

// writeDrainMasksSetting upserts the drain_masks setting, scoped to
// workspaceID when non-empty (workspace_settings) or global otherwise
// (settings) -- mirroring api.py's _persist_settings for a single key.
func (r *ToolRegistry) writeDrainMasksSetting(conn *sql.DB, workspaceID, value string) error {
	if workspaceID != "" {
		_, err := conn.Exec(
			`INSERT INTO workspace_settings (workspace_id, key, value) VALUES (?, 'drain_masks', ?)
			 ON CONFLICT (workspace_id, key) DO UPDATE SET value = excluded.value`,
			workspaceID, value,
		)
		return err
	}
	_, err := conn.Exec(
		`INSERT INTO settings (key, value) VALUES ('drain_masks', ?)
		 ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
		value,
	)
	return err
}
