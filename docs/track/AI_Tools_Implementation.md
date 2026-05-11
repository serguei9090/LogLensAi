# Specification: AI Native Tool Calling Implementation

## 🎯 Objective
Enable the AI models (Ollama, OpenAI, Gemini) to autonomously execute backend operations by fully implementing the OpenAI-standard JSON-RPC tool calling specification. The AI should be able to search logs, fetch facets, analyze clusters, and retrieve workspace hierarchies directly.

## 🏗️ Current State vs Required State
**Current:** Tools are defined in `sidecar/src/ai/tools.py` using Pydantic, but they are not passed to the LLM payloads in `ollama.py` or `openai_compatible.py`. The execution node in `graph.py` is mocked.

**Required:** The sidecar must auto-generate JSON schemas from the Pydantic models, inject them into the `tools` array of the provider payloads, handle `tool_calls` responses from the LLMs, execute the mapped Python function, and return a `{"role": "tool"}` message back to the LLM to continue the reasoning loop.

---

## 📋 Implementation Plan

### Phase 1: Schema Generation & Provider Payload Updates
*   **Target:** `sidecar/src/ai/tools.py`, `sidecar/src/ai/ollama.py`, `sidecar/src/ai/openai_compatible.py`
*   **Action:**
    1. Update `ToolRegistry` to expose a `get_tool_schemas()` method. This method will iterate over the registered tools and use Pydantic's `model_json_schema()` to generate the standard `{"type": "function", "function": {"name": "...", "description": "...", "parameters": {...}}}` array.
    2. Modify the `chat` and `chat_stream` signatures in `AIProvider` to accept an optional `tools: list[dict] = None` argument.
    3. Update `OllamaProvider` and `OpenAICompatibleProvider` to append the `tools` array to their HTTP JSON payloads if provided.

### Phase 2: Handling `tool_calls` from Providers
*   **Target:** `sidecar/src/ai/ollama.py`, `sidecar/src/ai/openai_compatible.py`, `sidecar/src/ai/base.py`
*   **Action:**
    1. Update the `AIChatMessage` schema to support tool definitions. It must handle `tool_calls` (when the assistant wants to run a tool) and `tool_call_id` / `name` (for the tool response message).
    2. Modify the response parsers in the providers to correctly extract `tool_calls` from the LLM's raw JSON response and attach them to the returned `AIChatMessage`.

### Phase 3: LangGraph Execution Node
*   **Target:** `sidecar/src/ai/graph.py`
*   **Action:**
    1. In `_node_reasoning`, pass the generated tool schemas to the provider.
    2. Modify `_should_continue` to transition to `tool_execution` if the `AIChatMessage` contains `tool_calls` instead of using the primitive string heuristic (`"TOOL_CALL:"`).
    3. Implement `_node_tool_execution`:
        * Loop through all requested `tool_calls`.
        * Map the requested function name to the corresponding method in `ToolRegistry`.
        * Parse the LLM's JSON arguments into the respective Pydantic model (e.g., `SearchLogsParams`).
        * Execute the tool method.
        * Append a new message to the state: `{"role": "tool", "content": json.dumps(result), "tool_call_id": call_id}`.
    4. Ensure the graph cycles back to `_node_reasoning` so the LLM can read the tool output and formulate its final answer.

## 🚀 Expected Impact
*   **True Agentic Behavior:** The AI will transform from a passive chatbot into an active investigator capable of writing its own LLQL queries, fetching anomalies, and pulling context without user intervention.
*   **Standardization:** Using Pydantic to enforce tool schemas ensures type-safety and automatic validation of the LLM's generated arguments before they touch our backend logic.
