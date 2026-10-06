package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOllamaChat_RequestBodyAndToolCallParsing(t *testing.T) {
	var capturedBody ollamaChatRequest

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/chat" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if err := json.NewDecoder(r.Body).Decode(&capturedBody); err != nil {
			t.Fatalf("decode request body: %v", err)
		}

		resp := ollamaChatResponse{
			Message: ollamaChatResponseMessage{
				Content: "Here are the logs you asked for.",
				ToolCalls: []ollamaToolWire{
					{
						Function: ollamaToolFunctionWire{
							Name:      "search_logs",
							Arguments: json.RawMessage(`{"workspace_id":"ws1","limit":10}`),
						},
					},
				},
			},
			Done: true,
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer srv.Close()

	p := NewOllamaProvider(srv.URL, "you are helpful", "llama3")

	tools := []ToolSchema{
		{Name: "search_logs", Description: "search logs", Parameters: json.RawMessage(`{"type":"object"}`)},
	}
	msgs := []ChatMessage{
		{Role: "user", Content: "find errors"},
	}

	reply, err := p.Chat(context.Background(), msgs, "session1", "", true, tools)
	if err != nil {
		t.Fatalf("Chat returned error: %v", err)
	}

	if capturedBody.Model != "llama3" {
		t.Errorf("expected model llama3, got %q", capturedBody.Model)
	}
	if capturedBody.Stream {
		t.Errorf("expected stream=false for non-streaming Chat")
	}
	if len(capturedBody.Tools) != 1 || capturedBody.Tools[0].Function.Name != "search_logs" {
		t.Errorf("tool schema not forwarded correctly: %+v", capturedBody.Tools)
	}
	// system prompt should be injected as first message
	if len(capturedBody.Messages) < 2 || capturedBody.Messages[0].Role != "system" {
		t.Errorf("expected system message first, got: %+v", capturedBody.Messages)
	}

	if reply.Role != "assistant" {
		t.Errorf("expected assistant role, got %q", reply.Role)
	}
	if reply.Content != "Here are the logs you asked for." {
		t.Errorf("unexpected content: %q", reply.Content)
	}
	if len(reply.ToolCalls) != 1 {
		t.Fatalf("expected 1 normalized tool call, got %d", len(reply.ToolCalls))
	}
	tc := reply.ToolCalls[0]
	if tc.Name != "search_logs" {
		t.Errorf("expected tool call name search_logs, got %q", tc.Name)
	}
	var args map[string]any
	if err := json.Unmarshal(tc.Arguments, &args); err != nil {
		t.Fatalf("tool call arguments not valid JSON: %v", err)
	}
	if args["workspace_id"] != "ws1" {
		t.Errorf("unexpected arguments: %+v", args)
	}
}

func TestOllamaChat_NativeThinkingWrapped(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := ollamaChatResponse{
			Message: ollamaChatResponseMessage{
				Content:  "The answer is 42.",
				Thinking: "Let me reason step by step.",
			},
			Done: true,
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer srv.Close()

	p := NewOllamaProvider(srv.URL, "", "gemma4:e2b")
	reply, err := p.Chat(context.Background(), []ChatMessage{{Role: "user", Content: "why?"}}, "", "", true, nil)
	if err != nil {
		t.Fatalf("Chat error: %v", err)
	}

	want := "<think>Let me reason step by step.</think>The answer is 42."
	if reply.Content != want {
		t.Errorf("expected wrapped thinking content %q, got %q", want, reply.Content)
	}
}

func TestOllamaChat_HTTPErrorSurfacesAsAssistantMessage(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("model not found"))
	}))
	defer srv.Close()

	p := NewOllamaProvider(srv.URL, "", "llama3")
	reply, err := p.Chat(context.Background(), []ChatMessage{{Role: "user", Content: "hi"}}, "", "", true, nil)
	if err != nil {
		t.Fatalf("expected nil Go error for HTTP failure (parity w/ Python), got: %v", err)
	}
	if reply.Role != "assistant" {
		t.Errorf("expected assistant role on error, got %q", reply.Role)
	}
	if reply.Content == "" {
		t.Errorf("expected non-empty error content")
	}
}

func TestOllamaChatStream_NDJSONParsing(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req ollamaChatRequest
		_ = json.NewDecoder(r.Body).Decode(&req)
		if !req.Stream {
			t.Errorf("expected stream=true in streaming request")
		}

		w.Header().Set("Content-Type", "application/x-ndjson")
		flusher, _ := w.(http.Flusher)

		lines := []ollamaChatResponse{
			{Message: ollamaChatResponseMessage{Thinking: "thinking about it"}},
			{Message: ollamaChatResponseMessage{Content: "Hello"}},
			{Message: ollamaChatResponseMessage{Content: " world"}, Done: true},
		}
		for _, l := range lines {
			b, _ := json.Marshal(l)
			fmt.Fprintf(w, "%s\n", b)
			if flusher != nil {
				flusher.Flush()
			}
		}
	}))
	defer srv.Close()

	p := NewOllamaProvider(srv.URL, "", "llama3")
	ch, err := p.ChatStream(context.Background(), []ChatMessage{{Role: "user", Content: "hi"}}, "", "", true, nil)
	if err != nil {
		t.Fatalf("ChatStream error: %v", err)
	}

	var got []string
	var sawDone bool
	for chunk := range ch {
		if chunk.Err != nil {
			t.Fatalf("stream chunk error: %v", chunk.Err)
		}
		if chunk.Done {
			sawDone = true
			continue
		}
		got = append(got, chunk.Content)
	}

	if !sawDone {
		t.Errorf("expected a Done=true terminal chunk")
	}

	joined := ""
	for _, g := range got {
		joined += g
	}
	want := "<think>thinking about it</think>Hello world"
	if joined != want {
		t.Errorf("expected joined stream %q, got %q (parts: %#v)", want, joined, got)
	}
}

func TestOllamaListModels_ErrorOnFailure(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer srv.Close()

	p := NewOllamaProvider(srv.URL, "", "")
	_, err := p.ListModels(context.Background())
	if err == nil {
		t.Fatalf("expected error on failure, got nil")
	}
}

func TestOllamaListModels_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/tags" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(ollamaTagsResponse{
			Models: []struct {
				Name string `json:"name"`
			}{{Name: "llama3"}, {Name: "mistral"}},
		})
	}))
	defer srv.Close()

	p := NewOllamaProvider(srv.URL, "", "")
	models, err := p.ListModels(context.Background())
	if err != nil {
		t.Fatalf("ListModels error: %v", err)
	}
	if len(models) != 2 || models[0] != "llama3" || models[1] != "mistral" {
		t.Errorf("unexpected models: %+v", models)
	}
}

func TestOllamaAnalyzeLogs(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/generate" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		var req ollamaGenerateRequest
		_ = json.NewDecoder(r.Body).Decode(&req)
		if req.Format != "json" {
			t.Errorf("expected format=json, got %q", req.Format)
		}
		resp := ollamaGenerateResponse{
			Response: `{"summary":"disk full","root_cause":"no space","recommended_actions":["clean logs"]}`,
		}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer srv.Close()

	p := NewOllamaProvider(srv.URL, "", "llama3")
	result, err := p.AnalyzeLogs(context.Background(), "disk full on {device}", []string{"disk full on /dev/sda1"})
	if err != nil {
		t.Fatalf("AnalyzeLogs error: %v", err)
	}
	if result.Summary != "disk full" || result.RootCause != "no space" || len(result.RecommendedActions) != 1 {
		t.Errorf("unexpected result: %+v", result)
	}
}

func TestOllamaTestConnection(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(ollamaTagsResponse{})
	}))
	defer srv.Close()

	p := NewOllamaProvider(srv.URL, "", "")
	if err := p.TestConnection(context.Background()); err != nil {
		t.Errorf("expected success, got %v", err)
	}

	bad := NewOllamaProvider("http://127.0.0.1:1", "", "")
	if err := bad.TestConnection(context.Background()); err == nil {
		t.Errorf("expected error for unreachable host")
	}
}
