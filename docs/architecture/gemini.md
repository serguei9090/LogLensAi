# LogLensAi Architecture Roadmap (gemini.md)

This file is the main architectural entry point for the LogLensAi application. It outlines the high-level system context, primary architectural roles, and index of detailed specifications for the **React 19 + Tauri v2 + Go 1.26 + Laya AI** stack.

---

## 👥 Architecture Personas

| File Path | Persona | Focus |
|---|---|---|
| `docs/architecture/gemini.md` | `@system-arch` | Overall system context, C4 diagrams, and entry-point indexing. |
| `docs/architecture/interaction_map.md` | `@bridge-arch` | Bridges React 19 stores with Go JSON-RPC handlers and DuckDB. |
| `docs/architecture/diagrams.md` | `@diagram-arch` | Global Mermaid diagrams (triage pipelines, dual-engine sequence, ERD). |
| `docs/architecture/communication.md` | `@rpc-arch` | JSON-RPC 2.0 schema, IPC transports, and error models. |
| `docs/architecture/database.md` | `@db-arch` | DuckDB schema, cursor pool safety, and `cluster_triage` table design. |
| `docs/track/specs/` | `@spec-arch` | Detailed feature implementation specifications (e.g. `FEAT_LAYA_SYSTEM1_ENGINE.md`). |

---

## 🏗️ High-Level System Context (C4-Style)

```mermaid
graph TD
  subgraph User_Environment [Desktop Shell: Tauri v2 (Rust)]
    UI["Frontend (React 19 + Vite 6 + Tailwind v4)"]
    Store["Zustand State (investigationStore / layaStore / dashboardStore)"]
    Bridge["Sidecar Bridge (useSidecarBridge.ts)"]
  end

  subgraph Engine_Environment [Sidecar Engine: Go 1.26]
    RPC["JSON-RPC 2.0 Dispatcher (HTTP :5000 / Stdio)"]
    Ingest["Ingestion Pipeline (File / Tailer / Syslog / HTTP)"]
    Drain["Drain3 Log Clustering (>81k lines/sec)"]
    DB[("DuckDB Columnar Storage (loglens.duckdb)")]
    
    subgraph Laya_System1 ["System 1: Laya Fast Decision Engine (<30ms)"]
      ONNX["ONNX ModernBERT Q8 (Zero-VRAM CPU / DirectML)"]
      Triage["LayaClusterTriager (Bounded Concurrency x4)"]
      Rules["RuleManager & Checkpoint Store (laya_rules.json)"]
      HFDownloader["Hugging Face Model Manager & Downloader"]
    end

    subgraph LLM_System2 ["System 2: Deep Reasoning Engine"]
      LangGraph["LangGraph State Machine (Reasoning -> Tool -> Final)"]
      Tools["Tool Registry (get_logs, analyze_cluster, update_laya_rules)"]
      VSS[("DuckDB-VSS Vector Memory")]
    end
  end

  subgraph External_AI [External AI Engines]
    Ollama["Ollama (Local LLM)"]
    Studio["Google Gemini API"]
    OpenAI["OpenAI Compatible API"]
  end

  %% Client IPC
  UI <--> Store
  UI <--> Bridge
  Bridge <-- "JSON-RPC 2.0 (stdin/stdout or :5000)" --> RPC

  %% Ingestion & Clustering
  RPC <--> Ingest
  Ingest --> DB
  Ingest --> Drain
  Drain --> Triage
  Triage --> ONNX
  Triage --> DB

  %% AI Investigation
  RPC <--> LangGraph
  LangGraph <--> External_AI
  LangGraph --> Tools
  Tools --> DB
  Tools --> Drain
  Tools --> VSS
  Tools --> Rules

  %% Configuration & Models
  RPC <--> Rules
  RPC <--> HFDownloader
  HFDownloader --> ONNX
```

---

## 📂 File Index & Documentation Map

- **[System Interaction Map](interaction_map.md)**: Direct mapping between React stores, Go JSON-RPC handlers, and DuckDB tables.
- **[Visual Diagrams Repository](diagrams.md)**: In-depth sequence diagrams, C4 topologies, and DuckDB ERD with cluster triage schemas.
- **[Database Architecture](database.md)**: Columnar DuckDB table schemas, migration records, and thread-safe cursor patterns.
- **[Communication & Contract](communication.md)**: JSON-RPC 2.0 method catalog, payload definitions, and response envelopes.
- **[Laya System 1 Specification](../track/specs/FEAT_LAYA_SYSTEM1_ENGINE.md)**: Full engineering spec for the ModernBERT ONNX decision engine, rule manager, downloader, and triage hooks.

---

## 🛡️ Architectural Mandates

1. **Dual-Engine Balance**: System 1 (Laya) handles sub-30ms reactive triage and intent routing; System 2 handles generative reasoning and diagnostic explanations.
2. **Zero Ingestion Blocking**: Log clustering and Laya triage must run asynchronously via non-blocking goroutines with bounded concurrency (semaphore max 4).
3. **Cursor Isolation**: All DuckDB queries must acquire thread-safe connections through the cursor manager to prevent WAL locks.
4. **Desktop Autonomy**: Zero-VRAM CPU execution must always be supported to ensure portability on systems without dedicated GPUs.
