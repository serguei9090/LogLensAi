// Package providers implements the pluggable AI provider abstraction used by
// LogLensAI's chat/analysis features. It is a Go port of the Python
// sidecar's `sidecar/src/ai/` package (base.py, ollama.py,
// openai_compatible.py, ai_studio.py).
//
// Design note vs. the Python source: Python's `AIChatMessage.tool_calls`
// field is `list[dict] | None` — each provider stuffs its own native
// wire-format dict in there directly (Ollama's tool_calls dicts differ from
// OpenAI's `{id, type, function:{name, arguments}}` shape, which differ
// again from Gemini's `functionCall{name, args}`). Go doesn't have a
// convenient untyped-dict escape hatch that downstream (state-machine/tool
// registry) code could consume safely, so this port normalizes tool calls
// into a single ToolCall shape (see below) that every provider's Chat/
// ChatStream implementation is responsible for producing/consuming.
package providers

import (
	"encoding/json"
)

// ChatMessage mirrors Python's AIChatMessage (sidecar/src/ai/base.py).
type ChatMessage struct {
	// Role is one of "user" | "assistant" | "system" | "tool".
	Role    string `json:"role"`
	Content string `json:"content"`

	// ContextLogs holds log row IDs that were attached as context for this
	// message (UI-side feature; opaque to providers).
	ContextLogs []int `json:"context_logs,omitempty"`

	// Timestamp is an RFC3339 string, kept as a string (not time.Time) to
	// mirror the Python model's `str | None` field exactly and avoid
	// forcing a parse on messages that never carry one.
	Timestamp string `json:"timestamp,omitempty"`

	// ProviderSessionID is an opaque session/task handle assigned by the
	// remote provider (e.g. an A2A taskId). Threaded through so a provider
	// can resume server-side conversation state across calls.
	ProviderSessionID string `json:"provider_session_id,omitempty"`

	// ToolCalls holds tool/function calls the assistant requested, in
	// normalized form (see ToolCall doc comment).
	ToolCalls []ToolCall `json:"tool_calls,omitempty"`

	// ToolCallID identifies which prior ToolCall this message (role="tool")
	// is a result for.
	ToolCallID string `json:"tool_call_id,omitempty"`

	// Name is the tool/function name, set on role="tool" messages.
	Name string `json:"name,omitempty"`
}

// ToolSchema is an OpenAI-function-calling-shaped tool definition, matching
// what `sidecar/src/ai/tools.py`'s ToolRegistry.get_tool_schemas() emits
// (`{"type": "function", "function": {"name", "description", "parameters"}}`).
// Parameters is kept as raw JSON Schema bytes since it is produced by
// Pydantic's `model_json_schema()` on the Python side and this port has no
// equivalent schema generator — callers (the tool registry package) are
// expected to hand in pre-built JSON Schema documents.
type ToolSchema struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Parameters  json.RawMessage `json:"parameters"`
}

// ToolCall is the normalized representation of a single tool/function call
// requested by the model, regardless of which provider produced it.
// Arguments is always a JSON object, encoded as raw bytes:
//   - Ollama returns arguments as a native JSON object already -> re-marshaled as-is.
//   - OpenAI-compatible returns arguments as a JSON-*encoded string* -> that
//     string's bytes are used directly as the RawMessage (no double-encoding).
//   - Gemini returns `functionCall.args` as a native JSON object, and never
//     assigns an ID -> ID is synthesized (see gemini.go).
type ToolCall struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments"`
}

// StreamChunk is one item from a Provider's ChatStream channel. Exactly one
// of Content/Err is meaningful per chunk; Done marks the final chunk of a
// successful stream (with or without trailing Content).
//
// This channel-based design is the idiomatic Go replacement for Python's
// `async def chat_stream(...)` async generator (`yield chunk`).
type StreamChunk struct {
	Content string
	Done    bool
	Err     error
}

// AnalysisResult mirrors the `dict` returned by Python's
// `analyze_logs(template, samples) -> dict` (always shaped
// `{"summary", "root_cause", "recommended_actions"}` per every provider's
// prompt).
type AnalysisResult struct {
	Summary            string   `json:"summary"`
	RootCause          string   `json:"root_cause"`
	RecommendedActions []string `json:"recommended_actions"`
}
