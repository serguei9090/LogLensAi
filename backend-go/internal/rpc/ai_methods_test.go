package rpc

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"loglensai/backend-go/internal/ai"
	"loglensai/backend-go/internal/ai/graph"
	"loglensai/backend-go/internal/ai/providers"
	"loglensai/backend-go/internal/app"
	"loglensai/backend-go/internal/db"
	"loglensai/backend-go/internal/models"
)

// fakeAIProvider is a minimal scriptable graph.Provider double for exercising
// the send_ai_message RPC wiring end-to-end against a real (in-memory)
// *app.App, without needing a real internal/ai/providers client.
type fakeAIProvider struct {
	call int
}

func (f *fakeAIProvider) Chat(_ context.Context, _ []graph.ChatMessage, _, _ string, _ bool, _ []graph.ToolSchema) (graph.ChatMessage, error) {
	f.call++
	return graph.ChatMessage{Role: "assistant", Content: "The investigation is complete."}, nil
}

func newTestApp(t *testing.T) *app.App {
	t.Helper()
	a, err := app.NewApp(db.MemoryDB)
	if err != nil {
		t.Fatalf("app.NewApp: %v", err)
	}
	t.Cleanup(func() {
		_ = a.Close()
	})
	return a
}

func TestSendAIMessage_EndToEnd(t *testing.T) {
	a := newTestApp(t)
	provider := &fakeAIProvider{}
	tools := graph.NewToolRegistry(a, nil)

	reg := NewRegistry()
	RegisterStubs(reg)
	RegisterAI(reg, a, provider, tools)

	params, _ := json.Marshal(models.SendAiMessageRequest{
		WorkspaceID: "ws1",
		Message:     "What's going on in the logs?",
	})
	resp := reg.Dispatch(models.JSONRPCRequest{JSONRPC: "2.0", ID: 1, Method: "send_ai_message", Params: params})

	if resp.Error != nil {
		t.Fatalf("send_ai_message returned error: %+v", resp.Error)
	}
	result, ok := resp.Result.(map[string]any)
	if !ok {
		t.Fatalf("unexpected result type %T: %+v", resp.Result, resp.Result)
	}
	sessionID, _ := result["session_id"].(string)
	if sessionID == "" {
		t.Fatal("expected a non-empty session_id")
	}
	if result["response"] != "The investigation is complete." {
		t.Errorf("response = %v", result["response"])
	}
	if provider.call != 1 {
		t.Errorf("expected exactly 1 provider call (no tool calls requested), got %d", provider.call)
	}

	// Verify persistence: one user + one assistant row in ai_messages, and
	// the session row exists with an updated last_modified.
	var msgCount int
	if err := a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM ai_messages WHERE session_id = ?`, sessionID).Scan(&msgCount); err != nil {
		t.Fatalf("querying ai_messages: %v", err)
	}
	if msgCount != 2 {
		t.Errorf("expected 2 persisted ai_messages rows (user + assistant), got %d", msgCount)
	}

	var sessionCount int
	if err := a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM ai_sessions WHERE session_id = ?`, sessionID).Scan(&sessionCount); err != nil {
		t.Fatalf("querying ai_sessions: %v", err)
	}
	if sessionCount != 1 {
		t.Errorf("expected 1 ai_sessions row, got %d", sessionCount)
	}
}

func TestSendAIMessage_ReusesExistingSession(t *testing.T) {
	a := newTestApp(t)
	provider := &fakeAIProvider{}
	tools := graph.NewToolRegistry(a, nil)

	reg := NewRegistry()
	RegisterStubs(reg)
	RegisterAI(reg, a, provider, tools)

	first, _ := json.Marshal(models.SendAiMessageRequest{WorkspaceID: "ws1", Message: "first turn"})
	resp1 := reg.Dispatch(models.JSONRPCRequest{JSONRPC: "2.0", ID: 1, Method: "send_ai_message", Params: first})
	if resp1.Error != nil {
		t.Fatalf("first turn error: %+v", resp1.Error)
	}
	sessionID := resp1.Result.(map[string]any)["session_id"].(string)

	second, _ := json.Marshal(models.SendAiMessageRequest{WorkspaceID: "ws1", SessionID: &sessionID, Message: "second turn"})
	resp2 := reg.Dispatch(models.JSONRPCRequest{JSONRPC: "2.0", ID: 2, Method: "send_ai_message", Params: second})
	if resp2.Error != nil {
		t.Fatalf("second turn error: %+v", resp2.Error)
	}
	if resp2.Result.(map[string]any)["session_id"] != sessionID {
		t.Errorf("expected the second turn to reuse session_id %q, got %v", sessionID, resp2.Result.(map[string]any)["session_id"])
	}

	var sessionCount int
	if err := a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM ai_sessions`).Scan(&sessionCount); err != nil {
		t.Fatalf("querying ai_sessions: %v", err)
	}
	if sessionCount != 1 {
		t.Errorf("expected exactly 1 ai_sessions row across both turns, got %d", sessionCount)
	}

	var msgCount int
	if err := a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM ai_messages WHERE session_id = ?`, sessionID).Scan(&msgCount); err != nil {
		t.Fatalf("querying ai_messages: %v", err)
	}
	if msgCount != 4 {
		t.Errorf("expected 4 persisted ai_messages rows (2 turns x user+assistant), got %d", msgCount)
	}
}

// fakeProvidersProvider is a minimal scriptable double for
// internal/ai/providers.Provider -- the *real* provider interface (not
// graph's locally-defined one), used to exercise internal/ai's
// providerAdapter (ai.NewProviderAdapter) for real: the OpenAI-wrapped
// graph.ToolSchema/graph.ToolCall shapes must survive a round trip through
// providers' flat ToolSchema/ToolCall shapes and back, and the real
// graph.ToolRegistry must execute the resulting tool call against a real
// *app.App.
//
// Script: call 1 requests the get_clusters tool (arguments as a JSON
// object, matching providers.ToolCall.Arguments' json.RawMessage shape);
// call 2 (made after the tool result round-trips back through the adapter
// into providers.ChatMessage form) returns a plain final answer, ending the
// investigation loop.
type fakeProvidersProvider struct {
	call int
	// lastMessages captures the message slice handed to the 2nd Chat call,
	// so the test can assert the tool-result message the adapter/graph
	// produced actually reached the (simulated) provider in providers'
	// wire shape.
	lastMessages []providers.ChatMessage
}

func (f *fakeProvidersProvider) ListModels(context.Context) ([]string, error) { return nil, nil }

func (f *fakeProvidersProvider) Chat(
	_ context.Context,
	messages []providers.ChatMessage,
	_, _ string,
	_ bool,
	_ []providers.ToolSchema,
) (providers.ChatMessage, error) {
	f.call++
	f.lastMessages = messages
	if f.call == 1 {
		return providers.ChatMessage{
			Role: "assistant",
			ToolCalls: []providers.ToolCall{
				{ID: "call_1", Name: "get_clusters", Arguments: json.RawMessage(`{"workspace_id":"ws1"}`)},
			},
		}, nil
	}
	return providers.ChatMessage{Role: "assistant", Content: "Investigation complete via adapter."}, nil
}

func (f *fakeProvidersProvider) ChatStream(context.Context, []providers.ChatMessage, string, string, bool, []providers.ToolSchema) (<-chan providers.StreamChunk, error) {
	return nil, nil
}

func (f *fakeProvidersProvider) AnalyzeLogs(context.Context, string, []string) (providers.AnalysisResult, error) {
	return providers.AnalysisResult{}, nil
}

func (f *fakeProvidersProvider) TestConnection(context.Context) error { return nil }

// TestSendAIMessage_EndToEnd_ProviderAdapter drives one full send_ai_message
// RPC call through the real dispatch path (internal/rpc -> internal/ai/graph
// -> internal/ai's providerAdapter -> a fake internal/ai/providers.Provider,
// and back), with a real *app.App and the real graph.ToolRegistry executing
// a real tool call (get_clusters) against it -- this is the actual proof
// that the three Phase 3 packages built in isolation now talk to each other
// through internal/ai's adapters, not just that each package's own unit
// tests pass alone.
func TestSendAIMessage_EndToEnd_ProviderAdapter(t *testing.T) {
	a := newTestApp(t)
	fake := &fakeProvidersProvider{}
	provider := ai.NewProviderAdapter(fake)
	tools := graph.NewToolRegistry(a, nil)

	reg := NewRegistry()
	RegisterStubs(reg)
	RegisterAI(reg, a, provider, tools)

	params, _ := json.Marshal(models.SendAiMessageRequest{
		WorkspaceID: "ws1",
		Message:     "show me the top clusters",
	})
	resp := reg.Dispatch(models.JSONRPCRequest{JSONRPC: "2.0", ID: 1, Method: "send_ai_message", Params: params})
	if resp.Error != nil {
		t.Fatalf("send_ai_message returned error: %+v", resp.Error)
	}

	result, ok := resp.Result.(map[string]any)
	if !ok {
		t.Fatalf("unexpected result type %T: %+v", resp.Result, resp.Result)
	}
	sessionID, _ := result["session_id"].(string)
	if sessionID == "" {
		t.Fatal("expected a non-empty session_id")
	}
	if result["response"] != "Investigation complete via adapter." {
		t.Errorf("response = %v", result["response"])
	}
	if fake.call != 2 {
		t.Fatalf("expected exactly 2 provider calls (initial + post-tool-execution), got %d", fake.call)
	}

	// The 2nd Chat call's message history must contain the tool-result
	// message the adapter/graph produced from get_clusters' real (empty,
	// since ws1 has no logs) result, translated into providers.ChatMessage
	// form with role "tool" and the matching tool_call_id -- proving the
	// tool round-trip actually flowed through the adapter rather than the
	// loop terminating early.
	var sawToolResult bool
	for _, m := range fake.lastMessages {
		if m.Role == "tool" && m.ToolCallID == "call_1" && m.Name == "get_clusters" {
			sawToolResult = true
			if m.Content == "" {
				t.Errorf("expected non-empty tool result content")
			}
		}
	}
	if !sawToolResult {
		t.Errorf("expected a role=tool message for call_1/get_clusters in the 2nd Chat call's history, got %+v", fake.lastMessages)
	}

	// Verify persistence: send_ai_message only persists the user + final
	// assistant turns (tool-execution messages live only in the in-memory
	// MissionState for the duration of the run, matching graph.py's own
	// runner.py behavior of never writing intermediate tool turns to the
	// ai_messages table).
	var msgCount int
	if err := a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM ai_messages WHERE session_id = ?`, sessionID).Scan(&msgCount); err != nil {
		t.Fatalf("querying ai_messages: %v", err)
	}
	if msgCount != 2 {
		t.Errorf("expected 2 persisted ai_messages rows (user + assistant), got %d", msgCount)
	}
}

func TestExtractA2UIPayload_JSON(t *testing.T) {
	text := `Here is a column. [[A2UI]]{"type": "add_column", "label": "IP"}[[/A2UI]] Done.`
	got := extractA2UIPayload(text, false)
	if got == nil {
		t.Fatal("expected a non-nil payload")
	}
	if got["type"] != "add_column" || got["label"] != "IP" {
		t.Errorf("unexpected payload: %+v", got)
	}
}

func TestExtractA2UIPayload_NoBlock(t *testing.T) {
	if got := extractA2UIPayload("just plain text", false); got != nil {
		t.Errorf("expected nil for text with no A2UI block, got %+v", got)
	}
}

func TestExtractA2UIPayload_MarkupFallback_NonStrict(t *testing.T) {
	text := "[[A2UI]]not valid json[[/A2UI]]"
	got := extractA2UIPayload(text, false)
	if got == nil || got["type"] != "markup" || !strings.Contains(got["raw"].(string), "not valid json") {
		t.Errorf("expected markup fallback, got %+v", got)
	}
}

func TestExtractA2UIPayload_StrictDropsInvalidJSON(t *testing.T) {
	text := "[[A2UI]]not valid json[[/A2UI]]"
	if got := extractA2UIPayload(text, true); got != nil {
		t.Errorf("expected nil in strict mode for invalid JSON, got %+v", got)
	}
}
