import logging
from collections.abc import AsyncGenerator
from typing import Any

from .graph import GraphManager, MissionState
from .thinking_parser import detect_thinking_mode, parse_completed_response
from .tools import ToolRegistry

logger = logging.getLogger(__name__)


class HybridRunner:
    """Orchestrates the LangGraph execution within an ADK context."""

    def __init__(self, app_instance: Any, provider: Any, db_path: str = "data/ai_state.sqlite"):
        self.app = app_instance
        self.tool_registry = ToolRegistry(app_instance)
        self.graph_manager = GraphManager(
            provider=provider, tool_registry=self.tool_registry, db_path=db_path
        )

    async def run_investigation(
        self,
        workspace_id: str,
        session_id: str,
        user_message: str,
        history: list[dict] = None,
        model: str | None = None,
        reasoning: bool | None = True,
    ) -> AsyncGenerator[str, None]:
        """Runs the LangGraph investigation and yields A2UI-compatible events."""

        # Ensure graph is initialized
        await self.graph_manager.initialize()

        # Initial State
        state: MissionState = {
            "workspace_id": workspace_id,
            "session_id": session_id,
            "messages": history or [],
            "model": model,
            "reasoning": reasoning,
            "next_node": "reasoning",
            "status": "started",
            "metadata": {},
        }

        # Append the new user message
        state["messages"].append({"role": "user", "content": user_message})

        config = {"configurable": {"thread_id": session_id}}

        # Detect the thinking mode once so we can normalise <think> tags correctly.
        # `parse_completed_response` preserves <think>…</think> for the frontend,
        # whereas `clean_thinking_markers` would strip them (Bug fix: thinking block invisible).
        model_name = model or ""
        thinking_mode = detect_thinking_mode(model_name)

        # Execute the graph and stream steps.
        # We only emit from the `reasoning` node — `final_answer` returns the
        # unchanged state and would cause a duplicate emission (Bug fix: double response).
        async for output in self.graph_manager.workflow.astream(
            state, config, stream_mode="updates"
        ):
            for node_name, node_state in output.items():
                logger.info("Graph Step: %s", node_name)

                # Only the reasoning node produces new assistant content.
                if node_name != "reasoning":
                    continue

                if "messages" in node_state and node_state["messages"]:
                    last_msg = node_state["messages"][-1]
                    if last_msg["role"] == "assistant":
                        # Normalise channel markers → <think>…</think> form.
                        # This ensures the frontend ThinkingBlock can parse them.
                        normalised = parse_completed_response(last_msg["content"], thinking_mode)
                        yield normalised

        logger.info("Investigation mission complete for session %s", session_id)
