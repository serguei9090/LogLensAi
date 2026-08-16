package graph

// MissionState is the Go analogue of sidecar/src/ai/graph.py's MissionState
// TypedDict -- the state threaded through every node of the investigation
// graph.
type MissionState struct {
	WorkspaceID string
	SessionID   string
	Messages    []ChatMessage
	Model       string
	Reasoning   bool
	NextNode    string // "reasoning" | "tool_execution" | "final_answer"
	Status      string
	Metadata    map[string]any
}

// Node name constants, mirroring graph.py's node identifiers used in
// add_node/add_conditional_edges.
const (
	NodeReasoning     = "reasoning"
	NodeToolExecution = "tool_execution"
	NodeFinalAnswer   = "final_answer"
)
