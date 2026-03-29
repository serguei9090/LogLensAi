# API Specification: Tauri ↔ Python Sidecar

## Communication Protocol
- **Transport**: Dev (HTTP on port 5000) / Prod (STDIN / STDOUT)
- **Protocol**: JSON-RPC 2.0
- **Serialization**: JSON

---

## 🏗️ Core Methods

### `get_logs`
Fetch paginated logs for a specific workspace.
- **params**: 
  - `workspace_id`: string (required)
  - `offset`: integer (default 0)
  - `limit`: integer (default 100)
  - `filters`: list of `{field, value, operator}`
  - `query`: string (full-text search)
  - `sort_by`: string ('timestamp', 'id', 'level', etc.)
  - `sort_order`: 'ASC' | 'DESC'
  - `start_time`: ISO string
  - `end_time`: ISO string
- **result**: `{"total": 500, "logs": [...], "offset": 0, "limit": 100}`

### `update_log_comment`
Add or clear a note on a log entry.
- **params**: 
  - `log_id`: integer
  - `comment`: string (empty to clear)
- **result**: `{"status": "success"}`

---

## 🤖 AI & Investigation Methods (Sprint 06)

### `get_ai_providers`
List available AI backends and their configuration status.
- **params**: None
- **result**: 
  ```json
  [
    {"id": "gemini-cli", "name": "Gemini (Local CLI)", "configured": true},
    {"id": "ai-studio", "name": "Google AI Studio", "configured": false},
    {"id": "ollama", "name": "Ollama (Local)", "configured": true}
  ]
  ```

### `list_ai_models`
Fetch models available for a specific provider.
- **params**: `{"provider": "ai-studio"}`
- **result**: `["gemini-1.5-flash", "gemini-1.5-pro"]`

### `create_ai_session`
Initialize a new AI investigation context.
- **params**: 
  - `workspace_id`: string
  - `title`: string | null (generated if null)
  - `log_ids`: list[integer] (context logs)
- **result**: `{"session_id": "uuid-...", "title": "Memory Outage analysis"}`

### `send_ai_message`
Send a User prompt to the AI within a session context.
- **params**: 
  - `session_id`: string
  - `content`: string
- **result**: 
  ```json
  {
    "id": "msg-...",
    "role": "assistant",
    "content": "Based on these 10 logs, the issue is...",
    "timestamp": "2024-03-29T..."
  }
  ```

### `get_ai_sessions`
Retrieve history for a workspace.
- **params**: `{"workspace_id": "ws-..."}`
- **result**: `[{"session_id": "uuid-...", "title": "Crash log analysis", "last_updated": "..."}]`

---

## ⚙️ Configuration Methods

### `get_settings` / `update_settings`
Global preference management.
- **params (`update`)**: `{"settings": {"ai_provider": "ai-studio", "ai_api_key": "..."}}`
- **result**: `{"status": "success"}`
