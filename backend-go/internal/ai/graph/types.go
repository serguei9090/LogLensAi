// Package graph is the Go analogue of sidecar/src/ai's LangGraph-based
// investigation engine (graph.py's GraphManager, runner.py's HybridRunner,
// tools.py's ToolRegistry, context.py's SmartContextManager, and
// reasoning.py/thinking_parser.py's thinking-tag normalisation), ported as
// plain Go rather than a generic graph-execution framework: the topology is
// exactly 3 fixed nodes (reasoning -> tool_execution -> reasoning -> ... ->
// final_answer), which is more idiomatic as a direct function-call loop than
// as a port of LangGraph's node/edge abstraction.
//
// This package owns the AI provider and RAG memory-search *interfaces* it
// needs (Provider, MemorySearcher below) rather than importing the concrete
// internal/ai/providers and internal/ai/rag packages, which are being built
// concurrently by other agents as of this writing. Once those packages
// exist, their concrete client types are expected to satisfy these
// interfaces structurally (Go interfaces are implicit) with little or no
// adapter code -- see this package's doc comments for the exact method
// shapes assumed.
package graph

import (
	"context"
	"encoding/json"
)

// ChatMessage is the Go analogue of sidecar/src/ai/base.py's AIChatMessage,
// trimmed to the fields graph.py's message dicts actually read/write
// (role/content/tool_calls/tool_call_id/name). It doubles as both the
// provider wire format and the MissionState message-log entry, mirroring
// how graph.py keeps everything as plain dicts in state["messages"].
type ChatMessage struct {
	Role       string     `json:"role"` // "user" | "assistant" | "system" | "tool"
	Content    string     `json:"content"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
	Name       string     `json:"name,omitempty"`
}

// ToolCall mirrors the OpenAI-compatible tool_calls[] shape graph.py reads
// off provider responses (call["function"]["name"], call["function"]["arguments"]
// as a JSON-encoded string, call["id"]).
type ToolCall struct {
	ID       string           `json:"id"`
	Type     string           `json:"type"` // "function"
	Function ToolCallFunction `json:"function"`
}

// ToolCallFunction holds one tool call's name and JSON-encoded argument
// string, matching the OpenAI tool-call wire format tools.py/graph.py
// assume (call["function"]["arguments"] is parsed with json.loads).
type ToolCallFunction struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"` // JSON-encoded object
}

// ToolSchema is the OpenAI-compatible function-tool schema shape returned by
// tools.py's ToolRegistry.get_tool_schemas().
type ToolSchema struct {
	Type     string             `json:"type"` // "function"
	Function ToolFunctionSchema `json:"function"`
}

// ToolFunctionSchema mirrors one entry's ["function"] sub-object: name,
// description, and a JSON-schema `parameters` object (Pydantic's
// model_json_schema() output in Python; a hand-written json.RawMessage
// here).
type ToolFunctionSchema struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Parameters  json.RawMessage `json:"parameters"`
}

// MemoryResult is one hit from the RAG memory search (sidecar/src/ai/tools.py's
// search_memory tool, backed by App.method_search_memory / the DuckDB-VSS
// memory index being built concurrently in internal/ai/rag). Field names
// mirror the ai_memory table (workspace_id, issue_signature, resolution)
// plus a similarity score, matching the shape LanceDB/DuckDB-VSS search
// results take in the Python implementation.
type MemoryResult struct {
	IssueSignature string  `json:"issue_signature"`
	Resolution     string  `json:"resolution"`
	Score          float64 `json:"score"`
}

// Provider is the minimal surface this package needs from an AI provider
// client (sidecar/src/ai/base.py's AIProvider.chat, narrowed to the one
// method graph.py's _node_reasoning actually calls). Concrete
// implementations are expected to live in internal/ai/providers (Ollama,
// OpenAI-compatible, Gemini clients), built concurrently and not yet
// available at the time this package was written -- see the package doc
// comment.
type Provider interface {
	// Chat sends the full message history plus tool schemas to the model
	// and returns its single response message (non-streaming from this
	// package's point of view -- graph.py's provider.chat is awaited once
	// per reasoning-node visit, not streamed token-by-token). reasoning
	// requests the provider enable extended/thinking mode where supported.
	Chat(ctx context.Context, messages []ChatMessage, sessionID, model string, reasoning bool, tools []ToolSchema) (ChatMessage, error)
}

type KnowledgeHit struct {
	FilePath string  `json:"file_path"`
	FileType string  `json:"file_type"`
	Content  string  `json:"content"`
	Score    float64 `json:"score"`
}

// MemorySearcher is the minimal surface this package needs from the RAG
// memory index (sidecar/src/api.py's App.method_search_memory, backed by
// LanceDB in Python and DuckDB-VSS in internal/ai/rag, built concurrently
// and not yet available -- see the package doc comment).
type MemorySearcher interface {
	SearchMemory(ctx context.Context, workspaceID, query string, limit int) ([]MemoryResult, error)
	SearchKnowledge(ctx context.Context, workspaceID, query string, limit int) ([]KnowledgeHit, error)
}
