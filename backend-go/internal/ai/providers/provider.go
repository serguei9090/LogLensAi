package providers

import "context"

// Provider is the Go equivalent of Python's abstract AIProvider
// (sidecar/src/ai/base.py). Every concrete provider (Ollama,
// OpenAI-compatible, Gemini) implements this interface; the tool-registry /
// state-machine package should code against this interface only, not any
// concrete type.
type Provider interface {
	// ListModels fetches the list of available model names/IDs for this
	// provider. Mirrors `list_models()`.
	ListModels(ctx context.Context) ([]string, error)

	// Chat executes a single non-streaming chat turn and returns the
	// assistant's reply message. `sessionID` is LogLensAI's own session
	// identifier (used by providers that need to resume server-side state,
	// e.g. a future A2A-style provider); `model` overrides the provider's
	// configured default when non-empty; `reasoning` toggles
	// reasoning/thinking-directive injection where the provider supports
	// it; `tools`, when non-empty, advertises callable tools to the model.
	// Mirrors `chat(messages, model, session_id, tools, **kwargs)`.
	Chat(ctx context.Context, messages []ChatMessage, sessionID, model string, reasoning bool, tools []ToolSchema) (ChatMessage, error)

	// ChatStream is the streaming counterpart of Chat. It returns a channel
	// of StreamChunk; the channel is closed by the implementation once the
	// stream ends (successfully or with an error reported via the final
	// chunk's Err field). This replaces Python's `async def chat_stream`
	// async-generator with the idiomatic Go equivalent.
	ChatStream(ctx context.Context, messages []ChatMessage, sessionID, model string, reasoning bool, tools []ToolSchema) (<-chan StreamChunk, error)

	// AnalyzeLogs performs a one-off diagnostic analysis of a single log
	// cluster (template + sample lines), independent of any chat session.
	// Mirrors `analyze_logs(template, samples) -> dict`.
	AnalyzeLogs(ctx context.Context, template string, samples []string) (AnalysisResult, error)

	// TestConnection verifies provider credentials/connectivity. Mirrors
	// `test_connection() -> dict`; the Go signature reports failure via a
	// non-nil error rather than a status string, since the caller (RPC
	// layer) is expected to translate errors into whatever
	// `{"status": "error", "message": ...}` shape the JSON-RPC contract
	// still requires.
	TestConnection(ctx context.Context) error
}
