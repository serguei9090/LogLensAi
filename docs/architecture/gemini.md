# LogLensAi Architecture Roadmap (gemini.md)

This file is the main point of entry for the application's architecture. It contains the high-level system context, the primary personas for architecture files, and the index of detailed documentation.

## 👥 Architecture Personas

| File Path | Persona | Focus |
|---|---|---|
| `docs/architecture/gemini.md` | `@system-arch` | Overall system context, C4 diagrams, and entry-point indexing. |
| `docs/architecture/layers/frontend.md` | `@frontend-arch` | Component hierarchy (Atomic Design), Zustand stores, and TanStack-virtual virtualization. |
| `docs/architecture/layers/backend.md` | `@backend-arch` | Python sidecar, DuckDB storage engines, Drain3 log clustering, and ingestion pipeline. |
| `docs/architecture/communication.md` | `@bridge-arch` | JSON-RPC 2.0 implementation, Tauri ↔ Sidecar bridging, and API contract validation. |
| `docs/architecture/testing.md` | `@qa-arch` | Unit, Integration, and E2E testing strategies and coverage tracking. |
| `docs/architecture/diagrams.md` | `@diagram-arch` | Global Mermaid.js diagrams (ERD, Sequence, and Flowcharts). |

## 🏗️ High-Level System Context (C4-style)

```mermaid
graph TD
  subgraph User_Environment [Desktop Shell (Tauri v2)]
    UI["Frontend (React 19)"]
    Store["Zustand State (workspaceStore/investigationStore)"]
    Bridge["Sidecar Bridge (useSidecarBridge.ts)"]
  end

  subgraph Engine_Environment [Sidecar Engine (Python 3.12)]
    API["JSON-RPC API (api.py)"]
    Parser["Log Parser (Drain3 / parser.py)"]
    DB["DuckDB Persistence (db.py)"]
    SSH["SSH Remote Loader (ssh_loader.py)"]
    Tailer["File Tailer (tailer.py)"]
  end

  UI <--> Store
  UI <--> Bridge
  Bridge <-- "JSON-RPC (stdin/stdout)" --> API
  API <--> Parser
  API <--> DB
  API <--> Tailer
  Tailer <--> DB
  SSH <--> Parser
  Parser <--> DB

  User_File[(".log files (local)")] --> Tailer
  Remote_Srv[("Remote Server (SSH)")] --> SSH
```

## 📂 File Index & Documentation Map

- **[Frontend Architecture](layers/frontend.md)**: Detailed mapping of every React component, hook, and store value.
- **[Backend Architecture](layers/backend.md)**: Every Python class, method, and DuckDB table definition.
- **[Communication & Contract](communication.md)**: Full JSON-RPC 2.0 method specification and bridge patterns.
- **[Testing & Quality](testing.md)**: Unit, integration, and E2E coverage tracking for the LogLens ecosystem.
- **[Visual Diagrams Repository](diagrams.md)**: Detailed flowcharts and sequence diagrams for complex interactions.

## 🛡️ Mandate
Every new feature, function, or structural file MUST update its corresponding documentation in this directory. Failing to do so is a direct violation of the `ArchitectureDocs.md` rule.
