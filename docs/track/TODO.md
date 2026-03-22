# LogLensAi - Active Tasks (TODO)

This file tracks the overarching progress of the LogLensAi project. Every missing implementation or architectural gap is recorded here along with its unique ID (TODO-ID). Detail files are kept in `docs/TODOC/`.

## The Status Legend
- `[ ]` Pending
- `[/]` In Progress 
- `[x]` Completed & Verified

> **Agent Tracking Protocol**: Tasks marked with `[Actor: @jules-agent]` are designated for the automated vibecoding detached loop. 

## Phase 1: Foundation (Scaffolding)
* `TODO(init_001)`: Initialize Tauri v2 Workspace + React 19 / Bun frontend. `[Actor: @jules-agent]` (Status: `[ ]`)
* `TODO(init_002)`: Scaffold Python Sidecar + uv Environment. `[Actor: @jules-agent]` (Status: `[ ]`)

## Phase 2: The Data Bridge (IPC)
* `TODO(ipc_001)`: Establish Tauri JSON-RPC bridge (Tauri Plugin Shell -> Python STDIN). `[Actor: @jules-agent]` (Status: `[ ]`)
* `TODO(ipc_002)`: Write `pydantic-to-typescript` auto-generation schema sync. `[Actor: @jules-agent]` (Status: `[ ]`)

## Phase 3: Backend Logic (The Engine)
* `TODO(db_001)`: Implement DuckDB schema (`001_init.sql`) and connection singleton. `[Actor: @jules-agent]` (Status: `[ ]`)
* `TODO(db_002)`: Implement Drain3 log parsing and basic ingestion loop. `[Actor: @jules-agent]` (Status: `[ ]`)
* `TODO(db_003)`: Implement Read-Replica API (JSON-RPC methods for paginated SELECT, filtering by Level/Text). `[Actor: @jules-agent]` (Status: `[ ]`)

## Phase 4: Frontend UI (Atomic Design)
* `TODO(ui_001)`: Setup Tailwind v4 + shadcn/ui base configuration. `[Actor: @jules-agent]` (Status: `[ ]`)
* `TODO(ui_002)`: Build Core Layout Organisms (Sidebar, Header, Metric Cards). `[Actor: @jules-agent]` (Status: `[ ]`)
* `TODO(ui_003)`: Implement TanStack Virtual Table for the log viewing grid. `[Actor: @jules-agent]` (Status: `[ ]`)
* `TODO(ui_004)`: Implement Native File Picker (`@tauri-apps/plugin-dialog`) & Search Bar Molecule. `[Actor: @jules-agent]` (Status: `[ ]`)

## Phase 5: E2E Integration
* `TODO(e2e_001)`: Connect Virtual Table to Python JSON-RPC output to render 1M+ rows. `[Actor: @jules-agent]` (Status: `[ ]`)

---
> **Future Modules (Post-MVP)**  
> *Because we use Hexagonal Architecture, these features can be plugged into the engine later without rewriting Phase 1-5 core logic.*

## Phase 6: Advanced Ingestion
* `TODO(ingest_001)`: Live Tailing (File-system watcher streaming new lines to UI). `[Actor: @jules-agent]` (Status: `[ ]`)
* `TODO(ingest_002)`: Remote SSH Loader (Key/Password auth) for remote server logs. `[Actor: @jules-agent]` (Status: `[ ]`)
* `TODO(ingest_003)`: Time-Normalized Merging (Interleave multiple files by timestamp). `[Actor: @jules-agent]` (Status: `[ ]`)

## Phase 7: The "Lens" (AI Providers)
* `TODO(ai_001)`: AI Provider Settings panel (API Key configuration for external LLMs / Local models). `[Actor: @jules-agent]` (Status: `[ ]`)
* `TODO(ai_002)`: "Explain this Cluster" UI action -> Streams selected log group to configured AI. `[Actor: @jules-agent]` (Status: `[ ]`)

## Phase 8: Analytics & Dashboards
* `TODO(dash_001)`: Time-Frame Visualizations (Bar charts for error frequency). `[Actor: @jules-agent]` (Status: `[ ]`)
* `TODO(dash_002)`: Tabbed Workspace wrapper (manage multiple active log views). `[Actor: @jules-agent]` (Status: `[ ]`)
