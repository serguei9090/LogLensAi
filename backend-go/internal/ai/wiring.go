// Package ai is the Phase 3 AI composition root: it reconciles the three
// packages built concurrently and in isolation (internal/ai/providers'
// concrete Provider clients, internal/ai/rag's DuckDB-VSS memory search, and
// internal/ai/graph's state machine + tool registry, which was coded against
// its own locally-defined Provider/MemorySearcher interfaces and its own
// ChatMessage/ToolCall/ToolSchema/MemoryResult types) into one real,
// runnable AI subsystem.
//
// # Why this glue lives here, not inside internal/app
//
// The natural reading of "the composition root should construct and hold
// the provider/tool registry" is that internal/app.App should grow Provider
// and ToolRegistry fields. That is not possible without an import cycle:
// internal/ai/graph's tool registry (tools.go) already depends on
// *internal/app.App directly (it calls a.GetLogs/a.GetClusters/
// a.GetMetadataFacets and reads a.DB.Conn for the two tools implemented as
// stopgap direct DB queries) -- a real, deliberate dependency from the
// Phase 3 graph pass, not something this pass should undo. So
// internal/app cannot import internal/ai/graph back without a cycle.
//
// internal/ai/graph, by contrast, has no dependency problem importing
// internal/app, internal/ai/providers, and internal/ai/rag all at once --
// none of those three import graph or ai. This package sits at that same
// level (it imports app, graph, providers, and rag; nothing imports this
// package except cmd/sidecar/main.go and tests), which is the actual shape
// the existing code already assumes: internal/rpc.RegisterAI and
// .MountStreamChat both take an explicit graph.Provider and *graph.ToolRegistry
// as parameters rather than pulling them off *app.App, so main.go gluing
// Wire's output into those two calls is consistent with how the RPC layer
// was already built, not a workaround bolted on top of it.
package ai

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"sync"

	"loglensai/backend-go/internal/ai/graph"
	"loglensai/backend-go/internal/ai/providers"
	"loglensai/backend-go/internal/ai/rag"
	"loglensai/backend-go/internal/app"
)

// Wiring bundles everything cmd/sidecar/main.go needs to hand to
// rpc.RegisterAI / rpc.MountStreamChat.
type Wiring struct {
	// Provider adapts the real internal/ai/providers.Provider (built from
	// the workspace's ai_provider/ai_model/... settings) to graph's own
	// Provider interface.
	Provider graph.Provider

	// Tools is the real tool registry, wired against a live *app.App and
	// Memory below.
	Tools *graph.ToolRegistry

	// Memory is the same value passed into Tools -- exposed separately so
	// callers/tests can drive search_memory directly without going through
	// the tool registry.
	Memory graph.MemorySearcher
}

// Wire constructs the AI subsystem for a: a providers.Provider built from
// a's current settings (ai_provider/ai_model/ai_api_key/ai_system_prompt +
// the provider-specific host setting), wrapped to satisfy graph.Provider;
// a lazily-initialized RAG memory searcher (see lazyMemorySearcher's doc
// comment -- the ONNX embedder is not touched until the first
// search_memory call, so a machine without the onnxruntime shared library
// or a cached model can still start the sidecar and use every other AI
// tool); and a graph.ToolRegistry wired against both.
//
// Wire itself does no network or model I/O, so it is safe to call
// unconditionally at startup (mirrors NewApp's own philosophy of never
// failing construction over a subsystem that can degrade gracefully at use
// time) -- the only realistic failure mode is an unrecognized ai_provider
// settings value, which providers.NewProvider reports as an error.
func Wire(a *app.App) (*Wiring, error) {
	provider, err := NewProviderFromSettings(a)
	if err != nil {
		return nil, fmt.Errorf("ai: constructing provider from settings: %w", err)
	}

	memory := newLazyMemorySearcher(a.DataDir(), a.DB.Conn)
	tools := graph.NewToolRegistry(a, memory)

	return &Wiring{
		Provider: NewDynamicProviderAdapter(a, provider),
		Tools:    tools,
		Memory:   memory,
	}, nil
}

// NewProviderFromSettings builds a providers.Provider from a's current
// global settings, mirroring api.py's AIProviderFactory.get_provider() call
// site (App._get_ai_provider): ai_provider selects the concrete client;
// ai_model/ai_api_key/ai_system_prompt are common to all of them; the host
// is read from the provider-specific setting key (ai_ollama_host/
// ai_openai_host/ai_lmstudio_host/ai_gemini_url), matching
// internal/db/settings.go's default-settings seed list. Falls back to
// "ollama" (the seeded default) when ai_provider is unset/empty.
func NewProviderFromSettings(a *app.App) (providers.Provider, error) {
	s := a.Settings("")

	name := s["ai_provider"]
	if name == "" {
		name = "ollama"
	}

	apiKey := ""
	switch name {
	case "openai":
		apiKey = s["ai_openai_api_key"]
	case "openai-compatible":
		apiKey = s["ai_openai_compat_api_key"]
	case "openrouter":
		apiKey = s["ai_openrouter_api_key"]
	case "ai-studio", "gemini":
		apiKey = s["ai_gemini_api_key"]
	default:
		apiKey = s["ai_api_key"]
	}

	cfg := providers.Config{
		APIKey:       apiKey,
		SystemPrompt: s["ai_system_prompt"],
		Model:        s["ai_model"],
	}

	switch name {
	case "ollama":
		cfg.Host = s["ai_ollama_host"]
	case "openai":
		cfg.Host = "https://api.openai.com/v1"
	case "openai-compatible":
		cfg.Host = s["ai_openai_host"]
	case "openrouter":
		cfg.Host = s["ai_openrouter_host"]
		if cfg.Host == "" {
			cfg.Host = "https://openrouter.ai/api/v1"
		}
	case "lmstudio":
		cfg.Host = s["ai_lmstudio_host"]
	case "ai-studio", "gemini":
		cfg.Host = s["ai_gemini_url"]
		if cfg.Host == "" {
			cfg.Host = "https://generativelanguage.googleapis.com"
		}
	}

	return providers.NewProvider(name, cfg)
}

// --- Provider adapter ---------------------------------------------------

// providerAdapter wraps a concrete internal/ai/providers.Provider so it
// satisfies internal/ai/graph.Provider. The two packages were built
// concurrently against independently-designed ChatMessage/ToolCall/
// ToolSchema shapes (see this file's package doc comment); every method
// here does the field-for-field translation between them rather than either
// package changing its own types.
type providerAdapter struct {
	app      *app.App
	fallback providers.Provider
}

// NewProviderAdapter wraps p so it satisfies graph.Provider.
func NewProviderAdapter(p providers.Provider) graph.Provider {
	return &providerAdapter{fallback: p}
}

// NewDynamicProviderAdapter wraps an app.App and a fallback provider,
// resolving the active provider dynamically from app settings on every call.
func NewDynamicProviderAdapter(a *app.App, fallback providers.Provider) graph.Provider {
	return &providerAdapter{app: a, fallback: fallback}
}

func (a *providerAdapter) getProvider() providers.Provider {
	if a.app != nil {
		if p, err := NewProviderFromSettings(a.app); err == nil && p != nil {
			return p
		}
	}
	return a.fallback
}

// Chat implements graph.Provider by converting graph's message/tool-schema
// shapes to providers' shapes, delegating to the real provider, and
// converting its response back.
func (a *providerAdapter) Chat(
	ctx context.Context,
	messages []graph.ChatMessage,
	sessionID, model string,
	reasoning bool,
	tools []graph.ToolSchema,
) (graph.ChatMessage, error) {
	pMessages := make([]providers.ChatMessage, len(messages))
	for i, m := range messages {
		pMessages[i] = toProviderMessage(m)
	}
	pTools := make([]providers.ToolSchema, len(tools))
	for i, t := range tools {
		pTools[i] = toProviderToolSchema(t)
	}

	resp, err := a.getProvider().Chat(ctx, pMessages, sessionID, model, reasoning, pTools)
	if err != nil {
		return graph.ChatMessage{}, err
	}
	return toGraphMessage(resp), nil
}

// toProviderMessage converts graph.ChatMessage -> providers.ChatMessage.
// graph.ChatMessage has no ContextLogs/Timestamp/ProviderSessionID fields
// (providers.ChatMessage-only concerns not read by graph.Run), so those are
// simply left zero-valued on the way out.
func toProviderMessage(m graph.ChatMessage) providers.ChatMessage {
	out := providers.ChatMessage{
		Role:       m.Role,
		Content:    m.Content,
		ToolCallID: m.ToolCallID,
		Name:       m.Name,
	}
	if len(m.ToolCalls) == 0 {
		return out
	}
	out.ToolCalls = make([]providers.ToolCall, len(m.ToolCalls))
	for i, tc := range m.ToolCalls {
		out.ToolCalls[i] = providers.ToolCall{
			ID:   tc.ID,
			Name: tc.Function.Name,
			// graph.ToolCallFunction.Arguments is a JSON-encoded *string*
			// (the OpenAI wire shape graph.py assumes); providers.ToolCall.
			// Arguments is the same bytes as a json.RawMessage. Re-using the
			// string's bytes directly (no re-marshal) is safe: it is already
			// a JSON object per both packages' doc comments.
			Arguments: json.RawMessage(tc.Function.Arguments),
		}
	}
	return out
}

// toGraphMessage converts providers.ChatMessage -> graph.ChatMessage (the
// inverse of toProviderMessage), dropping the providers-only fields
// (ContextLogs/Timestamp/ProviderSessionID) graph.ChatMessage has no room
// for -- none of those are read by graph.Run today; if a future provider
// needs ProviderSessionID threaded back into graph's MissionState, that is
// a graph.ChatMessage schema change, not something this adapter can smuggle
// through.
func toGraphMessage(m providers.ChatMessage) graph.ChatMessage {
	out := graph.ChatMessage{
		Role:       m.Role,
		Content:    m.Content,
		ToolCallID: m.ToolCallID,
		Name:       m.Name,
	}
	if len(m.ToolCalls) == 0 {
		return out
	}
	out.ToolCalls = make([]graph.ToolCall, len(m.ToolCalls))
	for i, tc := range m.ToolCalls {
		args := string(tc.Arguments)
		if args == "" {
			// graph's tool-execution path (nodeToolExecution ->
			// executeToolCall) does json.RawMessage(rawArgs) unconditionally
			// with no nil-guard; an empty string is invalid JSON and would
			// make json.Unmarshal fail inside the tool's own param struct
			// decode (returned as a per-call {"error": ...} result, not a
			// crash -- but "{}" round-trips as "no arguments" the way every
			// tool's json.Unmarshal(args, &p) expects instead).
			args = "{}"
		}
		out.ToolCalls[i] = graph.ToolCall{
			ID:   tc.ID,
			Type: "function",
			Function: graph.ToolCallFunction{
				Name:      tc.Name,
				Arguments: args,
			},
		}
	}
	return out
}

// toProviderToolSchema converts graph.ToolSchema (OpenAI-wrapped:
// {type, function:{name,description,parameters}}) to providers.ToolSchema
// (flat: {name,description,parameters}) -- providers.Provider
// implementations re-wrap into whichever shape their own wire format wants
// (see providers' doc comments), so only the inner function fields need to
// survive the trip.
func toProviderToolSchema(t graph.ToolSchema) providers.ToolSchema {
	return providers.ToolSchema{
		Name:        t.Function.Name,
		Description: t.Function.Description,
		Parameters:  t.Function.Parameters,
	}
}

// --- Memory searcher adapter ---------------------------------------------

// lazyMemorySearcher implements graph.MemorySearcher, deferring
// internal/ai/rag's ONNX embedder + Service construction until the first
// SearchMemory call rather than at Wire/NewApp time. The embedder needs an
// onnxruntime shared library and the nomic-embed-text-v1.5 model/tokenizer
// on disk (see rag.NewEmbedderFromEnv's doc comment); on a fresh machine
// neither may be present yet (a first-run download of the model takes real
// time and needs network access). Deferring construction means a sidecar
// that never gets a search_memory call -- or is only just starting up --
// never pays that cost or risks failing to start entirely over an AI
// convenience feature. Initialization is attempted exactly once (sync.Once):
// a failure is cached and reported to every subsequent call rather than
// retried per-call, so a persistently-broken environment fails fast instead
// of re-attempting (and re-logging) a slow, doomed initialization on every
// search_memory tool call.
type lazyMemorySearcher struct {
	dataDir string
	conn    *sql.DB

	once sync.Once
	svc  *rag.Service
	err  error
}

func newLazyMemorySearcher(dataDir string, conn *sql.DB) *lazyMemorySearcher {
	return &lazyMemorySearcher{dataDir: dataDir, conn: conn}
}

func (l *lazyMemorySearcher) init() {
	l.once.Do(func() {
		embedder, err := rag.NewEmbedderFromEnv(l.dataDir)
		if err != nil {
			l.err = fmt.Errorf("rag memory search unavailable (embedder init failed): %w", err)
			log.Printf("[AI] %v", l.err)
			return
		}
		svc, err := rag.NewService(l.conn, embedder)
		if err != nil {
			l.err = fmt.Errorf("rag memory search unavailable (service init failed): %w", err)
			log.Printf("[AI] %v", l.err)
			return
		}
		l.svc = svc
	})
}

// SearchMemory implements graph.MemorySearcher, converting rag.MemoryResult
// (IssueSignature, Resolution, CreatedAt, Distance -- cosine distance, lower
// is more similar) to graph.MemoryResult (IssueSignature, Resolution,
// Score). Score is derived as 1-Distance: for the L2-normalized vectors
// rag.Embedder always produces, cosine distance is exactly 1-cosine_similarity,
// so this recovers the conventional "higher is more similar" similarity
// score graph.MemoryResult's field name implies, in [-1, 1] (in practice
// close to [0, 1] for related text).
func (l *lazyMemorySearcher) SearchMemory(ctx context.Context, workspaceID, query string, limit int) ([]graph.MemoryResult, error) {
	l.init()
	if l.err != nil {
		return nil, l.err
	}

	results, err := l.svc.SearchMemory(ctx, workspaceID, query, limit)
	if err != nil {
		return nil, err
	}

	out := make([]graph.MemoryResult, len(results))
	for i, m := range results {
		out[i] = graph.MemoryResult{
			IssueSignature: m.IssueSignature,
			Resolution:     m.Resolution,
			Score:          1 - m.Distance,
		}
	}
	return out, nil
}

// SearchKnowledge implements graph.MemorySearcher, retrieving documentation chunks from knowledge_documents.
func (l *lazyMemorySearcher) SearchKnowledge(ctx context.Context, workspaceID, query string, limit int) ([]graph.KnowledgeHit, error) {
	l.init()
	if l.err != nil {
		return nil, l.err
	}

	results, err := l.svc.SearchKnowledge(ctx, workspaceID, query, limit)
	if err != nil {
		return nil, err
	}

	out := make([]graph.KnowledgeHit, len(results))
	for i, r := range results {
		out[i] = graph.KnowledgeHit{
			FilePath: r.FilePath,
			FileType: r.FileType,
			Content:  r.Content,
			Score:    r.Score,
		}
	}
	return out, nil
}
