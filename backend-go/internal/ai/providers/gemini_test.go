package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// newTestGeminiProvider builds a GeminiProvider pointed at a test server by
// overriding baseURL directly (GeminiProvider has no host override in its
// public constructor since the real API has a fixed base URL).
func newTestGeminiProvider(baseURL, apiKey, systemPrompt, model string) *GeminiProvider {
	p := NewGeminiProvider(apiKey, systemPrompt, model)
	p.baseURL = baseURL
	return p
}

func TestGeminiChat_RequestBodyAndToolCallParsing(t *testing.T) {
	var capturedBody geminiGenerateRequest
	var capturedKeyHeader string
	var capturedPath string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedPath = r.URL.Path
		capturedKeyHeader = r.Header.Get("x-goog-api-key")
		if err := json.NewDecoder(r.Body).Decode(&capturedBody); err != nil {
			t.Fatalf("decode request: %v", err)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"candidates": [{
				"content": {
					"role": "model",
					"parts": [
						{"text": "Let me check that."},
						{"functionCall": {"name": "get_facets", "args": {"workspace_id": "ws1"}}}
					]
				}
			}]
		}`))
	}))
	defer srv.Close()

	p := newTestGeminiProvider(srv.URL, "AIzaTestKey123", "You are helpful.", "gemini-2.0-flash")
	tools := []ToolSchema{
		{Name: "get_facets", Description: "get facets", Parameters: json.RawMessage(`{"type":"object"}`)},
	}

	reply, err := p.Chat(context.Background(), []ChatMessage{{Role: "user", Content: "what facets exist?"}}, "", "", true, tools)
	if err != nil {
		t.Fatalf("Chat error: %v", err)
	}

	if !strings.Contains(capturedPath, "gemini-2.0-flash:generateContent") {
		t.Errorf("unexpected path: %q", capturedPath)
	}
	if capturedKeyHeader != "AIzaTestKey123" {
		t.Errorf("expected api key header, got %q", capturedKeyHeader)
	}
	if capturedBody.SystemInstruction == nil || capturedBody.SystemInstruction.Parts[0].Text != "You are helpful." {
		t.Errorf("expected system instruction forwarded, got %+v", capturedBody.SystemInstruction)
	}
	if len(capturedBody.Contents) != 1 || capturedBody.Contents[0].Role != "user" {
		t.Errorf("unexpected contents: %+v", capturedBody.Contents)
	}
	if len(capturedBody.Tools) != 1 || len(capturedBody.Tools[0].FunctionDeclarations) != 1 ||
		capturedBody.Tools[0].FunctionDeclarations[0].Name != "get_facets" {
		t.Errorf("tool declarations not forwarded correctly: %+v", capturedBody.Tools)
	}

	if reply.Content != "Let me check that." {
		t.Errorf("unexpected content: %q", reply.Content)
	}
	if len(reply.ToolCalls) != 1 {
		t.Fatalf("expected 1 tool call, got %d", len(reply.ToolCalls))
	}
	tc := reply.ToolCalls[0]
	if tc.Name != "get_facets" {
		t.Errorf("unexpected tool call name: %q", tc.Name)
	}
	if tc.ID == "" {
		t.Errorf("expected a synthesized tool call ID")
	}
	var args map[string]any
	if err := json.Unmarshal(tc.Arguments, &args); err != nil {
		t.Fatalf("arguments not valid JSON: %v", err)
	}
	if args["workspace_id"] != "ws1" {
		t.Errorf("unexpected args: %+v", args)
	}
}

func TestGeminiChat_ToolResultRoleMapping(t *testing.T) {
	var capturedBody geminiGenerateRequest

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&capturedBody)
		_, _ = w.Write([]byte(`{"candidates":[{"content":{"role":"model","parts":[{"text":"ok"}]}}]}`))
	}))
	defer srv.Close()

	p := newTestGeminiProvider(srv.URL, "AIzaTestKey123", "", "gemini-2.0-flash")
	msgs := []ChatMessage{
		{Role: "user", Content: "get facets"},
		{Role: "assistant", ToolCalls: []ToolCall{{ID: "call_0", Name: "get_facets", Arguments: json.RawMessage(`{}`)}}},
		{Role: "tool", Name: "get_facets", ToolCallID: "call_0", Content: `{"ip_count": 3}`},
	}
	if _, err := p.Chat(context.Background(), msgs, "", "", true, nil); err != nil {
		t.Fatalf("Chat error: %v", err)
	}

	if len(capturedBody.Contents) != 3 {
		t.Fatalf("expected 3 contents, got %d: %+v", len(capturedBody.Contents), capturedBody.Contents)
	}
	if capturedBody.Contents[1].Role != "model" || capturedBody.Contents[1].Parts[0].FunctionCall == nil {
		t.Errorf("expected assistant tool call mapped to model+functionCall, got %+v", capturedBody.Contents[1])
	}
	if capturedBody.Contents[2].Role != "function" || capturedBody.Contents[2].Parts[0].FunctionResponse == nil {
		t.Errorf("expected tool message mapped to function+functionResponse, got %+v", capturedBody.Contents[2])
	}
}

func TestGeminiChatStream_SSEParsingWithThinking(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, ":streamGenerateContent") {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "text/event-stream")
		flusher, _ := w.(http.Flusher)

		events := []string{
			`{"candidates":[{"content":{"role":"model","parts":[{"text":"pondering","thought":true}]}}]}`,
			`{"candidates":[{"content":{"role":"model","parts":[{"text":"The "}]}}]}`,
			`{"candidates":[{"content":{"role":"model","parts":[{"text":"answer."}]}}]}`,
		}
		for _, e := range events {
			fmt.Fprintf(w, "data: %s\n\n", e)
			if flusher != nil {
				flusher.Flush()
			}
		}
	}))
	defer srv.Close()

	p := newTestGeminiProvider(srv.URL, "AIzaTestKey123", "", "gemini-2.0-flash")
	ch, err := p.ChatStream(context.Background(), []ChatMessage{{Role: "user", Content: "hi"}}, "", "", true, nil)
	if err != nil {
		t.Fatalf("ChatStream error: %v", err)
	}

	var joined string
	var sawDone bool
	for chunk := range ch {
		if chunk.Err != nil {
			t.Fatalf("chunk error: %v", chunk.Err)
		}
		if chunk.Done {
			sawDone = true
			continue
		}
		joined += chunk.Content
	}

	if !sawDone {
		t.Errorf("expected terminal Done chunk")
	}
	want := "<think>pondering</think>The answer."
	if joined != want {
		t.Errorf("expected %q, got %q", want, joined)
	}
}

func TestGeminiListModels_FiltersByKeyword(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/models" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"models":[
			{"name":"models/gemini-2.0-flash"},
			{"name":"models/gemma-3-27b-it"},
			{"name":"models/text-embedding-004"}
		]}`))
	}))
	defer srv.Close()

	p := newTestGeminiProvider(srv.URL, "AIzaTestKey123", "", "")
	models, err := p.ListModels(context.Background())
	if err != nil {
		t.Fatalf("ListModels error: %v", err)
	}
	if len(models) != 2 {
		t.Errorf("expected 2 gemini/gemma models (embedding filtered out), got %+v", models)
	}
}

func TestGeminiAnalyzeLogs(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req geminiGenerateRequest
		_ = json.NewDecoder(r.Body).Decode(&req)
		if req.GenerationConfig == nil || req.GenerationConfig.ResponseMIMEType != "application/json" {
			t.Errorf("expected application/json responseMimeType, got %+v", req.GenerationConfig)
		}
		_, _ = w.Write([]byte(`{"candidates":[{"content":{"role":"model","parts":[{"text":"{\"summary\":\"s\",\"root_cause\":\"r\",\"recommended_actions\":[\"a\"]}"}]}}]}`))
	}))
	defer srv.Close()

	p := newTestGeminiProvider(srv.URL, "AIzaTestKey123", "", "gemini-2.0-flash")
	result, err := p.AnalyzeLogs(context.Background(), "tmpl", []string{"sample"})
	if err != nil {
		t.Fatalf("AnalyzeLogs error: %v", err)
	}
	if result.Summary != "s" || result.RootCause != "r" || len(result.RecommendedActions) != 1 {
		t.Errorf("unexpected result: %+v", result)
	}
}

func TestGeminiTestConnection_KeyFormatValidation(t *testing.T) {
	p := NewGeminiProvider("not-a-valid-key", "", "")
	if err := p.TestConnection(context.Background()); err == nil {
		t.Errorf("expected error for malformed API key")
	}

	empty := NewGeminiProvider("", "", "")
	if err := empty.TestConnection(context.Background()); err == nil {
		t.Errorf("expected error for missing API key")
	}
}
