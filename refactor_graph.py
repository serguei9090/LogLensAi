with open("sidecar/src/ai/graph.py", encoding="utf-8") as f:
    content = f.read()

new_graph = '''import logging
import json
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

        from .base import AIChatMessage

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
            tools=tool_schemas
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

    async def _node_tool_execution(self, state: MissionState):
        """Node for executing tools based on AI decision."""
        logger.info("Node: tool_execution")
        
        last_msg = state["messages"][-1]
        
        if "tool_calls" in last_msg and last_msg["tool_calls"]:
            from pydantic_ai import RunContext
            ctx = RunContext(deps={}, retry=0, tool_name="", prompt=None)
            
            for call in last_msg["tool_calls"]:
                try:
                    name = call["function"]["name"]
                    args = json.loads(call["function"]["arguments"])
                    call_id = call["id"]
                    
                    logger.info("Executing tool: %s with args: %s", name, args)
                    
                    result = {"error": f"Tool {name} not found"}
                    if name == "search_logs":
                        from .tools import SearchLogsParams
                        params = SearchLogsParams(**args)
                        result = await self.tools.search_logs(ctx, params)
                    elif name == "get_clusters":
                        from .tools import GetClustersParams
                        params = GetClustersParams(**args)
                        result = await self.tools.get_clusters(ctx, params)
                    elif name == "search_memory":
                        from .tools import SearchMemoryParams
                        params = SearchMemoryParams(**args)
                        result = await self.tools.search_memory(ctx, params)
                    elif name == "get_facets":
                        from .tools import GetFacetsParams
                        params = GetFacetsParams(**args)
                        result = await self.tools.get_facets(ctx, params)
                    elif name == "get_hierarchy":
                        from .tools import GetHierarchyParams
                        params = GetHierarchyParams(**args)
                        result = await self.tools.get_hierarchy(ctx, params)
                        
                    state["messages"].append({
                        "role": "tool",
                        "content": json.dumps(result),
                        "tool_call_id": call_id,
                        "name": name
                    })
                except Exception as e:
                    logger.error("Failed to execute tool call %s: %s", call, e)
                    state["messages"].append({
                        "role": "tool",
                        "content": json.dumps({"error": str(e)}),
                        "tool_call_id": call.get("id", "unknown"),
                        "name": call.get("function", {}).get("name", "unknown")
                    })
        else:
            # Fallback handling for heuristic tool calls
            state["messages"].append({"role": "system", "content": "No tool_calls array provided by model, but tool execution triggered."})

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
'''

with open("sidecar/src/ai/graph.py", "w", encoding="utf-8") as f:
    f.write(new_graph)

print("Updated graph.py")
