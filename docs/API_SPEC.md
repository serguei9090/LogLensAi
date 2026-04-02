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
Handle multi-turn AI chat investigation session with log context and **Hot Mode** taskId persistence.
- **params**: 
  - `workspace_id`: string (required)
  - `message`: string (required)
  - `session_id`: string (optional, starts new session if null)
  - `session_name`: string (optional)
  - `context_logs`: list[integer] (optional log references. *Note: sidecar auto-fetches raw text for these IDs*)
  - `model`: string (optional)
  - `provider_session_id`: string (optional, explicitly reuse a remote taskId/threadId)
- **result**: 
  ```json
  {
    "session_id": "uuid-...",
    "provider_session_id": "afc1295d-...",
    "response": "Based on these 10 logs..."
  }
  ```

### 🧠 Auto-Healing (Context Restoration) Standard
When `provider_session_id` is expired or newly created, the sidecar automatically prepends a `=== CONTEXT RESTORATION (AUTO-HEAL) ===` block to the prompt, ensuring the AI retains the full conversation history from the DuckDB source of truth.

### `get_ai_sessions` / `get_ai_messages`
Browse investigation history.
- **get_ai_sessions params**: `{"workspace_id": "ws-..."}`
- **get_ai_messages params**: `{"session_id": "uuid-..."}`

---

## ⚙️ Configuration Methods

### `get_settings` / `update_settings`
Global preference management (AI Provider, API Keys, Drain3 Config).
- **params (`update`)**: `{"settings": {"ai_provider": "gemini-cli", "ai_gemini_url": "http://localhost:22436", ...}}`
- **result**: `{"status": "ok"}`
