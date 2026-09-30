package graph

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"loglensai/backend-go/internal/ai/laya"
)

// StreamChunk is one unit of streamed output from Run, mirroring
// runner.py's HybridRunner.run_investigation async generator, which yields
// plain normalised-content strings. Err is set (Content empty) when the
// reasoning node's provider call fails; the channel is closed immediately
// after such a chunk is sent (mirrors the generator simply raising, which
// aiohttp_stream_chat/method_send_ai_message catch around the whole
// `async for` loop).
type StreamChunk struct {
	Content string
	Err     error
}

// maxIterations caps the reasoning<->tool_execution loop. graph.py/LangGraph
// have no such cap (a checkpointed graph can in principle loop forever if
// the model keeps requesting tools), but an unbounded goroutine loop in a
// long-running server process is a real resource-exhaustion risk a script
// interpreter's per-request process lifetime hides -- this is a deliberate,
// idiomatic-Go addition, not a ported behavior. On exceeding it, Run treats
// the mission as ended (falls through to final_answer) rather than erroring.
const maxIterations = 25

// Run executes the investigation state machine starting from initialState
// (which must already have the new user message appended to
// initialState.Messages, matching how runner.py's run_investigation appends
// the user message to state["messages"] before starting the graph),
// streaming one StreamChunk per reasoning-node completion on the returned
// channel. This mirrors runner.py's behavior of only yielding output from
// the "reasoning" node (never tool_execution or final_answer) to avoid a
// "double response" -- see runner.py's comment on the same line.
//
// The three graph.py nodes are direct function calls / a loop here rather
// than a ported graph-execution framework:
//
//	reasoning -> (tool calls present, or "TOOL_CALL:" fallback marker in
//	  raw content) -> tool_execution -> reasoning -> ... -> final_answer.
//
// tools may be nil, in which case any tool-call request immediately becomes
// a "Tool <name> not found"-shaped error per call (matching an empty
// ToolRegistry).
func Run(ctx context.Context, provider Provider, tools *ToolRegistry, initialState MissionState) (<-chan StreamChunk, error) {
	if provider == nil {
		return nil, fmt.Errorf("graph: Run requires a non-nil Provider")
	}

	out := make(chan StreamChunk)

	go func() {
		defer close(out)

		state := initialState
		if state.Messages == nil {
			state.Messages = []ChatMessage{}
		}
		state.Status = "started"

		for i := 0; i < maxIterations; i++ {
			select {
			case <-ctx.Done():
				out <- StreamChunk{Err: ctx.Err()}
				return
			default:
			}

			if i == 0 && len(state.Messages) > 0 {
				var lastUserMsg string
				for j := len(state.Messages) - 1; j >= 0; j-- {
					if state.Messages[j].Role == "user" {
						lastUserMsg = state.Messages[j].Content
						break
					}
				}
				if lastUserMsg != "" {
					if routed, err := RouteWithLaya(ctx, tools, lastUserMsg); err == nil && routed != nil && routed.Confidence >= 0.85 {
						state.Status = fmt.Sprintf("laya_routed:%s:%.2f", routed.SelectedLabel, routed.Confidence)
						hint := fmt.Sprintf("[Laya System 1 Router: User intent classified as %q (confidence: %.2f). Prioritize selecting this tool if applicable.]", routed.SelectedLabel, routed.Confidence)
						state.Messages = append([]ChatMessage{{Role: "system", Content: hint}}, state.Messages...)
					}
				}
			}

			assistantMsg, err := nodeReasoning(ctx, provider, tools, &state)
			if err != nil {
				out <- StreamChunk{Err: err}
				return
			}

			select {
			case out <- StreamChunk{Content: ParseReasoningBlocks(assistantMsg.Content)}:
			case <-ctx.Done():
				out <- StreamChunk{Err: ctx.Err()}
				return
			}

			if state.NextNode != NodeToolExecution {
				// final_answer is a no-op terminal node (graph.py's
				// _node_final_answer just returns state unchanged) -- there
				// is nothing further to do or emit.
				state.Status = "complete"
				return
			}

			nodeToolExecution(ctx, tools, &state)
			// tool_execution always loops back to reasoning (graph.py's
			// unconditional add_edge("tool_execution", "reasoning")).
		}
	}()

	return out, nil
}

// nodeReasoning ports graph.py's _node_reasoning: calls the provider with
// the full message history and tool schemas, appends the assistant response
// to state.Messages, and decides NextNode via the same three-way check
// _should_continue/_node_reasoning use (real tool_calls, the "TOOL_CALL:"
// fallback marker, or neither).
func nodeReasoning(ctx context.Context, provider Provider, tools *ToolRegistry, state *MissionState) (ChatMessage, error) {
	var schemas []ToolSchema
	if tools != nil {
		schemas = tools.Schemas()
	}

	response, err := provider.Chat(ctx, state.Messages, state.SessionID, state.Model, state.Reasoning, schemas)
	if err != nil {
		return ChatMessage{}, err
	}

	assistantMsg := ChatMessage{Role: "assistant", Content: response.Content}
	if len(response.ToolCalls) > 0 {
		assistantMsg.ToolCalls = response.ToolCalls
	}
	state.Messages = append(state.Messages, assistantMsg)

	switch {
	case len(response.ToolCalls) > 0:
		state.NextNode = NodeToolExecution
	case containsToolCallMarker(response.Content):
		// Fallback heuristic, mirroring graph.py's
		// `elif "TOOL_CALL:" in response.content`.
		state.NextNode = NodeToolExecution
	default:
		state.NextNode = NodeFinalAnswer
	}

	return assistantMsg, nil
}

func containsToolCallMarker(content string) bool {
	return strings.Contains(content, "TOOL_CALL:")
}

// nodeToolExecution ports graph.py's _node_tool_execution: dispatches every
// tool call on the last assistant message, appending one "tool" role
// message per call. Each call's execution is isolated -- an error from one
// tool call becomes {"error": ...} content for that call's message rather
// than aborting the others or the turn, matching graph.py's
// try/except-per-call loop. When the last message has no tool_calls array
// at all (the "TOOL_CALL:" fallback path), a single system message is
// appended instead, matching graph.py's fallback branch exactly.
func nodeToolExecution(ctx context.Context, tools *ToolRegistry, state *MissionState) {
	if len(state.Messages) == 0 {
		return
	}
	last := state.Messages[len(state.Messages)-1]

	if len(last.ToolCalls) == 0 {
		state.Messages = append(state.Messages, ChatMessage{
			Role:    "system",
			Content: "No tool_calls array provided by model, but tool execution triggered.",
		})
		return
	}

	for _, call := range last.ToolCalls {
		name := call.Function.Name
		callID := call.ID

		result, err := executeToolCall(ctx, tools, name, call.Function.Arguments)

		var contentBytes []byte
		if err != nil {
			contentBytes, _ = json.Marshal(map[string]any{"error": err.Error()})
		} else {
			contentBytes, err = json.Marshal(result)
			if err != nil {
				contentBytes, _ = json.Marshal(map[string]any{"error": err.Error()})
			}
		}

		state.Messages = append(state.Messages, ChatMessage{
			Role:       "tool",
			Content:    string(contentBytes),
			ToolCallID: callID,
			Name:       name,
		})
	}
}

// executeToolCall runs one tool call through the registry, recovering from
// a panicking tool implementation into an error result -- Go has no
// exception mechanism to catch inside ToolRegistry.Execute itself, so the
// per-call isolation graph.py gets from a Python try/except is reproduced
// here at the call site instead.
func executeToolCall(ctx context.Context, tools *ToolRegistry, name, rawArgs string) (result any, err error) {
	defer func() {
		if p := recover(); p != nil {
			err = fmt.Errorf("tool %s panicked: %v", name, p)
		}
	}()

	if tools == nil {
		return map[string]any{"error": fmt.Sprintf("Tool %s not found", name)}, nil
	}
	return tools.Execute(ctx, name, json.RawMessage(rawArgs))
}

// RouteWithLaya evaluates userText with Laya System 1 decision engine if enabled.
// Returns nil if Laya is not configured, disabled, or if intent question is absent.
func RouteWithLaya(ctx context.Context, tools *ToolRegistry, userText string) (*laya.DecisionResult, error) {
	if tools == nil || tools.app == nil || tools.app.LayaManager == nil || tools.app.LayaEngine == nil {
		return nil, nil
	}
	settings := tools.app.LayaManager.GetSettings()
	if !settings.Enabled {
		return nil, nil
	}
	questions := tools.app.LayaManager.GetActiveQuestions()
	intentQuestion, ok := questions["tool_intent"]
	if !ok {
		return nil, nil
	}
	return tools.app.LayaEngine.Predict(ctx, intentQuestion, userText)
}
