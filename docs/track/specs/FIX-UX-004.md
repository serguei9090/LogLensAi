# FIX-UX-004: Context-Aware AI Hub & Session Intelligence

## 🎯 Objective
Transform the AI Investigation Hub into a stateful diagnostic tool that tracks which logs are currently being analyzed and provides VS Code-style session management.

## 🛠️ Implementation Plan

### 1. Backend Intelligence (`api.py`)
- **New Method**: `method_get_ai_mapping(workspace_id)` -> Returns `{ log_id: session_id }` across all workspace messages.
- **New Method**: `method_rename_ai_session(session_id, name)` -> Persistence for custom titles.
- **New Method**: `method_delete_ai_session(session_id)`.
- **Logic Bump**: Ensure `last_modified` is updated on every message insert.

### 2. Store Integration (`aiStore.ts`)
- **State**: Add `logSessionMap` to cache the mappings.
- **Actions**:
    - `fetchMapping(workspaceId)`: Fetches the `{ log_id: session_id }` data.
    - `renameSession(sessionId, name)`: Updates the title in store and DB.
    - `resetSession()`: Clears `currentSessionId` to "Clean Session" state.

### 3. Frontend Refinement

#### AI Sidebar (`AIInvestigationSidebar.tsx`)
- **Empty State**: Show "Recent Investigations" (grid of 4) + "Start Clean" button.
- **Header**: Pencil icon button for title renaming (inline input).
- **Plus Button**: Top-right `+` button in sidebar header for instant `resetSession()`.

#### Log Table (`VirtualLogTable.tsx`)
- **Icon Highlight**: The `Sparkles` icon will be `text-violet-400 bg-violet-500/10` if `log.id` exists in `logSessionMap`.
- **Navigation Click**: 
    - If in map: `setSession(map[log.id])`.
    - If not: `resetSession()` + `setSelectedLogIds([log.id])`.
- **State Sync**: Auto-fetch mapping on workspace load and after first message.

## ⚖️ Architectural Impact
- **Database**: Updating schema for `ai_sessions` names and timestamps.
- **State**: Expanding `aiStore` as a full orchestration layer between logs and chats.
