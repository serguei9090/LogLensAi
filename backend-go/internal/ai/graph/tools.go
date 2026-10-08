package graph

import (
	"context"
	"encoding/json"
	"fmt"

	"loglensai/backend-go/internal/ai/laya"
	"loglensai/backend-go/internal/app"
)

// ToolFunc executes one tool call, given its raw (still JSON-encoded) arguments.
type ToolFunc func(ctx context.Context, args json.RawMessage) (any, error)

// ToolRegistry manages registered schemas and tool execution handlers.
type ToolRegistry struct {
	app    *app.App
	memory MemorySearcher

	order   []string
	tools   map[string]ToolFunc
	schemas map[string]ToolSchema
}

// NewToolRegistry constructs a ToolRegistry wired against app and an optional MemorySearcher.
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

// App returns the underlying *app.App instance bound to this registry.
func (r *ToolRegistry) App() *app.App {
	if r == nil {
		return nil
	}
	return r.app
}

// Register wires (or overwrites) one tool's schema and implementation.
func (r *ToolRegistry) Register(name string, schema ToolSchema, fn ToolFunc) {
	if _, exists := r.tools[name]; !exists {
		r.order = append(r.order, name)
	}
	r.tools[name] = fn
	r.schemas[name] = schema
}

// Schemas returns every registered tool's OpenAI-compatible schema in registration order.
func (r *ToolRegistry) Schemas() []ToolSchema {
	out := make([]ToolSchema, 0, len(r.order))
	for _, name := range r.order {
		out = append(out, r.schemas[name])
	}
	return out
}

// Execute runs the named tool with raw JSON args.
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

func (r *ToolRegistry) registerBuiltins() {
	r.Register("search_logs", ToolSchema{
		Type: "function",
		Function: ToolFunctionSchema{
			Name:        "search_logs",
			Description: "Search and filter logs in the workspace using LLQL, time ranges, and optional source filtering. If source_id is omitted, searches across ALL logs in the workspace.",
			Parameters: rawSchema(`{
				"type": "object",
				"properties": {
					"workspace_id": {"type": "string", "description": "The workspace ID to search in"},
					"source_id": {"type": ["string", "null"], "description": "Optional source ID to restrict search to one specific log file. Omit to search across all 4+ logs in the workspace."},
					"start_time": {"type": ["string", "null"], "description": "Optional start timestamp for the search window (e.g. '2026-09-16 10:00:00')"},
					"end_time": {"type": ["string", "null"], "description": "Optional end timestamp for the search window (e.g. '2026-09-16 10:15:00')"},
					"query": {"type": ["string", "null"], "description": "LLQL search query or keywords"},
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

	r.Register("update_laya_rules", ToolSchema{
		Type: "function",
		Function: ToolFunctionSchema{
			Name:        "update_laya_rules",
			Description: "Auto-improves or updates Laya System 1 decision rules to resolve misclassified log patterns, adjust severity rubrics, or add new infrastructure categories.",
			Parameters: rawSchema(`{
				"type": "object",
				"properties": {
					"rationale": {"type": "string", "description": "Clear reason for updating the rule (e.g. 'Added k8s OOM killed category to resolve ambiguity in pod evictions')"},
					"question_name": {"type": "string", "description": "The key of the question to add or update (e.g. 'category', 'severity', 'is_outage', or a custom question)"},
					"type": {"type": "string", "enum": ["choice", "score", "noul"], "description": "Decision primitive type"},
					"instructions": {"type": "string", "description": "The precise prompt/instruction for the question"},
					"options": {"type": "array", "items": {"type": "string"}, "description": "For choice: list of category options. For noul: optional true/false labels"},
					"rubric": {"type": "array", "items": {"type": "integer"}, "description": "For score: ordinal rubric levels (e.g. [1, 2, 3, 4, 5])"}
				},
				"required": ["rationale", "question_name", "type", "instructions"]
			}`),
		},
	}, r.updateLayaRules)
}

// RouteWithLaya evaluates user query intent against Laya's active tool_intent rule.
func RouteWithLaya(ctx context.Context, reg *ToolRegistry, query string) (*laya.DecisionResult, error) {
	if reg == nil || reg.app == nil || reg.app.LayaManager == nil || reg.app.LayaEngine == nil {
		return nil, nil
	}

	settings := reg.app.LayaManager.GetSettings()
	if !settings.Enabled {
		return nil, nil
	}

	q, ok := settings.Questions["tool_intent"]
	if !ok {
		return nil, nil
	}

	return reg.app.LayaEngine.Predict(ctx, q, query)
}
