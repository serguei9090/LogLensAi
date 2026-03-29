# AI-BE-001: Modular AI Provider Strategy

## 🎯 Objective
Refactor the `AIProvider` in `sidecar/src/ai.py` into a robust, multi-strategy engine supporting `Gemini CLI`, `AI Studio (SDK)`, and `Ollama`.

## 🏗️ Architectural Design
We will use a **Strategy Pattern**. The `AIProvider` will act as a factory that returns a concrete implementation based on the user's settings.

### Provider Classes
1. **`GeminiCLIProvider`**: Uses `subprocess` to call `gemini -p ... --json`. 
   - *Pros*: No API key, built-in.
   - *Cons*: Slow, stateless.
2. **`AIStudioProvider`**: Uses `google-generativeai` SDK.
   - *Pros*: Streaming support, persistent sessions (ChatSession), high parameters control.
3. **`OllamaProvider`**: Uses `aiohttp` to call a local Ollama instance (`/api/chat`).
   - *Pros*: Local, private, free.

## 📝 Proposed API (JSON-RPC)
- `list_models(provider: str) -> list[str]`
- `chat(session_id: str, message: str, context_logs: list[int]) -> dict`

## 🛠️ Data Structures (Pydantic)
```python
class AIModelInfo(BaseModel):
    id: str
    name: str
    provider: str

class AIChatMessage(BaseModel):
    role: str # 'user' | 'assistant' | 'system'
    content: str
    timestamp: str
```

## 🔄 Integration Details
- **Sync vs Async**: All providers should implement an `async` chat method to prevent blocking the sidecar.
- **Model Fetching**: 
  - AI Studio: `genai.list_models()`
  - Ollama: `GET /api/tags`
  - Gemini CLI: Hardcoded `gemini-pro`.
