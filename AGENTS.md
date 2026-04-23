# Master AI Context: LogLensAi

LogLensAi is a **Tauri v2 desktop application** for professional log analysis. It uses a Python sidecar for heavy lifting (DuckDB storage, Drain3 log clustering) and a React 19 frontend for the UI.

## 🗺️ Rule-Map (Laws of Physics)
- **Architecture**: `.agents/rules/Architecture.md` (Hexagonal + Ports/Adapters)
- **Jules CLI**: `.agents/rules/JulesCLI.md` (Remote & Task Delegation)
- **UI Protocol**: `.agents/rules/UIReviewProtocol.md` (Mandatory Propose-First UI changes)
- **Tracking**: `.agents/rules/ProjectTracking.md` (Session Sync + Boot Sequence)
- **Software Standards**: `.agents/rules/SoftwareStandards.md` (DRY, KISS, SOLID)
- **Quality**: `.agents/rules/Quality.md` (TODO(ID) + Atomic Design)
- **Architecture Docs**: `docs/architecture/gemini.md` (Main roadmap & personas)
- **AI Parsing**: `docs/architecture/ai_parsing.md` (Gemma 4 Reasoning logic)
- **Test Tracking**: `docs/architecture/testing.md` (Coverage matrix & QA standards)
- **Arch Mandate**: `.agents/rules/ArchitectureDocs.md` (Mandatory documentation rule)
- **Design Standard**: `DESIGN.md` (Unified design tokens & rationale)

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
| Frontend | @tauri-apps/api | `^2.3.0` |
| Frontend | @tauri-apps/cli | `^2.3.0` |
| Frontend | zustand | `^5.0.3` |
| Frontend | @tanstack/react-virtual | `^3.11.2` |
| Frontend | lucide-react | `^0.469.0` |
| Frontend | tailwindcss | `^3.4.17` |
| Frontend | @biomejs/biome | `^1.9.4` |
| Sidecar | duckdb | `>=1.2.0` |
| Sidecar | drain3 | `>=0.9.11` |
| Sidecar | aiohttp | `>=3.11.0` |
| Sidecar | aiohttp-cors | `>=0.7.0` |
| Sidecar | paramiko | `>=3.5.0` |
| Sidecar | pydantic | `>=2.10.0` |
| Sidecar | pydantic-ai | `>=0.0.14` |
| Sidecar | langgraph | `>=0.2.66` |
| Sidecar | aiosqlite | `>=0.20.0` |
| Sidecar | ruff | `>=0.9.0` |


## 📁 Mandatory Folder Structure
```
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
- See `docs/design/theme.md` for the full color palette (CSS token names + hex values)
- See `docs/design/ui-components.md` for all shadcn components and their atomic layer
- Dark theme: `#0D0F0E` base, `#22C55E` primary green accent
- **Hard rule**: No hardcoded hex in component files. Use CSS custom properties only.

## ⚡ Boot Sequence (for AI agents)
1. Read `docs/track/TODO.md` — understand sprint status
2. Read `docs/design/theme.md` & `docs/design/ui-components.md`
3. Check `.agents/rules/` for constraints
4. Read `docs/jules_instruct.md` for the active implementation prompt

## 🔌 JSON-RPC API Contract
All methods are called via `useSidecarBridge.ts`. Never change the transport.

| Method | Params | Returns |
|---|---|---|
| `get_logs` | `{ workspace_id, offset, limit, filters: FilterEntry[], query?, sort_by?, sort_order? }` | `{ total, logs[], offset, limit }` |
| `get_clusters` | `{ workspace_id }` | `ClusterEntry[]` |
| `start_tail` | `{ filepath, workspace_id }` | `{ status }` |
| `stop_tail` | `{ filepath, workspace_id }` | `{ status }` |
| `is_tailing` | `{ filepath, workspace_id }` | `boolean` |
| `start_ssh_tail` | `{ host, port, username, password?, filepath, workspace_id }` | `{ status }` |
| `stop_ssh_tail` | `{ connection_id }` | `{ status }` |
| `ingest_logs` | `{ logs: IngestLogEntry[] }` | `{ status }` |
| `update_log_comment` | `{ log_id, comment }` | `{ status }` |
| `update_settings` | `{ settings: Record<string,string> }` | `{ status }` |
| `get_settings` | `{}` | `Record<string,string>` |
| `analyze_cluster` | `{ cluster_id, workspace_id }` | `{ summary, root_cause, recommended_actions[] }` |

## Golden Standards
- **Contract → Interface → Mock → Impl**: define boundaries before writing logic
- **Design Conformity**: You MUST strictly use `docs/design/theme.md` for all CSS variables and `docs/design/ui-components.md` for shadcn implementation.
- **shadcn/ui Standards**: Always use the `shadcn` skill for UI tasks. Use `bunx --bun shadcn@latest` for all component management. Follow the critical rules in the skill (e.g. `cn()` for classes, `gap` over `space-x/y`, `data-icon` for button icons).
- **Pydantic API Validation**: All JSON-RPC methods MUST receive inputs and return outputs validated by strict `Pydantic` models. 
- **Thread-safe Database**: every DuckDB query uses `self.db.get_cursor()` for thread isolation.
- **Graceful Shutdown (Prod vs Dev)**:
  - **Dev**: The `aiohttp` runner must use `async def on_cleanup(_): Database.reset()` to prevent Zombie processes and WAL locks.
  - **Prod**: The `stdin/stdout` loop must gracefully catch `EOF` and `KeyboardInterrupt` and properly close the DuckDB connection before exiting.
- **Testing (ADK Standard)**: Real code over mocks. Test public interface behavior. Fast and isolated tests. High coverage for edge cases.
- **Conventional Commits**: ALL commits must follow the `feat|fix|refactor|docs|test|chore` format.
- **No silent gaps**: missing logic gets a `TODO(ID)` with a detail file in `docs/TODOC/`

## 🤖 Automated Development Pipeline (Jules)
When running `/startcycle`, Jules orchestrates work based on `docs/track/TODO.md`.

### Role Mapping & Responsibility
| Role | Responsibility | Primary Files |
|---|---|---|
| **@pm** | Roadmap & Logic Specs | `docs/track/TODO.md`, `docs/TODOC/*.md` |
| **@critique** | Investigative Root Cause & Solution Review | `docs/track/LessonsLearned.md`, All codebase |
| **@architect** | API Contract & Standards | `docs/API_SPEC.md`, `sidecar/src/api.py` (models) |
| **@backend** | Sidecar, DB, & Logic | `sidecar/src/*.py` |
| **@frontend** | UI, Layout, & State | `src/components/*`, `src/store/*`, `src/styles/` |
| **@qa** | Auditing & Bug Fixes | All codebase |
| **@devops** | Deployment & Packaging | `src-tauri/`, `Dockerfile`, `scripts/` |

### Working Protocol
1. **Context First**: Always read `AGENTS.md` and `docs/track/TODO.md` before starting.
2. **Spec Verification**: Before implementing a task, verify if its corresponding `docs/TODOC/<ID>.md` exists.
3. **Atomic Commits**: Implement one task (TODO ID) at a time, verify, and document in `docs/track/LessonsLearned.md`.
