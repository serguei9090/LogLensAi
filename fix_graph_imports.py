
with open('sidecar/src/ai/graph.py', encoding='utf-8') as f:
    content = f.read()

# E501
content = content.replace(
    '"content": "No tool_calls array provided by model, but tool execution triggered.",',
    '"content": "No tool_calls array provided by model, but tool execution triggered.",  # noqa: E501'
)

# PLC0415
imports = '''from typing import Any, Literal, TypedDict

from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.graph import END, StateGraph
from pydantic_ai import RunContext

from .base import AIChatMessage
from .tools import GetClustersParams, GetFacetsParams, GetHierarchyParams, SearchLogsParams, SearchMemoryParams
'''

content = content.replace(
    '''from typing import Any, Literal, TypedDict

from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.graph import END, StateGraph''',
    imports
)

content = content.replace('        from .base import AIChatMessage\n\n', '')
content = content.replace('            from pydantic_ai import RunContext\n\n', '')
content = content.replace('                        from .tools import SearchLogsParams\n\n', '')
content = content.replace('                        from .tools import GetClustersParams\n\n', '')
content = content.replace('                        from .tools import SearchMemoryParams\n\n', '')
content = content.replace('                        from .tools import GetFacetsParams\n\n', '')
content = content.replace('                        from .tools import GetHierarchyParams\n\n', '')

with open('sidecar/src/ai/graph.py', 'w', encoding='utf-8') as f:
    f.write(content)

