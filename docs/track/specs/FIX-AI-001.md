# FIX-AI-001: Sidecar Persistence & Multi-turn Context Fix

## 📝 Issue Description
Investigation sessions and chat messages are not persisting in the sidecar database (DuckDB) across RPC calls. Additionally, the AI provider (`ai_studio.py`) only sends the latest message, losing conversation history.

## 🔍 Root Cause Analysis
1. **Uncommitted Transactions**: `api.py` uses `cursor.execute()` but never calls `self.db.conn.commit()`. DuckDB's internal MVCC isolation prevents other requests (like `get_ai_sessions`) from seeing uncommitted rows from a pending AI chat request.
2. **Context Loss**: `ai_studio.py` line 62 extracts `messages[-1]`, discarding previous history.
3. **DOM Nesting**: `AIInvestigationSidebar.tsx` has a `<button>` inside a `DropdownMenuTrigger`.

## 🛠️ Implementation Plan

### 1. Backend (@backend)
- **`sidecar/src/api.py`**:
  - Implement `self.db.conn.commit()` after `INSERT` or `UPDATE` in:
    - `method_send_ai_message`
    - `method_delete_ai_session`
    - `method_update_log_comment`
    - `method_ingest_logs`
- **`sidecar/src/ai/ai_studio.py`**:
  - Refactor `chat` to pull **all** history messages.
  - Map `AIChatMessage` roles correctly to ADK `Runner` content parts.

### 2. Frontend (@frontend)
- **`src/components/organisms/AIInvestigationSidebar.tsx`**:
  - Update `DropdownMenuTrigger` to use `asChild`. 
  - Ensure `fetchSessions` is triggered on mount or valid workspace change.
- **`src/store/aiStore.ts`**:
  - Optional: Trigger `fetchSessions` explicitly if `sendMessage` succeeds and returns a new ID. (Already exists but verify parity).

## ✅ Verification
- Send a message -> Dropdown history should update immediately.
- Refresh page -> Session should restore.
- Follow up message -> AI should acknowledge the first message.
