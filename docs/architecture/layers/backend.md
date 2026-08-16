# ⚙️ Backend Architecture

> **Init File** — Populate this file when the backend/sidecar is set up. The AI uses this as the source of truth for all Go package creation, DB queries, and RPC method registration.

> **Migration note (2026-08)**: this file previously described the Python sidecar (`sidecar/src/`). It has been rewritten for the Go sidecar (`backend-go/`) that replaced it. Contract-level details (method names, params, returns) are unchanged — only the implementation. See `docs/migration/STATUS.md` for the full migration record, including real bugs found/fixed during the port.

<!-- AI_PROMPT: Before implementing any new backend method or DB query, read this file.
     Every new RPC method registered in internal/rpc MUST be registered in the "Registered Methods" table.
     Every new DB table MUST be registered in the "Data Store" section.
     Do not write code that contradicts the patterns defined here. -->

---

## 🧩 Core Packages (Go Sidecar — `backend-go/`)

> Register each package as it is created. One row per top-level `internal/` package.

| Package | Path | Responsibility |
|---------|------|---------------|
| `cmd/sidecar` (entrypoint) | `backend-go/cmd/sidecar/main.go` | Process entrypoint — starts stdio + HTTP transports, calls `RegisterStubs`/`RegisterApp` |
| `rpc` (API Router) | `backend-go/internal/rpc/` | JSON-RPC 2.0 dispatcher — `dispatch.go`, `registry.go`, transports in `http.go`/`stdio.go`, all 67 methods registered |
| `db` | `backend-go/internal/db/` | DuckDB connection mgmt (`db.go`), schema + migrations (`schema.go`, `migrations.go`), settings (`settings.go`), query helpers (`clustering_queries.go`, `ingestion_queries.go`), VSS extension handling (`vss.go`) |
| `app` (composition root) | `backend-go/internal/app/` | `App` struct wiring DB, `DiskLogStore`, `FastPathService`, `SharedSourceManager`, per-scope Drain3 miners, clustering worker, tailer registry; RPC handlers in `handlers_*.go` |
| `drain3` | `backend-go/internal/drain3/` | Hand-ported Drain3 log-template clustering algorithm, cross-validated byte-for-byte against the original Python library |
| `metadata` | `backend-go/internal/metadata/` | Timestamp/level/facet extraction from raw log lines |
| `query` | `backend-go/internal/query/` | LLQL (log query language) parser |
| `ingestion` | `backend-go/internal/ingestion/` | File tailer, SSH tailer, syslog UDP + HTTP push listeners, shared-source dedup |
| `services/clustering` | `backend-go/internal/services/clustering/` | Goroutine-based train-then-tag batch worker — clusters asynchronously after ingest (unlike the old Python `ProcessPoolExecutor` synchronous-at-ingest approach) |
| `services/logstore` | `backend-go/internal/services/logstore/` | Disk-first append-only raw log storage + mmap-based fast-path reads |
| `models` | `backend-go/internal/models/` | Request/response structs (ported from the old `api_schema.json`) |

---

## 🤖 AI / Agent Packages

| Package | Path | Responsibility |
|---------|------|---------------|
| `ai/providers` | `backend-go/internal/ai/providers/` | Ollama / OpenAI-compatible / Gemini HTTP clients, normalized tool-call format, streaming via channels |
| `ai/graph` | `backend-go/internal/ai/graph/` | Hand-written state machine (`reasoning` → `tool_execution` → `final_answer`), 7-tool registry, reasoning-block normalization, context summarization — replaces the old LangGraph + PydanticAI stack |
| `ai/rag` | `backend-go/internal/ai/rag/` | DuckDB-VSS memory search with ONNX embeddings (`nomic-embed-text-v1.5`), hand-written Go WordPiece tokenizer cross-validated token-for-token against Python; parameterized SQL (fixed an injection issue present in the Python original) |
| `ai` (wiring) | `backend-go/internal/ai/wiring.go` | Reconciliation/adapter layer between `providers`/`graph`/`rag`'s independently-built types; `NewProviderFromSettings` |

Known platform gap: no Windows-mingw build of DuckDB's `vss` extension upstream, so vector search runs as brute-force scan (not HNSW-indexed) on Windows. ONNX Runtime is a native-library dependency (`onnxruntime.dll`/`.so`) that must be packaged alongside the sidecar binary.

---

## 🗄️ Data Store (DuckDB)

> See `docs/architecture/database.md` for the full engine selection and schema registry.

### Active Schema Summary

16-table DuckDB schema (see `backend-go/internal/db/schema.go` for the authoritative definitions — same schema the Python sidecar used):

| Table | Description | Key Columns |
|-------|-------------|-------------|
| `logs` | Main log storage | `id`, `timestamp`, `level`, `source_id`, `cluster_id` |
| `workspaces` | Workspace metadata | `id`, `name`, `created_at` |
| `settings` | K/V application settings | `key`, `value`, `workspace_id` |
| `clusters` | Drain3 cluster metadata | `cluster_id`, `template`, `count` |

---

## 📋 Registered RPC Methods

All 67 methods are registered from `cmd/sidecar/main.go` via `RegisterStubs` (stub-first scaffolding) then `RegisterApp` (real implementations, `internal/rpc/app_methods.go` + `internal/rpc/ai_methods.go` + `internal/rpc/settings_methods.go` etc.), backed by handlers under `internal/app/handlers_*.go`.

| Method Name | Request Model | Response Model | Description |
|-------------|--------------|----------------|-------------|
| `factory_reset` | `ResetRequest` | `ResetResponse` | Complete wipe of DB and storage |
| `get_logs` | `LogQuery` | `LogResults` | Query logs with filters and LLQL |
| `start_tail` | `TailRequest` | `TailStatus` | Start tailing a local file |
| `ingest_logs` | `IngestBatch` | `Status` | Bulk ingestion of log entries (rows inserted unprocessed; clustering happens async via `services/clustering.Worker`) |
| `analyze_cluster` | `AnalyzeRequest` | `AnalysisResponse` | AI analysis of log clusters |
| `get_dashboard_stats` | `StatsRequest` | `DashboardStats` | Summary metrics for the Dashboard page |
| `get_clustering_status` | `{ workspace_id }` | `{ mode, paused, backlog, ... }` | Poll until `backlog=0` before comparing cluster-derived output — clustering is asynchronous in Go, unlike Python's synchronous-at-ingest model |
| `get_health` | — | `HealthResponse` | System health and worker status |

Full method list: `backend-go/internal/rpc/registry.go` and the mirrored table in `AGENTS.md`.

---

## 🔒 Sidecar Architecture Rules

> From `.agents/rules/System/Architecture.md` — Bridge Protocol (Law #1)

1. **All methods return serialized data** — No raw `time.Time` leaking unformatted. Stringify timestamps (RFC3339/ISO 8601).
2. **Every method has a typed request struct** — defined in `internal/models/requests.go`, no free `map[string]interface{}` params at the handler boundary.
3. **Connection/cursor isolation** — go through `internal/db`'s helpers within every handler; never share a raw connection across goroutines without its locking discipline.
4. **No direct sidecar calls from the frontend UI layer** — All calls go through `sidecar_bridge.dart`'s `callSidecar()`.
5. **Go test coverage** — Every package under `internal/` has a corresponding `_test.go`; run `go test ./...` from `backend-go/`.

### Known quirks preserved for wire-parity (documented in code, not bugs)

- `export_logs` silently ignores `source_ids` (mirrors a Pydantic `extra="ignore"` gap in the original Python).
- `get_workspace_sources`'s second query returns paths mixed with IDs (mirrors the original response shape).

### Real bug fixed (not reproduced) during the port

- `update_log_source` previously nulled out unspecified fields in the Python version; Go's request struct is pointer-typed for correct partial-update semantics.

---

## 🔗 References

- **Communication Protocol**: `docs/architecture/communication.md`
- **Database Schema**: `docs/architecture/database.md`
- **Migration Record**: `docs/migration/STATUS.md`
- **Architecture Rule**: `.agents/rules/System/Architecture.md`
