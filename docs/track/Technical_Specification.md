# Technical Specification: LogLensAi Core Architecture

## 1. Executive Summary
This specification defines the architectural standards for LogLensAi, a premium Tauri-based log analyzer. The system uses a Python sidecar with DuckDB for high-throughput persistence and a React 19 frontend for a virtualized, ultra-responsive UI.

## 2. Infrastructure & Standards
- **Sidecar**: Python 3.12 (AIOHTTP + JSON-RPC 2.0). Binds to `127.0.0.1:5000` with CORS support for Vite dev servers.
- **Database**: DuckDB 1.1+ with FTS (Full Text Search). Isolated cursors are mandatory for thread safety.
- **Frontend**: Vite + React 19 + TailwindCSS. Uses TanStack Virtual for large scale log rendering.
- **Proxy**: Tauri Rust layer bridges the frontend HTTP requests to the sidecar STDIO or HTTP.

## 3. Custom Pattern Parser & Regex Normalization
### 3.1 Functional Requirement
- **Highlight-to-Define**: Users select a sample timestamp/level in the UI to generate an extraction rule.
- **Dynamic Regex Generation**: Sidecar creates patterns based on selection range/type.
- **Live Normalization**: All incoming logs are matched against the regex before ingestion to populate the `timestamp` column.

### 3.2 Metadata Schema
- **Table**: `fusion_configs`
  - `workspace_id`: string
  - `source_id`: string (file path/SSH string)
  - `enabled`: boolean
  - `tz_offset`: integer
  - `parser_config`: JSON (regex pattern, offset groups)

### 3.3 Sidecar Logic (FileTailer & Ingest)
1. **Pre-processing**: Each raw line is matched against `parser_config.regex`.
2. **Extraction**: Subgroups or character ranges populate the `timestamp` and `level` columns.
3. **Fallback**: If no pattern matches, current UTC timestamp is applied to ensure sequential visibility.

## 4. Multi-Source Fusion
- **Aggregate View**: Selecting the 'Fusion' tab triggers the `get_fused_logs` core method.
- **Interleaving**: DuckDB performs a `UNION ALL` or a workspace-wide `SELECT` ordered by normalized `timestamp`.
- **Latency**: Queries must be paginated (default 1000 rows) to maintain 60FPS UI interaction.

## 5. Security & Isolation
- All paths are normalized to POSIX style (forward slashes).
- Workspace isolation is enforced at the query level via `workspace_id` filtering.
- Sidecar restricted to local loopback only.
## 6. Temporal Selection & TimeRangePicker Standards
- **Component Geometry**: Popover must use a `min-width: 620px` to accommodate dual-month view for professional investigation.
- **Library Integration**: `react-day-picker` v9+ with `numberOfMonths: 2`.
- **State Synchronization**: 
  - A single `DateRange` state object in `TimeRangePicker` tracks both `from` and `to` points.
  - The `month` state tracks the visible window's anchor (left-most month).
- **Navigation Controls**: 
  - Controls are globally applied to both calendars in view.
  - View-cycling (`Days` → `Months` → `Years`) provides rapid temporal context shifts without breaking the dual layout.
- **Precision Preview**: Real-time display of normalized ISO date-time strings below the interactive grids ensures the user identifies exact investigate boundaries.

## 7. AI Investigation & Interaction
### 7.1 Multi-Provider AI Architecture
- **Provider Tiers**: 
  - **Gemini CLI**: Local fallback via `subprocess`. No key required.
  - **AI Studio (Google)**: Primary cloud provider via `google-generativeai`. Requires API key.
  - **Ollama**: Decentralized local provider via REST API (`localhost:11434`).
- **Model Dynamic Loading**: Providers must expose a `list_models` endpoint to populate UI selectors.

### 7.2 Session & Memory Management
- **Persistence**: Chat history is stored in `ai_sessions` and `ai_messages` (DuckDB).
- **Context Binding**: Each `ai_session` can reference one or more `workspace_id`.
- **Memory Types**:
  - **Workspace Memory**: Deleted upon workspace removal (ephemeral context).
  - **Global Memory**: Persistent across workspaces (base personality/rules).

### 7.3 Multi-Log Selection UI
- **Interaction Logic**: 
  - **Checkboxes**: Primary multi-row selection mechanism in `VirtualLogTable`.
  - **Action Pill**: Floating toolbar triggered by selection containing "Send to AI Chat".
  - **Contextual Icon**: Logs included in an active chat session must show an `AI` indicator in the 'Actions' column.

### 7.4 AI Sidebar (The Agent)
- **Component**: `AIInvestigationSidebar`. Collapsible, right-aligned.
- **Streaming**: Implementation of an EventStream or chunked JSON-RPC response for real-time chat feel.
