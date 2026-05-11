import re

with open('sidecar/src/ai/base.py', encoding='utf-8') as f:
    content = f.read()

new_class = '''class AIChatMessage(BaseModel):
    role: str  # 'user' | 'assistant' | 'system' | 'tool'
    content: str
    context_logs: list[int] | None = None
    timestamp: str | None = None
    provider_session_id: str | None = None  # E.g. A2A taskId
    tool_calls: list[dict] | None = None
    tool_call_id: str | None = None
    name: str | None = None'''

content = re.sub(r'class AIChatMessage\(BaseModel\):[\s\S]*?provider_session_id: str \| None = None  # E.g. A2A taskId', new_class, content)

# Also update AIProvider signature
content = content.replace(
    '        provider_session_id: str | None = None,\n        **kwargs,',
    '        provider_session_id: str | None = None,\n        tools: list[dict] | None = None,\n        **kwargs,'
)

with open('sidecar/src/ai/base.py', 'w', encoding='utf-8') as f:
    f.write(content)
