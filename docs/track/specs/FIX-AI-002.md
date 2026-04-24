# Task Detail: FIX-AI-002 (Standardized AI History)

## Problem
AI session persistence is currently provider-specific and fragile. The Gemini CLI A2A server uses private temp folders, while AI Studio might rely on transient taskId state. 

## Solution
Implement a **Universal Auto-Healing** mechanism in the Python Sidecar:
1.  **DB as Source of Truth**: Use the persistent DuckDB `ai_messages` table to re-construct history.
2.  **Context Injection**: If a task is new or expired, prepend a formatted history block to the user prompt.
3.  **Encapsulation**: Hide this logic inside the `AIProvider.chat()` implementations so the `api.py` doesn't have to manage formatting.

## Implementation Tasks
- [ ] Update `AIChatMessage` model to include `provider_session_id`.
- [ ] Refactor `GeminiCLIProvider._chat_hot` to use the aggregated history if `task_id` is newly created.
- [ ] Update `AIStudioProvider` to support the same "Context Restoration" pattern.
- [ ] Audit `api.py` to ensure atomic persistence of every turn.

## Verification
- Start a chat -> Close Sidecar -> Restart Sidecar -> Continue Chat -> Verify AI remembers previous turns.
- Check A2A server logs to ensure only one task is used or a new one is successfully "healed".
