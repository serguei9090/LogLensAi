# Model Specification: Gemma 4 (Effective 2B)

## Overview
Gemma 4 `e2b` is a small-footprint, high-efficiency model from Google (released early 2026) optimized for edge deployment. Its primary differentiator is native "Reasoning Channels" that allow the model to think before answering.

## Reasoning Format
Gemma 4 utilizes structured delimiters to separate its cognitive process from its output. While it natively uses channel-based tags, many Ollama distributions and frontends wrap these into standard reasoning tags for compatibility.

### Native Delimiters
- **Start**: `<|channel>thought`
- **End**: `<channel|>`

### Standard Compatibility (Mapped)
In LogLensAi, we map these to:
- **Search Pattern**: `<think>...</think>` (Standard Reasoning Tag)

## Configuration in LogLensAi
To ensure the "Professional Chat" look is consistent, we handle these increments in real-time.

### Why you see it "Streaming"
Because we enabled `chat_stream` in the Ollama provider, the `e2b` model emits its reasoning tokens as the first part of the stream. Our `parseThinking` logic detects the start tag, switches the UI to "Thinking Mode," and starts the stopwatch.

## Capabilities
- **Log Pattern Recognition**: High accuracy for the 2B size.
- **Root Cause Analysis**: Excellent at identifying "Chain of Events" in log streams.
- **Latency**: Sub-300ms time-to-first-token on most dev machines.

## Best Practices
- **Prompting**: If the model stops thinking, add `<|think|>` to the start of your query to re-force the reasoning channel.
