# ADK 2.0 Python Patterns Reference

This reference provides standardized code snippets for common Google Agent Development Kit (ADK) 2.0 tasks in the LogLensAi sidecar.

## 1. Minimal Agent Definition
```python
from google.adk.agents.llm_agent import LlmAgent
from google.adk.planners import BuiltInPlanner
from google.genai import types

agent = LlmAgent(
    name="log_analyzer",
    model="gemini-2.0-flash",
    instruction="Expert log diagnostic specialist. Use tools to query DuckDB and suggest fixes.",
    planner=BuiltInPlanner(
        thinking_config=types.ThinkingConfig(include_thoughts=True)
    )
)
```

## 2. Tools & Documentation
ADK 2.0 uses Python docstrings to infer tool parameters.
```python
def query_duckdb(sql_query: str) -> dict:
    """
    Executes a SQL query against the log database.

    Args:
        sql_query: The SQL query string to run.
    
    Returns:
        dict: The result records or error message.
    """
    # implementation here
    pass

agent = LlmAgent(..., tools=[query_duckdb])
```

## 3. Session & Runner Execution
```python
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

session_service = InMemorySessionService()
runner = Runner(agent=agent, app_name="LogLensAi", session_service=session_service)

async def ask_agent(query: str, user_id: str, session_id: str):
    content = types.Content(role="user", parts=[types.Part(text=query)])
    async for event in runner.run_async(user_id=user_id, session_id=session_id, new_message=content):
        if event.is_final_response():
            return event.content.parts[0].text
```

## 4. Code Execution Support
```python
from google.adk.code_executors import BuiltInCodeExecutor

agent = LlmAgent(
    ...,
    code_executor=BuiltInCodeExecutor()
)
```

## 5. Structured Data Output
```python
from pydantic import BaseModel, Field

class DiagnosticResult(BaseModel):
    summary: str = Field(description="Brief summary of the log error")
    root_cause: str = Field(description="Identified root cause")
    severity: str = Field(description="Error severity: info, warning, error, critical")

agent = LlmAgent(
    ...,
    output_schema=DiagnosticResult
)
```
