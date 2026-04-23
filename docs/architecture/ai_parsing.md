# AI Reasoning Parsing (Universal Hybrid Orchestration)

This document describes how LogLensAi handles the complex reasoning-to-response transition for models like Gemma 4 when served via Ollama.

## The Challenge
Modern reasoning models (like Gemma 4) emit a "thought process" before their final answer. Ollama handles this in two ways depending on the model and version:
1. **Explicit Markers**: The reasoning is wrapped in tokens (e.g., `<|channel>thought` and `<|channel>text`) inside the standard `content` string.
2. **Native Fields**: The reasoning is sent in a dedicated `thinking` or `thought` JSON field, while the response is sent in the `content` field.

## The Solution: Universal Middleware Parser

LogLensAi uses a universal `reasoning.py` middleware that normalizes reasoning markers across all providers (Ollama, Gemini, AI Studio) into a standard format.

### 1. Phase Detection
The parser maintains a `_StreamPhase` (TEXT or THOUGHT).

### 2. Field-Based Transition (Priority)
If a chunk arrives with a `thinking` key, the parser:
- Automatically enters `THOUGHT` phase.
- Wraps the content in `<think>...</think>` tags for frontend consumption.

If a chunk arrives with a non-empty `content` key but **no** `thinking` key, and the parser was in `THOUGHT` phase:
- It automatically transitions to `TEXT` phase.
- It closes the thought block (`</think>`).
- This handles cases where Ollama performs "intelligent" pre-parsing but omits the explicit transition markers.

### 3. Marker-Based Transition (Fallback)
If the model sends everything in the `content` field (legacy or raw mode), the parser buffers tokens and scans for a variety of known control tokens:
- **Thought Markers**: `<|channel>thought`, `<|thought|>`
- **Text Markers**: `<|channel>text`, `<|text|>`, `<|channel|>text`, `<channel|>`

### 4. Normalization & Routing
All detected markers are normalized to `<think>...</think>` blocks. The `HybridRunner` applies this normalization automatically to all assistant responses before they are yielded to the ADK stream.

## Implementation Details
- **Normalization Utility**: `sidecar/src/ai/reasoning.py`
- **Orchestrator**: `sidecar/src/ai/runner.py` (HybridRunner)
- **State Machine**: `sidecar/src/ai/graph.py` (LangGraph)
- **Method**: `parse_reasoning_blocks()`

## Debugging & Observability
The parsing process can be tracked via environment variables in the `.env` file:
- `LOGLENS_DEBUG`: Set to `true` to enable global `DEBUG` level logging for the sidecar.
- `LOGLENS_AI_DEBUG`: Set to `true` to enable granular token-by-token phase tracking in `sidecar.log`. Useful for identifying edge cases where markers are split across chunks.
