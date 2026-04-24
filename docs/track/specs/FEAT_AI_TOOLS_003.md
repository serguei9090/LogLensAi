# FEAT-AI-TOOLS-003: AI Chat SSE Streaming Protocol

## Objective
Implement real-time token streaming for AI chat using Server-Sent Events (SSE) from the Python sidecar to the React frontend. 

## Rationale
Current JSON-RPC design requires the UI to wait uncomfortably long (10-20s) for complete AI completion before rendering any text. Shifting to HTTP SSE enables immediate visual feedback (TFT < 1s), supports live "Thinking" tags rendering, and meets modern AI UX standards.

## Architecture & Modifications
1. **Sidecar Router (`sidecar/src/api.py`)**
   - Add a direct `POST /api/stream_chat` endpoint on the aiohttp dev server.
   - For Tauri production (`stdin`), add JSON-RPC notification support: `{"jsonrpc": "2.0", "method": "chat_chunk", "params": {"chunk": "..."}}`.
2. **AI Provider Interfaces (`sidecar/src/ai/*.py`)**
   - Extend `AIProvider` to include `async def chat_stream(...)`.
   - Update `GeminiCLIProvider` to yield from `_parse_sse_stream` dynamically instead of building a `full_response` array.
3. **Frontend Hook (`src/store/aiStore.ts`)**
   - Override `callSidecar` for the stream. Use native `fetch` over HTTP (in web mode) or Tauri API.
   - Actively push state mutating updates into `messages` via Zustand for characters received over the wire.

## Guardrails
- Ensure the final generated message string is perfectly saved into DuckDB, regardless of stream interruption.
- Re-use the existing Session/Provider connection caching strategy.
