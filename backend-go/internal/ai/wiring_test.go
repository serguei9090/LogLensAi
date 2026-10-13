package ai

import (
	"context"
	"encoding/json"
	"testing"

	"loglensai/backend-go/internal/ai/graph"
	"loglensai/backend-go/internal/ai/providers"
	"loglensai/backend-go/internal/app"
	"loglensai/backend-go/internal/db"
)

func newTestApp(t *testing.T) *app.App {
	t.Helper()
	a, err := app.NewApp(db.MemoryDB)
	if err != nil {
		t.Fatalf("app.NewApp: %v", err)
	}
	t.Cleanup(func() { _ = a.Close() })
	return a
}

// TestWire_Defaults exercises Wire against a fresh in-memory *app.App (so
// internal/db's seeded settings -- ai_provider=ollama, ai_ollama_host=
// http://localhost:11434, etc. -- are in effect), asserting it succeeds
// without touching the network or the ONNX embedder (Wire itself does no
// I/O; see its doc comment) and returns a fully non-nil bundle.
func TestWire_Defaults(t *testing.T) {
	a := newTestApp(t)

	w, err := Wire(a)
	if err != nil {
		t.Fatalf("Wire: %v", err)
	}
	if w.Provider == nil {
		t.Error("expected a non-nil Provider")
	}
	if w.Tools == nil {
		t.Error("expected a non-nil ToolRegistry")
	}
	if w.Memory == nil {
		t.Error("expected a non-nil Memory searcher")
	}
	if len(w.Tools.Schemas()) != 9 {
		t.Errorf("expected all 9 builtin tools registered, got %d", len(w.Tools.Schemas()))
	}
}

// TestNewProviderFromSettings_UnknownProvider proves Wire's one realistic
// failure mode: an unrecognized ai_provider setting value surfaces as an
// error rather than silently falling back to some default (matching
// providers.NewProvider's own documented deviation from the Python
// factory's silent-fallback behavior).
func TestNewProviderFromSettings_UnknownProvider(t *testing.T) {
	a := newTestApp(t)
	if _, err := a.DB.Conn.Exec(`UPDATE settings SET value = 'not-a-real-provider' WHERE key = 'ai_provider'`); err != nil {
		t.Fatalf("seeding bad ai_provider setting: %v", err)
	}

	if _, err := NewProviderFromSettings(a); err == nil {
		t.Error("expected an error for an unrecognized ai_provider setting")
	}
}

// TestLazyMemorySearcher_GracefulUnavailable proves the "don't fail startup
// over a missing ONNX model" contract end to end: on a machine where the
// embedder genuinely can't be constructed, SearchMemory must return a plain
// error (not panic, not block indefinitely), and repeated calls must not
// re-attempt the slow initialization (the cached error is returned
// immediately every time).
func TestLazyMemorySearcher_GracefulUnavailable(t *testing.T) {
	l := newLazyMemorySearcher(t.TempDir(), nil)
	// Force init() down the failure path deterministically regardless of
	// whether this machine happens to have onnxruntime/model files
	// available (rag's own tests skip in that case -- this test instead
	// asserts the *degradation contract*, so it must not depend on the
	// environment): a nil *sql.DB, once rag.NewEmbedderFromEnv succeeds,
	// would panic inside rag.NewService's SetupVectorSearch call -- so
	// pre-seed a cached error instead of relying on embedder absence.
	l.once.Do(func() { l.err = context.DeadlineExceeded })

	if _, err := l.SearchMemory(context.Background(), "ws1", "query", 5); err == nil {
		t.Error("expected the cached init error to be returned")
	}
	if _, err := l.SearchMemory(context.Background(), "ws1", "query", 5); err == nil {
		t.Error("expected the cached init error to be returned again (no re-init)")
	}
}

// TestLazyMemorySearcher_RealEndToEnd exercises the lazy init path against
// whatever onnxruntime/model files this machine actually has (mirroring
// internal/ai/rag's own tests' skip-if-unavailable pattern -- see
// rag.newTestEmbedder's doc comment), proving Wire's Memory field is a real,
// working graph.MemorySearcher backed by internal/ai/rag's DuckDB-VSS
// search, not just a value that type-checks. Skips (does not fail) on a
// machine without the ONNX dependencies available.
func TestLazyMemorySearcher_RealEndToEnd(t *testing.T) {
	a := newTestApp(t)
	w, err := Wire(a)
	if err != nil {
		t.Fatalf("Wire: %v", err)
	}

	results, err := w.Memory.SearchMemory(context.Background(), "ws1", "database connection timeout", 5)
	if err != nil {
		t.Skipf("embedding backend not available in this environment (%v) -- skipping", err)
	}
	// No memories were ever saved for ws1, so the real DuckDB-VSS search
	// should come back empty, not error -- proving the whole embedder ->
	// rag.Service -> lazyMemorySearcher -> graph.MemorySearcher chain runs
	// for real, end to end.
	if len(results) != 0 {
		t.Errorf("expected 0 results for a workspace with no saved memories, got %d", len(results))
	}
}

// --- Adapter unit tests ---------------------------------------------------

func TestToProviderMessage_ToolCallArguments(t *testing.T) {
	in := graph.ChatMessage{
		Role: "assistant",
		ToolCalls: []graph.ToolCall{
			{ID: "c1", Type: "function", Function: graph.ToolCallFunction{Name: "get_clusters", Arguments: `{"workspace_id":"ws1"}`}},
		},
	}
	out := toProviderMessage(in)
	if len(out.ToolCalls) != 1 {
		t.Fatalf("expected 1 tool call, got %d", len(out.ToolCalls))
	}
	if out.ToolCalls[0].Name != "get_clusters" {
		t.Errorf("Name = %q", out.ToolCalls[0].Name)
	}
	var args map[string]string
	if err := json.Unmarshal(out.ToolCalls[0].Arguments, &args); err != nil {
		t.Fatalf("Arguments did not round-trip as JSON: %v", err)
	}
	if args["workspace_id"] != "ws1" {
		t.Errorf("workspace_id = %q", args["workspace_id"])
	}
}

func TestToGraphMessage_ToolCallArguments(t *testing.T) {
	in := providers.ChatMessage{
		Role: "assistant",
		ToolCalls: []providers.ToolCall{
			{ID: "c1", Name: "search_logs", Arguments: json.RawMessage(`{"workspace_id":"ws1","limit":10}`)},
		},
	}
	out := toGraphMessage(in)
	if len(out.ToolCalls) != 1 {
		t.Fatalf("expected 1 tool call, got %d", len(out.ToolCalls))
	}
	if out.ToolCalls[0].Type != "function" {
		t.Errorf("Type = %q, want %q", out.ToolCalls[0].Type, "function")
	}
	if out.ToolCalls[0].Function.Name != "search_logs" {
		t.Errorf("Function.Name = %q", out.ToolCalls[0].Function.Name)
	}
	var args map[string]any
	if err := json.Unmarshal([]byte(out.ToolCalls[0].Function.Arguments), &args); err != nil {
		t.Fatalf("Function.Arguments did not round-trip as JSON: %v", err)
	}
	if args["workspace_id"] != "ws1" {
		t.Errorf("workspace_id = %v", args["workspace_id"])
	}
}

func TestToGraphMessage_EmptyArgumentsBecomesEmptyObject(t *testing.T) {
	in := providers.ChatMessage{
		ToolCalls: []providers.ToolCall{{ID: "c1", Name: "get_facets", Arguments: nil}},
	}
	out := toGraphMessage(in)
	if out.ToolCalls[0].Function.Arguments != "{}" {
		t.Errorf("Arguments = %q, want %q", out.ToolCalls[0].Function.Arguments, "{}")
	}
}

func TestToProviderToolSchema(t *testing.T) {
	in := graph.ToolSchema{
		Type: "function",
		Function: graph.ToolFunctionSchema{
			Name:        "get_hierarchy",
			Description: "desc",
			Parameters:  json.RawMessage(`{"type":"object"}`),
		},
	}
	out := toProviderToolSchema(in)
	if out.Name != "get_hierarchy" || out.Description != "desc" {
		t.Errorf("unexpected schema: %+v", out)
	}
	if string(out.Parameters) != `{"type":"object"}` {
		t.Errorf("Parameters = %s", out.Parameters)
	}
}

func TestProviderAdapter_DynamicResolution(t *testing.T) {
	a := newTestApp(t)
	fallback, err := NewProviderFromSettings(a)
	if err != nil {
		t.Fatalf("NewProviderFromSettings: %v", err)
	}

	adapter := NewDynamicProviderAdapter(a, fallback).(*providerAdapter)

	// Initially default is ollama
	p1 := adapter.getProvider()
	if _, ok := p1.(*providers.OllamaProvider); !ok {
		t.Errorf("expected initial provider to be OllamaProvider, got %T", p1)
	}

	// Update settings to openrouter
	if _, err := a.DB.Conn.Exec(`UPDATE settings SET value = 'openrouter' WHERE key = 'ai_provider'`); err != nil {
		t.Fatalf("updating ai_provider: %v", err)
	}
	if _, err := a.DB.Conn.Exec(`UPDATE settings SET value = 'test-key' WHERE key = 'ai_api_key'`); err != nil {
		t.Fatalf("updating ai_api_key: %v", err)
	}

	p2 := adapter.getProvider()
	if _, ok := p2.(*providers.OpenAICompatibleProvider); !ok {
		t.Errorf("expected dynamically resolved provider to be OpenAICompatibleProvider, got %T", p2)
	}
}
