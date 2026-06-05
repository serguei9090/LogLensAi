import json
import logging
from typing import Any, Literal, TypedDict

from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.graph import END, StateGraph

from .base import AIChatMessage
from .tools import (
    CreateColumnParams,
    CreateFacetParams,
    GetClustersParams,
    GetFacetsParams,
    GetHierarchyParams,
    SearchLogsParams,
    SearchMemoryParams,
)

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

        adk_messages = []
        for m in state["messages"]:
            msg = AIChatMessage(role=m["role"], content=m.get("content", ""))
            if "tool_calls" in m:
                msg.tool_calls = m["tool_calls"]
            if "tool_call_id" in m:
                msg.tool_call_id = m["tool_call_id"]
            if "name" in m:
                msg.name = m["name"]
            adk_messages.append(msg)

        model = state.get("model")
        reasoning = state.get("reasoning", True)

        # Get schemas
        tool_schemas = self.tools.get_tool_schemas()

        response = await self.provider.chat(
            adk_messages,
            session_id=state["session_id"],
            model=model,
            reasoning=reasoning,
            tools=tool_schemas,
        )

        msg_dict = {"role": "assistant", "content": response.content}
        if response.tool_calls:
            msg_dict["tool_calls"] = response.tool_calls

        state["messages"].append(msg_dict)

        if response.tool_calls:
            state["next_node"] = "tool_execution"
        elif "TOOL_CALL:" in response.content:
            # Fallback heuristic
            state["next_node"] = "tool_execution"
        else:
            state["next_node"] = "final_answer"

        return state

    async def _execute_single_tool(self, name: str, args: dict) -> dict:
        """Executes a single tool and returns its output dictionary."""
        ctx = None
        tool_mapping = {
            "search_logs": (SearchLogsParams, self.tools.search_logs),
            "get_clusters": (GetClustersParams, self.tools.get_clusters),
            "search_memory": (SearchMemoryParams, self.tools.search_memory),
            "get_facets": (GetFacetsParams, self.tools.get_facets),
            "get_hierarchy": (GetHierarchyParams, self.tools.get_hierarchy),
            "create_column": (CreateColumnParams, self.tools.create_column),
            "create_facet": (CreateFacetParams, self.tools.create_facet),
        }

        if name in tool_mapping:
            param_cls, func = tool_mapping[name]
            params = param_cls(**args)
            return await func(ctx, params)
        return {"error": f"Tool {name} not found"}

    async def _node_tool_execution(self, state: MissionState):
        """Node for executing tools based on AI decision."""
        logger.info("Node: tool_execution")

        last_msg = state["messages"][-1]

        if last_msg.get("tool_calls"):
            for call in last_msg["tool_calls"]:
                try:
                    name = call["function"]["name"]
                    args = json.loads(call["function"]["arguments"])
                    call_id = call["id"]

                    logger.info("Executing tool: %s with args: %s", name, args)
                    result = await self._execute_single_tool(name, args)

                    state["messages"].append(
                        {
                            "role": "tool",
                            "content": json.dumps(result),
                            "tool_call_id": call_id,
                            "name": name,
                        }
                    )
                except Exception as e:
                    logger.exception("Failed to execute tool call %s:", call)
                    state["messages"].append(
                        {
                            "role": "tool",
                            "content": json.dumps({"error": str(e)}),
                            "tool_call_id": call.get("id", "unknown"),
                            "name": call.get("function", {}).get("name", "unknown"),
                        }
                    )
        else:
            # Fallback handling for heuristic tool calls
            state["messages"].append(
                {
                    "role": "system",
                    "content": "No tool_calls array provided by model, but tool execution triggered.",  # noqa: E501
                }
            )

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
