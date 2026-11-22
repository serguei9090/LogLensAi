# providers

## Overview
Multi-provider LLM client interface and factory supporting Ollama native HTTP APIs, OpenAI-compatible HTTP endpoints (OpenAI, OpenRouter, LM Studio), and Google Gemini `v1beta` REST APIs with streaming, tool schemas, thinking-tag normalization, and JSON cluster analysis.

## Interface
- `[provider.go:Provider]`: Core interface (`ListModels`, `Chat`, `ChatStream`, `AnalyzeLogs`, `TestConnection`).
- `[factory.go:Config]`, `[factory.go:NewProvider]`: Provider configuration struct and factory supporting `"ollama"`, `"openai"`, `"openai-compatible"`, `"openrouter"`, `"lmstudio"`, `"ai-studio"`, and `"gemini"`.
- `[types.go:ChatMessage]`, `[types.go:ToolSchema]`, `[types.go:ToolCall]`, `[types.go:StreamChunk]`, `[types.go:AnalysisResult]`: Normalized chat, tool-calling, stream, and cluster-analysis structures.
- `[ollama.go:DefaultOllamaModel]`, `[ollama.go:OllamaProvider]`, `[ollama.go:NewOllamaProvider]`: Ollama client (`gemma4:e2b` default) implementing `Provider`.
- `[openai_compatible.go:DefaultOpenAIHost]`, `[openai_compatible.go:DefaultOpenAIModel]`, `[openai_compatible.go:OpenAICompatibleProvider]`, `[openai_compatible.go:NewOpenAICompatibleProvider]`: OpenAI-compatible client implementing `Provider`.
- `[gemini.go:DefaultGeminiModel]`, `[gemini.go:GeminiProvider]`, `[gemini.go:NewGeminiProvider]`: Google Gemini client (`gemini-2.0-flash` constructor default; `gemini-2.5-flash` factory default) implementing `Provider`.

## Invariants
- `[factory.go:NewProvider]`: Rejects unrecognized provider names with an error and applies per-provider default hosts/models without appending an A2UI system suffix.
- `[provider.go:Provider]`: `ChatStream` must close the returned `<-chan StreamChunk` on stream completion and deliver terminal stream errors via `StreamChunk.Err`.
- `[ollama.go:OllamaProvider]`, `[openai_compatible.go:OpenAICompatibleProvider]`, `[gemini.go:GeminiProvider]`: Enforce compile-time `Provider` conformance (`var _ Provider = (*...)(nil)`), configure 60s HTTP client timeouts (`5s` for `OllamaProvider.TestConnection`), cap streaming scanner lines at `1 MiB`, and surface `Chat`/`AnalyzeLogs` HTTP or decode failures as assistant error messages or `AnalysisResult{Summary: "Analysis failed"}` with `nil` Go error.
- `[thinking.go:hasChannelMarkerThinking]`, `[thinking.go:cleanThinkingMarkers]`, `[thinking.go:wrapThinking]`, `[ollama.go:OllamaProvider.formatMessages]`, `[openai_compatible.go:OpenAICompatibleProvider.ChatStream]`, `[gemini.go:GeminiProvider.ChatStream]`: Strips `<think>` and channel markers from assistant history, wraps native reasoning/thought segments in `<think>...</think>`, sets `ReasoningEffort: "medium"` (OpenAI-compatible) or `ThinkingBudget` `2048`/`0` (Gemini) from `reasoning`, and suppresses Ollama's `ollamaReasoningDirective` when `reasoning == false`.
- `[toolschema.go:toOpenAIToolsWire]`, `[ollama.go:normalizeOllamaToolCalls]`, `[openai_compatible.go:normalizeOpenAIToolCalls]`, `[openai_compatible.go:denormalizeToOpenAIToolCalls]`, `[gemini.go:normalizeGeminiToolCalls]`: Defaults empty tool parameters/arguments to `"{}"` and synthesizes `"call_<index>"` IDs when missing.
- `[gemini.go:GeminiProvider]`: Sends API key via the `x-goog-api-key` HTTP header (never query strings); `TestConnection` requires an `"AIza"` prefix and models beyond `[DefaultGeminiModel]`; `ChatStream` omits `functionCall` parts and returns a pre-populated closed channel on empty `apiKey`.

## Side Effects
- `[ollama.go:OllamaProvider.*]`: Performs outbound HTTP requests to `<host>/api/tags`, `<host>/api/chat`, and `<host>/api/generate`; `ChatStream` spawns a reader goroutine and closes `resp.Body` and the output channel.
- `[openai_compatible.go:OpenAICompatibleProvider.*]`: Performs outbound HTTP requests to `<host>/models` and `<host>/chat/completions` (with optional `Bearer` token); `ChatStream` spawns a reader goroutine and closes `resp.Body` and the output channel.
- `[gemini.go:GeminiProvider.*]`: Performs outbound HTTP requests to `https://generativelanguage.googleapis.com/v1beta/models...` with `x-goog-api-key`; `ChatStream` spawns an SSE reader goroutine when `apiKey` is non-empty and closes `resp.Body` and the output channel.

## Verification
- Run: `go test ./...`
