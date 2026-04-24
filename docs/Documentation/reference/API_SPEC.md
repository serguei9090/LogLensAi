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

## 📡 Tailing & Streaming (Real-time)

### `start_tail`
Start real-time monitoring of a local file.
- **params**: `{"workspace_id": "ws-...", "filepath": "/path/to/log"}`
- **result**: `{"status": "started"}`

### `stop_tail`
Stop monitoring a file.
- **params**: `{"workspace_id": "ws-...", "filepath": "/path/to/log"}`
- **result**: `{"status": "stopped"}`

### `start_ssh_tail`
Monitor a remote file via SSH.
- **params**: `{"workspace_id": "ws-...", "host": "...", "port": 22, "username": "...", "password": "...", "filepath": "..."}`
- **result**: `{"status": "started", "connection_id": "..."}`

---

## 📁 Workspace & Source Management

### `get_hierarchy`
Fetch the full tree of folders and log sources.
- **params**: `{"workspace_id": "ws-..."}`
- **result**: `{"folders": [...], "sources": [...]}`

### `create_log_source` / `update_log_source` / `delete_log_source`
Manage individual log ingestion points.
- **create params**: `{"workspace_id": "ws-...", "name": "...", "type": "file", "path": "..."}`
- **result**: `{"status": "success", "source_id": "..."}`

### `move_source`
Move a source between folders.
- **params**: `{"source_id": "...", "target_folder_id": "..."}`
- **result**: `{"status": "success"}`

---

## 📥 Log Management

### `ingest_logs`
Bulk ingest raw log strings.
- **params**: `{"workspace_id": "ws-...", "logs": [{"timestamp": "...", "message": "...", "level": "..."}]}`
- **result**: `{"status": "success", "count": 100}`

### `delete_logs`
Wipe logs for a workspace or specific source.
- **params**: `{"workspace_id": "ws-...", "source_id": "..." | null}`
- **result**: `{"status": "success"}`

### `export_logs`
Export filtered logs to a file.
- **params**: `{"workspace_id": "ws-...", "filters": [...], "format": "json" | "csv"}`
- **result**: `{"status": "success", "filepath": "..."}`

---

## ⚙️ Configuration & System

### `get_settings` / `update_settings`
Global preference management (AI Provider, API Keys, Drain3 Config).
- **params (`update`)**: `{"settings": {"ai_provider": "gemini-cli", ...}}`
- **result**: `{"status": "ok"}`

### `factory_reset`
**DANGER**: Wipes all databases, AI states, and Drain clusters.
- **params**: None
- **result**: `{"status": "ok", "message": "Backend reset complete."}`
