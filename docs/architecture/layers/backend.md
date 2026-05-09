# ⚙️ Backend Architecture

> **Init File** — Populate this file when the backend/sidecar is set up. The AI uses this as the source of truth for all Python module creation, DB queries, and API method registration.

<!-- AI_PROMPT: Before implementing any new backend method or DB query, read this file.
     Every new `method_` in api.py MUST be registered in the "Registered Methods" table.
     Every new DB table MUST be registered in the "Data Store" section.
     Do not write code that contradicts the patterns defined here. -->

---

## 🧩 Core Modules (Python Sidecar)

> Register each module as it is created. One row per Python file in `sidecar/src/`.

| Module | Path | Responsibility |
|--------|------|---------------|
| `App` (API Router) | `sidecar/src/api.py` | JSON-RPC dispatcher — all `method_*` live here |
| `Database` | `sidecar/src/db.py` | DuckDB connection manager, `get_cursor()` provider |
| `IngestionServer` | `sidecar/src/ingestion.py` | Log streaming and ingestion management |
| `LogParser` | `sidecar/src/parser.py` | Drain3-based log template extraction |
| `FastPath` | `sidecar/src/services/fast_path.py` | Low-latency in-memory buffer for live logs |
| `DiskLogStore` | `sidecar/src/services/log_file_store.py` | Persistent raw log storage on disk |
| `ClusteringWorker` | `sidecar/src/workers/clustering.py` | Background template mining and clustering |
| `AnomalyDetector` | `sidecar/src/anomalies.py` | Pattern-based anomaly detection service |

---

## 🤖 AI / Agent Modules

| Module | Path | Framework | Responsibility |
|--------|------|-----------|---------------|
| `HybridRunner` | `sidecar/src/ai/runner.py` | ADK 2.0 + LangGraph | Hybrid orchestration for local/remote LLMs |
| `ToolRegistry` | `sidecar/src/ai/tools.py` | Pydantic AI | Tool definition for LLM interaction |

---

## 🗄️ Data Store (DuckDB / SQLite)

> See `docs/architecture/database.md` for the full engine selection and schema registry.

### Active Schema Summary

| Table | Description | Key Columns |
|-------|-------------|-------------|
| `logs` | Main log storage | `id`, `timestamp`, `level`, `source_id`, `cluster_id` |
| `workspaces` | Workspace metadata | `id`, `name`, `created_at` |
| `settings` | K/V application settings | `key`, `value`, `workspace_id` |
| `clusters` | Drain3 cluster metadata | `cluster_id`, `template`, `count` |

---

## 📋 Registered API Methods

| Method Name | Request Model | Response Model | Description |
|-------------|--------------|----------------|-------------|
| `factory_reset` | `ResetRequest` | `ResetResponse` | Complete wipe of DB and storage |
| `get_logs` | `LogQuery` | `LogResults` | Query logs with filters and LLQL |
| `start_tail` | `TailRequest` | `TailStatus` | Start tailing a local file |
| `ingest_logs` | `IngestBatch` | `Status` | Bulk ingestion of log entries |
| `analyze_cluster` | `AnalyzeRequest` | `AnalysisResponse` | AI analysis of log clusters |
| `get_dashboard_stats` | `StatsRequest` | `DashboardStats` | Summary metrics for investigation |
| `get_health` | — | `HealthResponse` | System health and worker status |

---

## 🔒 Sidecar Architecture Rules

> From `.agents/rules/System/Architecture.md` — Bridge Protocol (Law #1)

1. **All methods return serialized data** — No raw `datetime` objects. Stringify timestamps.
2. **Every method has a Pydantic request model** — No free `dict` params.
3. **Cursor isolation** — `get_cursor()` within every method, never shared.
4. **No direct `invoke` calls from frontend** — All calls go through `callSidecar()` bridge hook.
5. **100% pytest coverage** — Every method has a corresponding test in `sidecar/tests/`.

---

## 🔗 References

- **Communication Protocol**: `docs/architecture/communication.md`
- **Database Schema**: `docs/architecture/database.md`
- **Testing**: `docs/architecture/testing_strategy.md` → Unit + Headless sections
- **Architecture Rule**: `.agents/rules/System/Architecture.md`
