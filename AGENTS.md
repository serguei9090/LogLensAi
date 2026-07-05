# Master AI Context: LogLensAi

LogLensAi is a **Tauri v2 desktop application** for professional log analysis. It uses a Python sidecar for heavy lifting (DuckDB storage, Drain3 log clustering) and a React 19 frontend for the UI.

## 🗺️ Rule-Map (Laws of Physics)

- **Architecture**: `.agents/rules/System/Architecture.md` (Hexagonal + Ports/Adapters)
- **Software Standards**: `.agents/rules/System/SoftwareStandards.md` (DRY, KISS, SOLID)
- **Quality**: `.agents/rules/System/CodeQuality.md` (TODO(ID) + Atomic Design)
- **UI Design**: `.agents/rules/UI/AtomicDesignStandard.md` (Visual Hierarchy)
- **Docs First**: `.agents/rules/System/DocsFirst.md` (Mandatory documentation rule)
- **Design Standard**: `DESIGN.md` (Unified design tokens & rationale)
- **Intelligence**: `.agents/rules/System/IntelligenceStack.md` (AI Orchestration)

## 🎯 Product Scope (STRICT)

The **only active modules** are:

1. **Investigation Page** — the core log analysis view
2. **Settings Page** — AI provider + Drain3 config + general preferences

**Explicitly OUT of scope** (backlog only, no implementation):

- Dashboard (placeholder nav item, grayed out)
- Metrics views
- Multi-file merge

## 🏗️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Zustand, TanStack Virtual, shadcn/ui
- **Communication**: JSON-RPC 2.0 — HTTP on port 5000 in dev, stdin/stdout in prod
- **Backend Sidecar**: Python 3.12, DuckDB, Drain3, aiohttp, LangGraph, PydanticAI
- **Desktop Shell**: Tauri v2 (Rust)
- **Package Manager**: Bun
- **Linter/Formatter**: Biome (TS/JS), Ruff (Python)

### Pinned Versions (Reproduce with `bun install` + `uv sync`)

| Layer | Package | Version |
|---|---|---|
| Runtime | Node.js (via Bun) | `>=22` |
| Runtime | Python | `>=3.12` |
| Frontend | react + react-dom | `^19.0.0` |
| Frontend | vite | `^6.0.11` |
| Frontend | typescript | `^5.7.3` |
| Frontend | @tauri-apps/api | `^2.10.1` |
| Frontend | @tauri-apps/cli | `^2.3.0` |
| Frontend | zustand | `^5.0.3` |
| Frontend | @tanstack/react-virtual | `^3.11.2` |
| Frontend | lucide-react | `^1.7.0` |
| Frontend | tailwindcss | `^4.0.0` |
| Frontend | @biomejs/biome | `^1.9.4` |
| Sidecar | duckdb | `>=1.2.0` |
| Sidecar | drain3 | `>=0.9.11` |
| Sidecar | aiohttp | `>=3.11.0` |
| Sidecar | aiohttp-cors | `>=0.7.0` |
| Sidecar | paramiko | `>=3.5.0` |
| Sidecar | pydantic | `>=2.10.0` |
| Sidecar | pydantic-ai | `>=1.31.0` |
| Sidecar | langgraph | `>=1.1.9` |
| Sidecar | aiosqlite | `>=0.22.1` |
| Sidecar | ruff | `>=0.9.0` |

## 📁 Mandatory Folder Structure

```text
src/
  components/
    atoms/          ← smallest units (Badge, Switch, Dot, Tooltip)
    molecules/      ← composed atoms (SearchBar, FilterBuilder, FilterTag)
    organisms/      ← full UI sections (LogToolbar, VirtualLogTable, Sidebar)
    templates/      ← layout wrappers (AppLayout, InvestigationLayout)
    pages/          ← assembled views (InvestigationPage, SettingsPage)
    ui/             ← raw shadcn primitives (do not modify logic here)
  store/            ← Zustand stores (workspaceStore, investigationStore)
  lib/
    hooks/          ← custom React hooks (useSidecarBridge, useLogStream)
    utils.ts        ← cn(), formatters
  styles/
    globals.css     ← CSS custom properties — ALL design tokens live here

sidecar/
  src/
    api.py          ← JSON-RPC dispatch & all method_ implementations
    db.py           ← DuckDB singleton (USE get_cursor() NOT get_connection())
    parser.py       ← Drain3 log parsing
    tailer.py       ← FileTailer background thread
    ssh_loader.py   ← SSH remote tailing
    workers/        ← Async worker processes (ClusteringWorker)
    services/       ← Business logic services (FastPathService, RagService)
    ai/
      __init__.py   ← AI Provider Factory
      base.py       ← AI Base Classes
      graph.py      ← LangGraph State Machine
      runner.py     ← Hybrid ADK Runner
      tools.py      ← PydanticAI Tool Registry
      reasoning.py  ← Universal Reasoning Parser
```

## 🎨 Design System

- **Source of Truth**: `DESIGN.md` (Unified tokens for colors, typography, and spacing)
- Dark theme: `#0D0F0E` base, `#22C55E` primary green accent
- **Hard rule**: No hardcoded hex in component files. Use CSS custom properties only.

## ⚡ Boot Sequence (for AI agents)

2. Check `.agents/rules/` for constraints

## 🔌 JSON-RPC API Contract

All methods are called via `useSidecarBridge.ts`. Never change the transport.

| Method | Params | Returns |
|---|---|---|
| `get_logs` | `{ workspace_id, offset, limit, filters, query, sort_by, sort_order }` | `{ total, logs[], offset, limit }` |
| `get_clustering_status`| `{ workspace_id }` | `{ mode, paused, backlog, ... }` |
| `set_clustering_mode` | `{ mode, workspace_id? }` | `{ status, mode, paused }` |
| `start_tail` | `{ filepath, workspace_id }` | `{ status }` |
| `ingest_logs` | `{ logs: IngestLogEntry[] }` | `{ status }` |
| `analyze_cluster` | `{ cluster_id, workspace_id }` | `{ summary, root_cause, recommended_actions[] }` |
| `send_ai_message` | `{ session_id, message, workspace_id }` | `{ response, session_id }` |
| `get_ai_sessions` | `{ workspace_id }` | `AiSession[]` |
| `get_anomalies` | `{ workspace_id, limit? }` | `Anomaly[]` |
| `get_settings` | `{}` | `Record<string,string>` |
| `update_settings` | `{ settings: Record<string,string> }` | `{ status }` |
| `factory_reset` | `{}` | `{ status, message }` |
| `get_health` | `{}` | `{ status, uptime, version }` |

## Golden Standards

- **Team Perspective (NEW)**: We are the new autonomous development team. We value precision, automation, and strict adherence to the defined architecture. We verify before we implement.
- **Markdown-Based Task Tracking (Single Source of Truth)**: All tasks, TODO checklists, sprint tracking, and specs MUST live strictly within local markdown files (specifically `docs/track/TODO.md` and detailed specifications in `docs/track/specs/<ID>.md`). 
    - **Precedence**: This rule takes absolute precedence over any contradictory instructions in `.agents/rules/` (e.g., legacy `bd` or `beads` systems).
    - **No DB Tasks**: Do not use, initialize, or depend on any database-backed task managers.
- **Contract → Interface → Mock → Impl**: define boundaries before writing logic
- **shadcn/ui Standards**: Always use the `shadcn` skill for UI tasks. Use `bunx --bun shadcn@latest` for all component management. Follow the critical rules in the skill (e.g. `cn()` for classes, `gap` over `space-x/y`, `data-icon` for button icons).
- **Pydantic API Validation**: All JSON-RPC methods MUST receive inputs and return outputs validated by strict `Pydantic` models. 
- **Thread-safe Database**: every DuckDB query uses `self.db.get_cursor()` for thread isolation.
- **Graceful Shutdown (Prod vs Dev)**:
  - **Dev**: The `aiohttp` runner must use `async def on_cleanup(_): Database.reset()` to prevent Zombie processes and WAL locks.
  - **Prod**: The `stdin/stdout` loop must gracefully catch `EOF` and `KeyboardInterrupt` and properly close the DuckDB connection before exiting.
- **Testing (ADK Standard)**: Real code over mocks. Test public interface behavior. Fast and isolated tests. High coverage for edge cases.
- **Conventional Commits**: ALL commits must follow the `feat|fix|refactor|docs|test|chore` format.
- **No silent gaps**: missing logic gets a `TODO(ID)` with a detail file in `docs/track/specs/`

## 🤖 Automated Development Pipeline (Jules)

When running `/smith_orchestra_auto`, Jules orchestrates work based on `docs/track/TODO.md`.

### Role Mapping & Responsibility

| Role | Responsibility | Primary Files |
|---|---|---|
| **@pm** | Roadmap & Logic Specs. Owns `TODO.md` and `specs/*.md`. | `docs/track/` |
| **@critique** | Investigative Root Cause & Solution Review. Audits all plans. | `docs/track/LessonsLearned.md` |
| **@backend** | Sidecar, DB, & Logic. Ensures DuckDB cursor safety. | `sidecar/src/` |
| **@frontend** | UI, Layout, & State. Strictly follows `DESIGN.md`. | `src/components/`, `src/store/` |
| **@qa** | Auditing & Bug Fixes. Manages `vitest` and `pytest`. | All codebase |
| **@devops** | Deployment, Packaging, & Automation Scripts. | `src-tauri/`, `scripts/` |

### Working Protocol

1. **Context First**: Always read `AGENTS.md` and `docs/track/TODO.md` before starting.
2. **Spec Verification**: Before implementing a task, verify if its corresponding `docs/track/specs/<ID>.md` exists.
3. **Atomic Commits**: Implement one task (TODO ID) at a time, verify, and document in `docs/track/LessonsLearned.md`.
