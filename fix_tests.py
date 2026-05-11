import re

with open('sidecar/src/ai/graph.py', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'ctx = RunContext(deps={}, retry=0, tool_name="", prompt=None)',
    'ctx = None'
)

with open('sidecar/src/ai/graph.py', 'w', encoding='utf-8') as f:
    f.write(content)

with open('sidecar/tests/test_hybrid_orchestration.py', encoding='utf-8') as f:
    content = f.read()

# get_clusters
content = re.sub(
    r'result = await registry\.get_clusters\(ctx, "ws1"\)',
    r'from ai.tools import GetClustersParams\n    params = GetClustersParams(workspace_id="ws1")\n    result = await registry.get_clusters(ctx, params)',
    content
)

# test_graph_manager_nodes
# state["messages"] has a message with tool_calls in test_graph_manager_nodes
# we should make it compatible
old_reasoning_node = '''    # Test reasoning node
    new_state = await manager._node_reasoning(state)
    assert len(new_state["messages"]) == 1
    assert "thought" in new_state["messages"][0]["content"]
    assert new_state["next_node"] == "tool_execution"'''

new_reasoning_node = '''    # Test reasoning node
    new_state = await manager._node_reasoning(state)
    assert len(new_state["messages"]) == 1
    assert "thought" in new_state["messages"][0]["content"]
    assert new_state["next_node"] == "tool_execution"
    
    # inject tool calls
    new_state["messages"][-1]["tool_calls"] = [{"id": "call1", "function": {"name": "search_logs", "arguments": "{}"}}]'''

content = content.replace(old_reasoning_node, new_reasoning_node)

old_tool_node = '''    # Test tool execution node
    tool_state = await manager._node_tool_execution(state)
    assert tool_state == state'''

new_tool_node = '''    # Test tool execution node
    tool_state = await manager._node_tool_execution(state)
    assert len(tool_state["messages"]) == 2
    assert tool_state["messages"][-1]["role"] == "tool"'''

content = content.replace(old_tool_node, new_tool_node)

# test_tool_registry_additional_tools
content = re.sub(
    r'mem_res = await registry\.search_memory\(ctx, "ws1", "query"\)',
    r'from ai.tools import SearchMemoryParams\n    params = SearchMemoryParams(workspace_id="ws1", query="query")\n    mem_res = await registry.search_memory(ctx, params)',
    content
)
content = re.sub(
    r'facet_res = await registry\.get_facets\(ctx, "ws1"\)',
    r'from ai.tools import GetFacetsParams\n    params = GetFacetsParams(workspace_id="ws1")\n    facet_res = await registry.get_facets(ctx, params)',
    content
)
content = re.sub(
    r'hier_res = await registry\.get_hierarchy\(ctx, "ws1"\)',
    r'from ai.tools import GetHierarchyParams\n    params = GetHierarchyParams(workspace_id="ws1")\n    hier_res = await registry.get_hierarchy(ctx, params)',
    content
)

# test_tool_registry_errors_extended
content = re.sub(
    r'res1 = await registry\.search_memory\(ctx, "ws1", "q"\)',
    r'params = SearchMemoryParams(workspace_id="ws1", query="q")\n    res1 = await registry.search_memory(ctx, params)',
    content
)
content = re.sub(
    r'res2 = await registry\.get_facets\(ctx, "ws1"\)',
    r'params = GetFacetsParams(workspace_id="ws1")\n    res2 = await registry.get_facets(ctx, params)',
    content
)
content = re.sub(
    r'res3 = await registry\.get_hierarchy\(ctx, "ws1"\)',
    r'params = GetHierarchyParams(workspace_id="ws1")\n    res3 = await registry.get_hierarchy(ctx, params)',
    content
)

# test_tool_registry_errors
content = re.sub(
    r'res2 = await registry\.get_clusters\(ctx, "ws1"\)',
    r'params = GetClustersParams(workspace_id="ws1")\n    res2 = await registry.get_clusters(ctx, params)',
    content
)

with open('sidecar/tests/test_hybrid_orchestration.py', 'w', encoding='utf-8') as f:
    f.write(content)

