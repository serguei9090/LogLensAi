package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOpenAICompatibleChat_RequestBodyAndToolCallParsing(t *testing.T) {
	var capturedBody openAIChatRequest
	var capturedAuth string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat/completions" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		capturedAuth = r.Header.Get("Authorization")
		if err := json.NewDecoder(r.Body).Decode(&capturedBody); err != nil {
			t.Fatalf("decode request: %v", err)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"choices": [{
				"message": {
					"content": "Sure, calling a tool.",
					"tool_calls": [{
						"id": "call_abc",
						"type": "function",
						"function": {"name": "get_clusters", "arguments": "{\"workspace_id\":\"ws1\"}"}
					}]
				}
			}]
		}`))
	}))
	defer srv.Close()

	p := NewOpenAICompatibleProvider("sk-test", "be concise", srv.URL, "gpt-4o")
	tools := []ToolSchema{
		{Name: "get_clusters", Description: "get clusters", Parameters: json.RawMessage(`{"type":"object"}`)},
	}

	reply, err := p.Chat(context.Background(), []ChatMessage{{Role: "user", Content: "show clusters"}}, "", "", true, tools)
	if err != nil {
		t.Fatalf("Chat error: %v", err)
	}

	if capturedAuth != "Bearer sk-test" {
		t.Errorf("expected Authorization header, got %q", capturedAuth)
	}
	if capturedBody.Model != "gpt-4o" {
		t.Errorf("unexpected model: %q", capturedBody.Model)
	}
	if len(capturedBody.Messages) != 2 || capturedBody.Messages[0].Role != "system" {
		t.Errorf("expected system+user messages, got %+v", capturedBody.Messages)
	}
	if len(capturedBody.Tools) != 1 {
		t.Errorf("expected 1 tool forwarded, got %d", len(capturedBody.Tools))
	}

	if reply.Content != "Sure, calling a tool." {
		t.Errorf("unexpected content: %q", reply.Content)
	}
	if len(reply.ToolCalls) != 1 {
		t.Fatalf("expected 1 tool call, got %d", len(reply.ToolCalls))
	}
	tc := reply.ToolCalls[0]
	if tc.ID != "call_abc" || tc.Name != "get_clusters" {
		t.Errorf("unexpected tool call: %+v", tc)
	}
	var args map[string]any
	if err := json.Unmarshal(tc.Arguments, &args); err != nil {
		t.Fatalf("arguments not valid JSON: %v (raw: %s)", err, tc.Arguments)
	}
	if args["workspace_id"] != "ws1" {
		t.Errorf("unexpected args: %+v", args)
	}
}

func TestOpenAICompatibleChatStream_SSEParsing(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req openAIChatRequest
		_ = json.NewDecoder(r.Body).Decode(&req)
		if !req.Stream {
			t.Errorf("expected stream=true")
		}

		w.Header().Set("Content-Type", "text/event-stream")
		flusher, _ := w.(http.Flusher)

		chunks := []string{
			`{"choices":[{"delta":{"content":"Hel"}}]}`,
			`{"choices":[{"delta":{"content":"lo"}}]}`,
			`{"choices":[{"delta":{}}]}`,
		}
		for _, c := range chunks {
			fmt.Fprintf(w, "data: %s\n\n", c)
			if flusher != nil {
				flusher.Flush()
			}
		}
		fmt.Fprintf(w, "data: [DONE]\n\n")
		if flusher != nil {
			flusher.Flush()
		}
	}))
	defer srv.Close()

	p := NewOpenAICompatibleProvider("", "", srv.URL, "gpt-4o")
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
	if joined != "Hello" {
		t.Errorf("expected joined content 'Hello', got %q", joined)
	}
}

func TestOpenAICompatibleListModels_DataShape(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/models" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"data":[{"id":"gpt-4o"},{"id":"gpt-4o-mini"}]}`))
	}))
	defer srv.Close()

	p := NewOpenAICompatibleProvider("", "", srv.URL, "")
	models, err := p.ListModels(context.Background())
	if err != nil {
		t.Fatalf("ListModels error: %v", err)
	}
	if len(models) != 2 || models[0] != "gpt-4o" {
		t.Errorf("unexpected models: %+v", models)
	}
}

func TestOpenAICompatibleListModels_ModelsKeyShape(t *testing.T) {
	// LM Studio-style response using "models"/"key" instead of "data"/"id".
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"models":[{"key":"local-model-1"}]}`))
	}))
	defer srv.Close()

	p := NewOpenAICompatibleProvider("", "", srv.URL, "")
	models, err := p.ListModels(context.Background())
	if err != nil {
		t.Fatalf("ListModels error: %v", err)
	}
	if len(models) != 1 || models[0] != "local-model-1" {
		t.Errorf("unexpected models: %+v", models)
	}
}

func TestOpenAICompatibleAnalyzeLogs(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req openAIChatRequest
		_ = json.NewDecoder(r.Body).Decode(&req)
		if req.ResponseFormat == nil || req.ResponseFormat.Type != "json_object" {
			t.Errorf("expected json_object response_format, got %+v", req.ResponseFormat)
		}
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"{\"summary\":\"s\",\"root_cause\":\"r\",\"recommended_actions\":[\"a\",\"b\"]}"}}]}`))
	}))
	defer srv.Close()

	p := NewOpenAICompatibleProvider("", "", srv.URL, "gpt-4o")
	result, err := p.AnalyzeLogs(context.Background(), "tmpl", []string{"sample"})
	if err != nil {
		t.Fatalf("AnalyzeLogs error: %v", err)
	}
	if result.Summary != "s" || result.RootCause != "r" || len(result.RecommendedActions) != 2 {
		t.Errorf("unexpected result: %+v", result)
	}
}

func TestOpenAICompatibleTestConnection(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"data":[{"id":"gpt-4o"}]}`))
	}))
	defer srv.Close()

	p := NewOpenAICompatibleProvider("", "", srv.URL, "")
	if err := p.TestConnection(context.Background()); err != nil {
		t.Errorf("expected success, got %v", err)
	}

	empty := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"data":[]}`))
	}))
	defer empty.Close()

	p2 := NewOpenAICompatibleProvider("", "", empty.URL, "")
	if err := p2.TestConnection(context.Background()); err == nil {
		t.Errorf("expected error for empty model list")
	}
}
