
with open('sidecar/src/ai/graph.py', encoding='utf-8') as f:
    content = f.read()

# Fix RUF019: 'tool_calls' in last_msg and last_msg['tool_calls'] -> last_msg.get('tool_calls')
content = content.replace(
    'if "tool_calls" in last_msg and last_msg["tool_calls"]:',
    'if last_msg.get("tool_calls"):'
)

# Fix TRY400
content = content.replace(
    'logger.error("Failed to execute tool call %s: %s", call, e)',
    'logger.exception("Failed to execute tool call %s: %s", call, e)'
)

with open('sidecar/src/ai/graph.py', 'w', encoding='utf-8') as f:
    f.write(content)
