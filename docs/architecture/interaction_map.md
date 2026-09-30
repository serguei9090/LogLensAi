# System Interaction Map

This document bridges the **React 19** frontend stores, hooks, and UI components with the **Go 1.26 sidecar backend**, DuckDB persistence, Drain3 clustering, and the Laya AI System 1 decision engine.

---

## 📡 1. The JSON-RPC 2.0 Bridge

All communication between the frontend cockpit and the backend Go sidecar travels through a unified JSON-RPC 2.0 interface.

- **Frontend Transport**: `src/lib/hooks/useSidecarBridge.ts` (using Tauri v2 stdio in desktop mode or HTTP fetch on `http://127.0.0.1:5000` in dev mode).
- **Backend Dispatcher**: `backend-go/cmd/sidecar/main.go` $\rightarrow$ `backend-go/internal/rpc/dispatcher.go`.
- **Application Method Handlers**: `backend-go/internal/app/handlers_*.go`.

---

## 🗺️ 2. Feature-Store-API Mapping

| Feature Area | React Store / Hook | Go RPC Method | Backend File / Persistence |
| :--- | :--- | :--- | :--- |
| **Workspace Mgmt** | `workspaceStore.ts` | `get_hierarchy`, `create_log_source`, `delete_log_source` | `handlers_workspace.go` $\rightarrow$ DuckDB `workspaces`, `log_sources`, `folders` |
| **Log Ingestion** | `ingestionStore.ts` | `ingest_local_file`, `get_ingestion_jobs`, `start_tail`, `stop_tail` | `handlers_ingestion.go` $\rightarrow$ DuckDB `ingestion_jobs`, `logs` |
| **Log Exploration** | `investigationStore.ts` | `get_logs`, `get_fused_logs`, `get_metadata_facets` | `handlers_log.go` $\rightarrow$ DuckDB `logs` |
| **Clustering & Triage**| `investigationStore.ts` | `get_clusters`, `get_clustering_status`, `set_clustering_mode` | `handlers_cluster.go` $\rightarrow$ DuckDB `clusters`, `cluster_triage` |
| **Dashboard Metrics** | `dashboardStore.ts` | `get_dashboard_aggregates`, `get_health` | `handlers_ai_extra.go` $\rightarrow$ DuckDB aggregates |
| **AI Investigation** | `aiStore.ts` | `send_ai_message`, `get_ai_sessions`, `analyze_cluster` | `handlers_ai.go` $\rightarrow$ LangGraph state machine & AI providers |
| **Health & Status** | `healthStore.ts` | `get_health` | `handlers_health.go` $\rightarrow$ In-memory runtime metrics |
| **General Settings** | `settingsStore.ts` | `get_settings`, `update_settings` | `handlers_settings.go` $\rightarrow$ DuckDB `settings` table |
| **Laya AI Engine** | `layaStore.ts` | `get_laya_settings`, `update_laya_settings`, `get_laya_checkpoints`, `rollback_laya_checkpoint`, `save_laya_rules`, `test_laya_rule`, `get_laya_model_status`, `download_laya_model` | `handlers_laya.go` $\rightarrow$ `internal/ai/laya/`, `config/laya_rules.json` |

---

## 🔄 3. Core Data Flows

### A. The Fast-Path Ingestion Lifecycle
1. **Trigger**: User selects a log file via `ImportFeedModal.tsx`.
2. **Action**: `investigationStore` triggers `createSource` then calls `ingest_local_file`.
3. **Backend (`handlers_ingestion.go`)**:
   - Spawns background ingestion task and assigns a job ID.
   - Parses timestamps, log levels, and facet metadata.
   - Batch-inserts columnar records into DuckDB `logs` table.
   - Forwards raw lines into the Drain3 clustering worker.
4. **Monitoring**: `ingestionStore` monitors `get_ingestion_jobs` until state reaches `completed`.
5. **UI Update**: `VirtualLogTable.tsx` fetches new records and maintains virtualized viewport stability.

---

### B. Dynamic Drain3 Ingestion & Background Laya Cluster Triage
1. **Clustering Stream**: As log lines arrive, Drain3 groups them into dynamic templates at over **81,000 lines/second**.
2. **Cluster Batch Event**: When new or updated templates exceed batch thresholds, `clustering.Worker` invokes `ClusterTriageHandler.OnClustersUpdated()`.
3. **Non-Blocking Dispatch**:
   - `LayaClusterTriager` uses a bounded concurrency semaphore (maximum 4 parallel worker goroutines) to ensure line-rate ingestion is never delayed.
   - Uses an in-memory MD5 template cache to eliminate redundant evaluations.
4. **ONNX ModernBERT Evaluation**:
   - Evaluates template with active rubrics: **Category** (database, network, auth, etc.), **Severity** (score 1.0–5.0), and **Outage** (boolean flag).
   - Upserts results into the DuckDB `cluster_triage` table.
5. **Client Enrichment**:
   - When `get_clusters` or `get_dashboard_aggregates` is queried by the frontend, DuckDB executes a `LEFT JOIN cluster_triage` to attach triage metadata.
   - `ClusterRow.tsx` immediately renders `Sev X.X` pills, category tags, and red animated `OUTAGE` banners.

---

### C. Dual-Engine AI Investigation & Auto-Improvement Loop
1. **Query Submission**: User types an investigation prompt in the AI chat sidebar.
2. **Fast Intent Route (System 1)**:
   - Go sidecar passes the user query to the Laya ONNX engine running `tool_intent`.
   - If confidence is high ($\ge 0.85$), a prioritized routing hint is injected into the LangGraph state machine.
3. **System 2 Deep Reasoning**:
   - The LangGraph state machine orchestrates tool execution (`get_logs`, `analyze_cluster`, `search_memory`).
   - Generates contextual diagnostic explanations and recommends corrective action.
4. **AI Auto-Improvement (`update_laya_rules`)**:
   - If the LLM discovers that existing classification criteria or outage rubrics missed a subtle edge case, it invokes the `update_laya_rules` tool.
   - The tool commits a new checkpoint into `config/laya_rules.json` with author `"AI Assistant"`.
   - The frontend's `LayaSettingsPanel.tsx` updates its timeline history with 1-click rollback support.

---

### D. Automated Model Manager & Local Cache Synchronization
1. **Status Inspection**: On app startup or settings navigation, `layaStore` calls `get_laya_model_status`.
2. **Background Download**: If model weights (`encoder_q8.onnx` and `head_q8.onnx`) are missing:
   - The user clicks **Download Model Weights** or enables Laya AI.
   - The Go downloader streams weights from Hugging Face (`nvkudva/laya-web-q8`) into temporary `.part` files.
   - Updates download progress percentage and transfer rate.
   - Atomically renames `.part` files upon SHA/size verification.
3. **Engine Ready**: The ONNX engine initializes the session with the selected execution provider (CPU OpenMP or GPU DirectML).

---

## 🛠️ 4. Desktop IPC Lifecycle (Tauri v2)

- **Process Supervision**: Tauri v2's Rust supervisor spawns the compiled Go sidecar binary (`sidecar.exe`) on application launch.
- **Transport**: Standard JSON-RPC strings over bidirectional `stdin`/`stdout` pipes.
- **Graceful Shutdown**: When the main Tauri window triggers close, a termination signal is sent to the Go sidecar to gracefully flush WAL buffers, close DuckDB singletons, and terminate background tailers.
