
with open('sidecar/tests/test_hybrid_orchestration.py', encoding='utf-8') as f:
    content = f.read()

# Easiest is just to import all the param classes at the top of test_tool_registry_errors and test_tool_registry_errors_extended
content = content.replace(
    'def test_tool_registry_errors_extended():',
    'def test_tool_registry_errors_extended():\n    from ai.tools import SearchMemoryParams, GetFacetsParams, GetHierarchyParams'
)
content = content.replace(
    'def test_tool_registry_errors():',
    'def test_tool_registry_errors():\n    from ai.tools import GetClustersParams'
)

with open('sidecar/tests/test_hybrid_orchestration.py', 'w', encoding='utf-8') as f:
    f.write(content)
