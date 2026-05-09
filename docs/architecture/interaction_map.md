# System Interaction Map

This document serves as the high-level bridge between the React frontend stores and the Python Sidecar API.

## 📡 The JSON-RPC Bridge
All communication happens via the `callSidecar<T>` hook.

- **Frontend entry point**: `src/lib/hooks/useSidecarBridge.ts`
- **Backend entry point**: `sidecar/src/api.py` (via `App.dispatch`)

## 🗺️ Feature-Store-API Mapping

| Feature Area | React Store / Hook | Sidecar Method (`method_`) | DuckDB Table / Persistence |
| :--- | :--- | :--- | :--- |
| **Workspace Mgmt** | `workspaceStore.ts` | `get_hierarchy`, `create_log_source`, `delete_log_source` | `workspaces`, `log_sources`, `folders` |
| **Log Ingestion** | `ingestionStore.ts` | `ingest_local_file`, `get_ingestion_jobs`, `start_tail`, `stop_tail` | `ingestion_jobs`, `logs` |
| **Log Exploration** | `investigationStore.ts` | `get_logs`, `get_fused_logs`, `get_metadata_facets` | `logs` (Primary Data Path) |
| **AI Analysis** | `aiStore.ts` | `send_ai_message`, `get_ai_sessions`, `analyze_cluster` | `ai_sessions`, `ai_messages` |
| **Health & Status** | `healthStore.ts` | `get_health` | Memory / Process State |
| **Settings** | `settingsStore.ts` | `get_settings`, `update_settings` | `settings` |

## 🔄 Core Data Flows

### 1. The Fast-Path Ingestion Lifecycle
1. **Trigger**: User selects a file via `ImportFeedModal.tsx`.
2. **Action**: `handleImportLocal` (InvestigationPage) calls `createSource` then `ingest_local_file`.
3. **Backend**:
    - `api.py` creates an `ingestion_job`.
    - `db.py` inserts "skinny rows" into the `logs` table (source pointer + metadata).
    - Raw text is moved to `data/storage/<source_id>.log` for high-performance retrieval.
4. **Monitoring**: `ingestionStore` polls `get_ingestion_jobs` until status is `completed`.
5. **UI Update**: `InvestigationPage` clears `transitioningSourceId` and triggers `fetchLogs()`.

### 2. Live Tailing (Streaming View)
1. **Trigger**: User toggles "Live" in the UI.
2. **Action**: `start_tail` is called for the specific filepath.
3. **Sidecar**: `SharedSourceManager` spawns/attaches a `FileTailer` thread.
4. **Data Injection**: New lines are broadcast to all subscriber workspaces and batch-inserted into DuckDB.
5. **Frontend**: `InvestigationPage` polls `get_logs` every 1s (while tailing is active).
6. **Virtualization**: `VirtualLogTable.tsx` uses `getItemKey` to maintain scroll stability during the stream.

## 🛠️ Internal IPC Logic (Tauri Desktop Only)
- **Rust Wrapper**: `src-tauri/src/sidecar.rs` manages the Python process lifecycle.
- **Transport**: Standard JSON-RPC strings over `stdin`/`stdout`.
- **Termination**: Closing the Tauri window sends a SIGTERM to the Sidecar process to ensure no dangling Python processes remain.
