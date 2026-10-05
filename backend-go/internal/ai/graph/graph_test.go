package graph

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

// fakeProvider is a scriptable Provider double: respond is called once per
// Chat() invocation with the 0-based call index and a snapshot of the
// messages passed in, and returns the response to hand back.
type fakeProvider struct {
	calls   [][]ChatMessage
	idx     int
	respond func(call int, messages []ChatMessage) (ChatMessage, error)
}

func (f *fakeProvider) Chat(_ context.Context, messages []ChatMessage, _ string, _ string, _ bool, _ []ToolSchema) (ChatMessage, error) {
	snapshot := append([]ChatMessage(nil), messages...)
	f.calls = append(f.calls, snapshot)
	call := f.idx
	f.idx++
	return f.respond(call, snapshot)
}

func drainChunks(t *testing.T, ch <-chan StreamChunk) []StreamChunk {
	t.Helper()
	var out []StreamChunk
	timeout := time.After(5 * time.Second)
	for {
		select {
		case c, ok := <-ch:
			if !ok {
				return out
			}
			out = append(out, c)
		case <-timeout:
			t.Fatal("timed out waiting for Run to finish")
		}
	}
}

func drainContentChunks(t *testing.T, ch <-chan StreamChunk) []StreamChunk {
	t.Helper()
	var out []StreamChunk
	for _, c := range drainChunks(t, ch) {
		if c.Content != "" || c.Err != nil {
			out = append(out, c)
		}
	}
	return out
}

func TestRun_ReasoningToFinalAnswer_NoToolCalls(t *testing.T) {
	p := &fakeProvider{respond: func(_ int, _ []ChatMessage) (ChatMessage, error) {
		return ChatMessage{Role: "assistant", Content: "The answer is 42."}, nil
	}}

	state := MissionState{
		WorkspaceID: "ws1",
		SessionID:   "s1",
		Messages:    []ChatMessage{{Role: "user", Content: "what is the answer?"}},
		NextNode:    NodeReasoning,
	}

	ch, err := Run(context.Background(), p, nil, state)
	if err != nil {
		t.Fatalf("Run returned error: %v", err)
	}
	chunks := drainChunks(t, ch)

	if len(chunks) != 1 {
		t.Fatalf("expected exactly 1 chunk (no tool calls -> straight to final_answer), got %d: %+v", len(chunks), chunks)
	}
	if chunks[0].Err != nil {
		t.Fatalf("unexpected error chunk: %v", chunks[0].Err)
	}
	if chunks[0].Content != "The answer is 42." {
		t.Errorf("content = %q", chunks[0].Content)
	}
	if p.idx != 1 {
		t.Errorf("expected exactly 1 provider call, got %d", p.idx)
	}
}

func TestRun_ToolExecutionLoop(t *testing.T) {
	tools := NewToolRegistry(nil, nil)
	tools.Register("echo", ToolSchema{Type: "function", Function: ToolFunctionSchema{Name: "echo"}},
		func(_ context.Context, args json.RawMessage) (any, error) {
			return map[string]any{"echoed": string(args)}, nil
		})

	p := &fakeProvider{respond: func(call int, messages []ChatMessage) (ChatMessage, error) {
		switch call {
		case 0:
			return ChatMessage{
				Role:    "assistant",
				Content: "Let me check the logs.",
				ToolCalls: []ToolCall{
					{ID: "call-1", Type: "function", Function: ToolCallFunction{Name: "echo", Arguments: `{"x":1}`}},
				},
			}, nil
		case 1:
			// The immediately preceding message must be the tool result
			// for call-1, appended by the tool_execution node.
			last := messages[len(messages)-1]
			if last.Role != "tool" || last.ToolCallID != "call-1" || last.Name != "echo" {
				t.Errorf("expected tool result message for call-1/echo, got %+v", last)
			}
			if !strings.Contains(last.Content, "echoed") {
				t.Errorf("expected echoed tool result content, got %q", last.Content)
			}
			return ChatMessage{Role: "assistant", Content: "Done."}, nil
		default:
			t.Fatalf("unexpected 3rd provider call")
			return ChatMessage{}, nil
		}
	}}

	state := MissionState{
		WorkspaceID: "ws1",
		SessionID:   "s1",
		Messages:    []ChatMessage{{Role: "user", Content: "investigate"}},
		NextNode:    NodeReasoning,
	}

	ch, err := Run(context.Background(), p, tools, state)
	if err != nil {
		t.Fatalf("Run returned error: %v", err)
	}
	chunks := drainContentChunks(t, ch)

	if len(chunks) != 2 {
		t.Fatalf("expected 2 content chunks (one per reasoning-node visit), got %d: %+v", len(chunks), chunks)
	}
	if chunks[0].Content != "Let me check the logs." {
		t.Errorf("chunk 0 = %q", chunks[0].Content)
	}
	if chunks[1].Content != "Done." {
		t.Errorf("chunk 1 = %q", chunks[1].Content)
	}
	if p.idx != 2 {
		t.Errorf("expected exactly 2 provider calls, got %d", p.idx)
	}
}

func TestRun_ToolCallErrorDoesNotAbortTurn(t *testing.T) {
	tools := NewToolRegistry(nil, nil)
	tools.Register("boom", ToolSchema{Type: "function", Function: ToolFunctionSchema{Name: "boom"}},
		func(_ context.Context, _ json.RawMessage) (any, error) {
			return nil, errBoom
		})

	p := &fakeProvider{respond: func(call int, messages []ChatMessage) (ChatMessage, error) {
		switch call {
		case 0:
			return ChatMessage{
				Role:    "assistant",
				Content: "Trying a risky tool.",
				ToolCalls: []ToolCall{
					{ID: "call-err", Type: "function", Function: ToolCallFunction{Name: "boom", Arguments: `{}`}},
				},
			}, nil
		case 1:
			last := messages[len(messages)-1]
			if last.Role != "tool" || last.ToolCallID != "call-err" {
				t.Errorf("expected a tool-error result message for call-err, got %+v", last)
			}
			if !strings.Contains(last.Content, "error") {
				t.Errorf("expected error content, got %q", last.Content)
			}
			// The turn must continue -- this second call proves the failed
			// tool call did not abort the mission.
			return ChatMessage{Role: "assistant", Content: "Recovered."}, nil
		default:
			t.Fatalf("unexpected 3rd provider call")
			return ChatMessage{}, nil
		}
	}}

	state := MissionState{
		SessionID: "s1",
		Messages:  []ChatMessage{{Role: "user", Content: "investigate"}},
		NextNode:  NodeReasoning,
	}

	ch, err := Run(context.Background(), p, tools, state)
	if err != nil {
		t.Fatalf("Run returned error: %v", err)
	}
	chunks := drainContentChunks(t, ch)

	if len(chunks) != 2 {
		t.Fatalf("expected 2 chunks, got %d: %+v", len(chunks), chunks)
	}
	if chunks[1].Content != "Recovered." {
		t.Errorf("chunk 1 = %q, expected the turn to continue past the failed tool call", chunks[1].Content)
	}
}

func TestRun_ToolCallFallbackMarker(t *testing.T) {
	p := &fakeProvider{respond: func(call int, messages []ChatMessage) (ChatMessage, error) {
		switch call {
		case 0:
			// No ToolCalls array at all -- only the raw "TOOL_CALL:" marker
			// in content, matching graph.py's heuristic fallback branch.
			return ChatMessage{Role: "assistant", Content: "I will use TOOL_CALL: search_logs now"}, nil
		case 1:
			last := messages[len(messages)-1]
			if last.Role != "system" {
				t.Fatalf("expected fallback system message, got role %q", last.Role)
			}
			if !strings.Contains(last.Content, "No tool_calls array provided by model") {
				t.Errorf("unexpected fallback system message: %q", last.Content)
			}
			return ChatMessage{Role: "assistant", Content: "OK, done without a real tool call."}, nil
		default:
			t.Fatalf("unexpected 3rd provider call")
			return ChatMessage{}, nil
		}
	}}

	state := MissionState{
		SessionID: "s1",
		Messages:  []ChatMessage{{Role: "user", Content: "investigate"}},
		NextNode:  NodeReasoning,
	}

	ch, err := Run(context.Background(), p, nil, state)
	if err != nil {
		t.Fatalf("Run returned error: %v", err)
	}
	chunks := drainChunks(t, ch)

	if len(chunks) != 2 {
		t.Fatalf("expected 2 chunks, got %d: %+v", len(chunks), chunks)
	}
	if p.idx != 2 {
		t.Errorf("expected exactly 2 provider calls, got %d", p.idx)
	}
}

func TestRun_ProviderErrorPropagates(t *testing.T) {
	p := &fakeProvider{respond: func(_ int, _ []ChatMessage) (ChatMessage, error) {
		return ChatMessage{}, errBoom
	}}

	state := MissionState{SessionID: "s1", Messages: []ChatMessage{{Role: "user", Content: "hi"}}, NextNode: NodeReasoning}
	ch, err := Run(context.Background(), p, nil, state)
	if err != nil {
		t.Fatalf("Run returned error: %v", err)
	}
	chunks := drainChunks(t, ch)
	if len(chunks) != 1 || chunks[0].Err == nil {
		t.Fatalf("expected a single error chunk, got %+v", chunks)
	}
}

func TestRun_MaxIterationsCapsInfiniteToolLoop(t *testing.T) {
	// A provider that always requests a (nonexistent) tool call would loop
	// reasoning<->tool_execution forever without a safety cap -- Run must
	// terminate at maxIterations rather than hang.
	p := &fakeProvider{respond: func(_ int, _ []ChatMessage) (ChatMessage, error) {
		return ChatMessage{
			Role:    "assistant",
			Content: "still going",
			ToolCalls: []ToolCall{
				{ID: "x", Type: "function", Function: ToolCallFunction{Name: "nonexistent", Arguments: `{}`}},
			},
		}, nil
	}}

	state := MissionState{SessionID: "s1", Messages: []ChatMessage{{Role: "user", Content: "hi"}}, NextNode: NodeReasoning}
	ch, err := Run(context.Background(), p, nil, state)
	if err != nil {
		t.Fatalf("Run returned error: %v", err)
	}
	chunks := drainContentChunks(t, ch)
	if len(chunks) != maxIterations {
		t.Fatalf("expected Run to stop after maxIterations=%d chunks, got %d", maxIterations, len(chunks))
	}
}

var errBoom = boomError("boom")

type boomError string

func (e boomError) Error() string { return string(e) }
