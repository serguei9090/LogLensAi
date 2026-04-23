import logging
from typing import Any, Literal, TypedDict

from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.graph import END, StateGraph

logger = logging.getLogger(__name__)


class MissionState(TypedDict):
    """The state of the investigation mission."""

    workspace_id: str
    session_id: str
    messages: list[dict]
    model: str | None
    reasoning: bool | None
    next_node: str
    status: str
    metadata: dict[str, Any]


class GraphManager:
    """Manages the LangGraph state machine for LogLens AI."""

    def __init__(self, provider: Any, tool_registry: Any, db_path: str = "data/checkpoints.sqlite"):
        self.db_path = db_path
        self.provider = provider
        self.tools = tool_registry
        self.memory = None  # Initialized in build_graph
        self.workflow = None
        self._saver_cm = None

    async def initialize(self):
        """Asynchronously initialize the graph and its checkpointer."""
        if self.memory is None:
            # Persistent connection for checkpointer
            # AsyncSqliteSaver needs an aiosqlite connection or conn string
            self._saver_cm = AsyncSqliteSaver.from_conn_string(self.db_path)
            self.memory = await self._saver_cm.__aenter__()
            self.workflow = self._build_graph()

    async def close(self):
        """Cleanly close the checkpointer."""
        if self._saver_cm:
            await self._saver_cm.__aexit__(None, None, None)
            self._saver_cm = None
            self.memory = None

    def _build_graph(self):
        """Constructs the LangGraph workflow."""
        builder = StateGraph(MissionState)

        # Nodes
        builder.add_node("reasoning", self._node_reasoning)
        builder.add_node("tool_execution", self._node_tool_execution)
        builder.add_node("final_answer", self._node_final_answer)

        # Edges
        builder.set_entry_point("reasoning")
        builder.add_conditional_edges(
            "reasoning",
            self._should_continue,
            {"continue": "tool_execution", "end": "final_answer"},
        )
        builder.add_edge("tool_execution", "reasoning")
        builder.add_edge("final_answer", END)

        return builder.compile(checkpointer=self.memory)

    async def _node_reasoning(self, state: MissionState):
        """Node for AI reasoning and decision making."""
        logger.info("Node: reasoning")

        # Call the provider (Ollama, Gemini, etc.)
        # For simplicity, we convert MissionState messages to AIChatMessage
        from .base import AIChatMessage

        adk_messages = [
            AIChatMessage(role=m["role"], content=m["content"]) for m in state["messages"]
        ]

        # We use the provider's chat method
        # Pass the model from state if available
        model = state.get("model")
        reasoning = state.get("reasoning", True)
        response = await self.provider.chat(
            adk_messages, session_id=state["session_id"], model=model, reasoning=reasoning
        )

        # Update state
        state["messages"].append({"role": "assistant", "content": response.content})

        # Check if tool call is requested (heuristic or native)
        if "TOOL_CALL:" in response.content:
            state["next_node"] = "tool_execution"
        else:
            state["next_node"] = "final_answer"

        return state

    async def _node_tool_execution(self, state: MissionState):
        """Node for executing tools based on AI decision."""
        logger.info("Node: tool_execution")
        # Parse tool and call from ToolRegistry (Mock logic for now)
        # In a full PydanticAI impl, this would be automatic
        return state

    def _node_final_answer(self, state: MissionState):
        """Node for summarizing the findings."""
        logger.info("Node: final_answer")
        return state

    def _should_continue(self, state: MissionState) -> Literal["continue", "end"]:
        """Edge logic to decide if more tool calls are needed."""
        if state.get("next_node") == "tool_execution":
            return "continue"
        return "end"

    async def run(self, config: dict, initial_state: MissionState):
        """Execute the graph."""
        return await self.workflow.ainvoke(initial_state, config)
