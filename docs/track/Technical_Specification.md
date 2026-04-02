# Technical Specification: Standardized AI History & Universal Auto-Healing (FIX-AI-002)

## 1. Executive Summary
LogLensAi currently uses multiple AI providers (Gemini CLI A2A, AI Studio, etc.). Maintaining conversation history across session restarts is critical. While some providers (like A2A) have internal file-based persistence, relying on their internal temp folders is fragile. 

This specification standardizes the **"Auto-Healing"** logic:
- The Sidecar DuckDB is the absolute **Single Source of Truth** for all chat messages.
- If an AI provider's session (taskId, threadId) expires or the server restarts, the Sidecar will automatically "heal" the new session by prepending the full message history from the DB into the first user prompt (Context Injection).
- This approach ensures 100% reliability, zero dependence on provider-specific filesystem structures, and a consistent UX across all AI backends.

## 2. Requirements

### 2.1 Functional Requirements
- **Persistence**: All user and assistant messages MUST be saved to the `ai_messages` table in DuckDB immediately.
- **Session Continuity**: When a user selects an existing session, the Sidecar must check if the provider's remote task/thread is still alive.
- **Universal Auto-Healing**: If the remote task is gone, a new one is created, and the history is injected into the very first prompt using a standard `=== CONTEXT RESTORATION ===` block.
- **Provider Parity**: Both `GeminiCLIProvider` and `AIStudioProvider` (and future ones) MUST follow this pattern.
- **UI Hydration**: The frontend chat interface hydrates exclusively from the Sidecar DB, not from provider-specific local files.

### 2.2 Non-Functional Requirements
- **Performance**: History aggregation must be fast (local DB query).
- **Reliability**: No direct manipulation of `C:\Users\ASCC\.gemini\tmpa2a-server` folders.
- **Transparency**: The "Context Restoration" block should be clearly labeled in the prompt sent to the LLM but handled transparently by the engine.

## 3. Architecture & Tech Stack

### 3.1 Backend (Python Sidecar)
- **`sidecar/src/ai/base.py`**: Update base class to enforce history-aware chat signatures.
- **`sidecar/src/ai/gemini_cli.py`**: Standardize the `_chat_hot` logic to use the "Auto-Heal" block if a task is new.
- **`sidecar/src/api.py`**: Ensure `method_send_ai_message` handles the history retrieval and persistence cycle atomically.

### 3.2 Database Schema
- `ai_sessions`: Stores `session_id`, `name`, `workspace_id`, and `provider_session_id` (the remote taskId).
- `ai_messages`: Stores `message_id`, `session_id`, `role`, `content`, `timestamp`, and `provider_session_id`.

## 4. State Management & Data Flow
1. **User Action**: User sends "Hello" in the UI.
2. **Sidecar API**: `method_send_ai_message` is called.
3. **History Retrieval**: Sidecar pulls all previous `ai_messages` for that `session_id`.
4. **Provider Logic**: 
   - Check if `provider_session_id` (taskId) exists and is alive on the A2A/Studio server.
   - If **NO**: Create new task, prepend aggregated history to "Hello", set `is_new_task = True`.
   - If **YES**: Send "Hello" directly.
5. **Persistence**: Save "Hello" and the AI response back to `ai_messages`. Update `ai_sessions.provider_session_id` if it changed.

## 5. Standardized Context Restoration Block (Template)
```text
=== CONTEXT RESTORATION (AUTO-HEAL) ===
The following is the history of our previous conversation which was lost from the server state. Please use this as context for our current chat:

[YOU]: <message 1>
---
[AI]: <response 1>
---
[YOU]: <message 2>
...
=== END OF RESTORATION ===

User Message: <current message>
```

---
**Approval Gate**: Do you approve of this tech stack and specification? You can safely open `docs/track/Technical_Specification.md` and add comments or modifications if you want me to rework anything!
