# 📡 Communication Protocol & Bridge Logic

> **Init Selector** — Check one protocol at project start. The AI will use the checked protocol as the source of truth for all backend↔frontend communication code.

<!-- AI_PROMPT: If no protocol is checked below, analyze the project stack from `stack.md` 
     and propose the top 3 options that best fit. Present them as a numbered list with 
     a 1-sentence rationale for each. Wait for user confirmation before checking the box.
     Once confirmed, populate the "Registered Methods" section with the project's actual methods. -->

---

## ⚙️ Protocol Selection

Select the communication protocol for this project:

- [x] **JSON-RPC 2.0 over Tauri IPC** *(Recommended for Tauri desktop apps)*
  — Direct Rust↔Python Sidecar via `invoke()`. Zero network overhead, typed by Pydantic.
- [ ] **JSON-RPC 2.0 over WebSocket** *(Recommended for web apps with real-time needs)*
  — Full-duplex channel. Supports streaming responses and event push.
- [ ] **REST/HTTP (FastAPI)** *(Recommended for standalone web backends or microservices)*
  — Standard HTTP verbs + OpenAPI docs auto-generation.
- [ ] **gRPC / Protocol Buffers** *(Recommended for high-performance multi-service systems)*
  — Binary protocol. Best for internal service-to-service communication at scale.
- [ ] **tRPC** *(Recommended for TypeScript-only full-stack apps — Next.js, Bun)*
  — End-to-end type safety without a schema. Auto-inferred client from server router.
- [ ] **GraphQL (Apollo / Strawberry)** *(Recommended for flexible client-driven data fetching)*
  — Single endpoint. Clients request exactly what they need.

---

## 📐 Protocol Specification

### JSON-RPC 2.0 (Tauri IPC)

**Standard Request Format:**
```json
{
  "jsonrpc": "2.0",
  "method": "METHOD_NAME",
  "params": { },
  "id": "UNIQUE_ID"
}
```

**Standard Response Format:**
```json
{
  "jsonrpc": "2.0",
  "result": { },
  "id": "UNIQUE_ID"
}
```

**Bridge Hook (Frontend):**
LogLensAi uses the `useSidecarBridge.ts` hook which abstracts the transport. In development, it uses HTTP to `localhost:5000`. In production, it uses Tauri's `invoke` which pipes to the sidecar's stdin/stdout.

```typescript
// src/lib/hooks/useSidecarBridge.ts
const response = await invoke("call_sidecar", { method, params });
```

---

## 📋 Registered Methods

| Method / Endpoint | Protocol | Request Schema | Response Schema | Description |
|---|---|---|---|---|
| `factory_reset` | JSON-RPC | `ResetRequest` | `ResetResponse` | Complete wipe of DB and storage |
| `get_logs` | JSON-RPC | `LogQuery` | `LogResults` | Query logs with filters and LLQL |
| `start_tail` | JSON-RPC | `TailRequest` | `TailStatus` | Start tailing a local file |
| `ingest_logs` | JSON-RPC | `IngestBatch` | `Status` | Bulk ingestion of log entries |
| `analyze_cluster` | JSON-RPC | `AnalyzeRequest` | `AnalysisResponse` | AI analysis of log clusters |
| `get_dashboard_stats` | JSON-RPC | `StatsRequest` | `DashboardStats` | Summary metrics for investigation |
| `get_health` | JSON-RPC | — | `HealthResponse` | System health and worker status |
| `get_clusters` | JSON-RPC | `ClusterQuery` | `ClusterList` | Retrieve mined templates/clusters |
| `stop_tail` | JSON-RPC | `TailRequest` | `Status` | Stop an active file tailing job |
| `is_tailing` | JSON-RPC | `TailRequest` | `boolean` | Check if a file is being tailed |
| `update_settings` | JSON-RPC | `SettingsUpdate` | `Status` | Update global or workspace settings |

---

## 🔗 References

- **Bridge Rule**: `.agents/rules/Architecture.md` — The Bridge Protocol (Law #1)
- **Backend Layer**: `docs/architecture/layers/backend.md`
- **Frontend Layer**: `docs/architecture/layers/frontend.md`
- **Stack**: `docs/architecture/stack.md`
