package graph

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

// StreamChunk is one unit of streamed output from Run, mirroring
// runner.py's HybridRunner.run_investigation async generator, which yields
// plain normalised-content strings. Err is set (Content empty) when the
// reasoning node's provider call fails; the channel is closed immediately
// after such a chunk is sent (mirrors the generator simply raising, which
// aiohttp_stream_chat/method_send_ai_message catch around the whole
// `async for` loop).
type StreamChunk struct {
	Content          string
	Err              error
	EvaluationNotice string
	StepNotice       string
	StepDone         bool
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
		if state.WorkspaceID != "" {
			ctx = context.WithValue(ctx, "workspace_id", state.WorkspaceID)
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
					// Ground Reasoning with verified physical facts (catalogs, time range, Laya cluster triage)
					if tools != nil && tools.App() != nil {
						inv, invErr := InspectWorkspace(tools.App(), state.WorkspaceID)
						if invErr == nil && inv != nil {
							groundingHint := inv.FormatGroundedSystemPromptContext()
							state.Messages = append([]ChatMessage{{Role: "system", Content: groundingHint}}, state.Messages...)
						}
					}
					if state.Reasoning {
						reasoningDirective := "Analyze the problem and log context step-by-step. Wrap your preliminary reasoning inside <think> and </think> tags before providing your answer. IMPORTANT: When asked to investigate, find, or analyze logs/errors, you MUST emit tool calls (such as search_logs or get_clusters) to inspect the data rather than merely saying you will do so."
						state.Messages = append([]ChatMessage{{Role: "system", Content: reasoningDirective}}, state.Messages...)
					} else {
						actionDirective := "IMPORTANT: When asked to investigate, find, or analyze logs/errors, you MUST emit tool calls (such as search_logs or get_clusters) to inspect the data rather than merely stating that you will do so."
						state.Messages = append([]ChatMessage{{Role: "system", Content: actionDirective}}, state.Messages...)
					}

					// A2UI Protocol Directive: Teach the model to output interactive UI blueprints organically
					a2uiDirective := `You are equipped with the A2UI (Agent-to-UI) protocol and interactive telemetry tools:
- When the user asks about log volume, history, timeline, trends, or asks to see a graph/chart, you MUST first call 'get_log_timeline' to inspect time-series distribution buckets. If target catalogs are specified in the prompt (e.g. [TARGET CATALOGS: ... (source_id: "xyz")]), you MUST pass their source_ids into get_log_timeline's source_ids array.
- Whenever your response provides findings, answers about amounts/counts, analyzes history/trends, or the user mentions terms like "graph", "chart", "history", "timeline", "amount", "metrics", "show errors", you MUST append an interactive A2UI block at the very end of your response inside [[A2UI]] ... [[/A2UI]].

Supported A2UI Tag Syntax:
1. Time-Series Charts & Histograms:
[[A2UI]] chart_area title="Traffic History" query="*" [[/A2UI]]
If the user or conversation has specific target catalogs attached, specify source_id:
[[A2UI]] chart_area title="Server.log Volume" query="*" source_id="<source_id>" [[/A2UI]]
(Use query="level:ERROR" or any LLQL filter to display specific levels or error trends)
IMPORTANT: Do NOT invent or hardcode time bucket intervals in chart titles (e.g., do NOT write "15-min buckets" or "5s buckets"). Titles must name the entity or stream only (e.g., "Server Log Volume", "Error Rate Timeline"). The engine automatically computes and displays dynamic bucket resolutions.

2. Live Real-Time Metric Counters:
[[A2UI]] metric label="Total Errors" query="level:ERROR" color="error" [[/A2UI]]
(Supported color tags: color="error", color="warn", color="info", color="debug". Add source_id="<source_id>" to scope to a single file).

3. Interactive Drill-down Action Buttons:
[[A2UI]] button label="Filter 522 Errors" action={"type": "filter", "level": "ERROR"} [[/A2UI]]

4. Live Data Tables:
[[A2UI]] data_table title="Top Error Logs" query="level:ERROR" [[/A2UI]]
(Add source_id="<source_id>" to scope to a single file)

You can combine multiple tags sequentially (e.g. chart_area + metric + button). They will render as a unified interactive surface in the user's interface.
If the user query is ambiguous, missing desired time windows or drill-down scope, provide the best immediate high-level telemetry and ask a concise clarifying question.`
					state.Messages = append([]ChatMessage{{Role: "system", Content: a2uiDirective}}, state.Messages...)
				}
			}

			assistantMsg, err := nodeReasoning(ctx, provider, tools, &state)
			if err != nil {
				out <- StreamChunk{Err: err}
				return
			}

			if assistantMsg.Content != "" {
				select {
				case out <- StreamChunk{
					Content: ParseReasoningBlocks(assistantMsg.Content),
				}:
				case <-ctx.Done():
					out <- StreamChunk{Err: ctx.Err()}
					return
				}
			}

			if state.NextNode != NodeToolExecution {
				// If the model completed without emitting any text (e.g. after tool execution),
				// provide a structured summary so the user is never left with an empty bubble.
				if assistantMsg.Content == "" {
					var fallbackText string
					for k := len(state.Messages) - 1; k >= 0; k-- {
						if state.Messages[k].Role == "tool" {
							fallbackText = fmt.Sprintf("Completed action `%s`. Result:\n```json\n%s\n```", state.Messages[k].Name, state.Messages[k].Content)
							break
						}
					}
					if fallbackText == "" {
						fallbackText = "Investigation complete. No additional log anomalies detected."
					}
					select {
					case out <- StreamChunk{Content: fallbackText}:
					case <-ctx.Done():
						out <- StreamChunk{Err: ctx.Err()}
						return
					}
				}
				state.Status = "complete"
				return
			}

			nodeToolExecution(ctx, tools, &state, out)
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
func formatStepLabel(name string, rawArgs string) string {
	switch name {
	case "search_logs":
		var p struct {
			Query string `json:"query"`
		}
		_ = json.Unmarshal([]byte(rawArgs), &p)
		if p.Query != "" {
			return fmt.Sprintf("Searching logs: %s", p.Query)
		}
		return "Searching logs across workspace"
	case "get_clusters":
		return "Inspecting log clusters and patterns"
	case "search_memory":
		return "Searching collective incident memory"
	case "search_knowledge":
		return "Searching runbooks and architecture docs"
	case "get_facets":
		return "Extracting metadata facets (IPs, users)"
	case "get_hierarchy":
		return "Reading source hierarchy and feeds"
	case "create_column":
		return "Configuring custom log view column"
	case "create_facet":
		return "Creating regex log extraction rule"
	default:
		return fmt.Sprintf("Executing tool: %s", name)
	}
}

func nodeToolExecution(ctx context.Context, tools *ToolRegistry, state *MissionState, out chan<- StreamChunk) {
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

		stepDesc := formatStepLabel(name, call.Function.Arguments)
		if out != nil {
			select {
			case out <- StreamChunk{StepNotice: stepDesc}:
			case <-ctx.Done():
				return
			}
		}

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

		if out != nil {
			select {
			case out <- StreamChunk{StepNotice: stepDesc, StepDone: true}:
			case <-ctx.Done():
				return
			}
		}
	}

	if out != nil {
		select {
		case out <- StreamChunk{StepNotice: "Analyzing results and synthesizing answer…"}:
		case <-ctx.Done():
			return
		}
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
