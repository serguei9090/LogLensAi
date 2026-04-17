# AI Reasoning Parsing (Gemma 4 / Ollama)

This document describes how LogLensAi handles the complex reasoning-to-response transition for models like Gemma 4 when served via Ollama.

## The Challenge
Modern reasoning models (like Gemma 4) emit a "thought process" before their final answer. Ollama handles this in two ways depending on the model and version:
1. **Explicit Markers**: The reasoning is wrapped in tokens (e.g., `<|channel>thought` and `<|channel>text`) inside the standard `content` string.
2. **Native Fields**: The reasoning is sent in a dedicated `thinking` or `thought` JSON field, while the response is sent in the `content` field.

## The Solution: Field-Aware Multi-Marker Parser

The `OllamaProvider` implementation in `sidecar/src/ai/ollama.py` uses a hybrid stateful parser to ensure perfectly separated output.

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

### 4. Cleanup & Normalization
- **History Sanitization**: Before sending history back to the model, all `<think>...</think>` blocks and internal markers are stripped. This ensures the model's "inner monologue" doesn't pollute subsequent conversation turns.
- **Frontend Parser**: The frontend (`AIInvestigationSidebar.tsx`) uses `parseThinking()` to extract the content between `<think>` tags and render it in a collapsible block.

## Implementation Details
- **Backend Class**: `OllamaProvider`
- **Method**: `chat_stream()`
- **Markers Enum**: `_StreamPhase`

## Debugging & Observability
The parsing process can be tracked via environment variables in the `.env` file:
- `LOGLENS_DEBUG`: Set to `true` to enable global `DEBUG` level logging for the sidecar.
- `LOGLENS_AI_DEBUG`: Set to `true` to enable granular token-by-token phase tracking in `sidecar.log`. Useful for identifying edge cases where markers are split across chunks.
