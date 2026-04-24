from unittest.mock import AsyncMock, MagicMock

import pytest
from ai.graph import GraphManager
from ai.reasoning import extract_thinking_content, parse_reasoning_blocks
from ai.runner import HybridRunner
from ai.tools import SearchLogsParams, ToolRegistry


@pytest.mark.parametrize(
    "input_text, expected",
    [
        ("<|channel>thought Hello <|channel>text Hi", "<think>Hello</think>Hi"),
        ("<thought>Thinking</thought> Result", "<think>Thinking</think> Result"),
        ("[reasoning]Step 1[/reasoning] Answer", "<think>Step 1</think> Answer"),
    ],
)
def test_reasoning_normalization(input_text, expected):
    assert parse_reasoning_blocks(input_text) == expected


def test_extract_thinking_content():
    text = "<think>I am thinking</think> This is the answer"
    thinking, response = extract_thinking_content(text)
    assert thinking == "I am thinking"
    assert response == "This is the answer"


def test_extract_no_thinking():
    text = "Just an answer"
    thinking, response = extract_thinking_content(text)
    assert thinking is None
    assert response == "Just an answer"


@pytest.mark.asyncio
async def test_tool_registry_search_logs():
    app = MagicMock()
    app._get_logs_internal.return_value = {"total": 10, "logs": []}
    registry = ToolRegistry(app)

    # Mock RunContext
    ctx = MagicMock()

    params = SearchLogsParams(workspace_id="ws1", query="error", filters=[], limit=10, offset=0)

    result = await registry.search_logs(ctx, params)
    assert result["total"] == 10
    app._get_logs_internal.assert_called_once()


@pytest.mark.asyncio
async def test_tool_registry_get_clusters():
    app = MagicMock()
    # Mock get_drain_parser
    parser = MagicMock()
    cluster = MagicMock()
    cluster.cluster_id = 1
    cluster.get_template.return_value = "tpl"
    cluster.size = 10
    parser.get_clusters.return_value = [cluster]
    app.get_drain_parser.return_value = parser

    registry = ToolRegistry(app)
    ctx = MagicMock()

    result = await registry.get_clusters(ctx, "ws1")
    assert len(result) == 1
    assert result[0]["id"] == 1


@pytest.mark.asyncio
async def test_hybrid_runner_streaming():
    app = MagicMock()
    provider = MagicMock()
    provider.chat = AsyncMock()
    provider.chat.return_value = MagicMock(content="I will help.")

    runner = HybridRunner(app, provider, db_path=":memory:")
    runner.graph_manager = MagicMock()

    async def mock_astream(*args, **kwargs):
        yield {
            "reasoning": {
                "messages": [{"role": "assistant", "content": "<thought>Analyzing</thought> OK"}]
            }
        }

    runner.graph_manager.workflow.astream = mock_astream
    runner.graph_manager.initialize = AsyncMock()

    chunks = []
    async for chunk in runner.run_investigation("ws1", "sess1", "Hello"):
        chunks.append(chunk)

    assert len(chunks) > 0
    assert "<think>Analyzing</think> OK" in chunks[0]


@pytest.mark.asyncio
async def test_graph_manager_nodes():
    provider = MagicMock()
    provider.chat = AsyncMock()
    # Mocking a thinking response followed by a tool call
    provider.chat.return_value = MagicMock(
        content="<thought>I should search</thought> TOOL_CALL: search_logs"
    )

    registry = MagicMock()
    manager = GraphManager(provider, registry, db_path=":memory:")
    await manager.initialize()

    state = {
        "workspace_id": "ws1",
        "session_id": "sess1",
        "user_message": "Find errors",
        "messages": [],
        "history": [],
    }

    # Test reasoning node
    new_state = await manager._node_reasoning(state)
    assert len(new_state["messages"]) == 1
    assert "thought" in new_state["messages"][0]["content"]
    assert new_state["next_node"] == "tool_execution"

    # Test router
    assert manager._should_continue(new_state) == "continue"

    # Test final answer node
    state["next_node"] = "final_answer"
    final_state = manager._node_final_answer(state)
    assert final_state == state
    assert manager._should_continue(final_state) == "end"

    # Test tool execution node
    tool_state = await manager._node_tool_execution(state)
    assert tool_state == state

    # Test lifecycle
    await manager.close()
    assert manager.memory is None


@pytest.mark.asyncio
async def test_tool_registry_additional_tools():
    app = MagicMock()
    app.method_search_memory.return_value = [{"id": "mem1"}]
    app.method_get_metadata_facets.return_value = {"ips": ["1.1.1.1"]}

    registry = ToolRegistry(app)
    ctx = MagicMock()

    # Test search_memory
    mem_res = await registry.search_memory(ctx, "ws1", "query")
    assert mem_res[0]["id"] == "mem1"

    # Test get_facets
    facet_res = await registry.get_facets(ctx, "ws1")
    assert "ips" in facet_res

    # Test get_hierarchy
    app.method_get_hierarchy.return_value = {"root": {}}
    hier_res = await registry.get_hierarchy(ctx, "ws1")
    assert "root" in hier_res


@pytest.mark.asyncio
async def test_tool_registry_errors_extended():
    app = MagicMock()
    app.method_search_memory.side_effect = Exception("Mem error")
    app.method_get_metadata_facets.side_effect = Exception("Facet error")
    app.method_get_hierarchy.side_effect = Exception("Hier error")

    registry = ToolRegistry(app)
    ctx = MagicMock()

    # Test search_memory error
    res1 = await registry.search_memory(ctx, "ws1", "q")
    assert "error" in res1[0]

    # Test get_facets error
    res2 = await registry.get_facets(ctx, "ws1")
    assert "error" in res2

    # Test get_hierarchy error
    res3 = await registry.get_hierarchy(ctx, "ws1")
    assert "error" in res3


@pytest.mark.asyncio
async def test_tool_registry_errors():
    app = MagicMock()
    app._get_logs_internal.side_effect = Exception("Search error")
    app.get_drain_parser.side_effect = Exception("Cluster error")

    registry = ToolRegistry(app)
    ctx = MagicMock()

    # Test search_logs error
    params = SearchLogsParams(workspace_id="ws1")
    res1 = await registry.search_logs(ctx, params)
    assert "error" in res1

    # Test get_clusters error
    res2 = await registry.get_clusters(ctx, "ws1")
    assert "error" in res2[0]
