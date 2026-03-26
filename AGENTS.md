# Master AI Context: LogLensAi

LogLensAi is a **Tauri v2 desktop application** for professional log analysis. It uses a Python sidecar for heavy lifting (DuckDB storage, Drain3 log clustering) and a React 19 frontend for the UI.

## 🗺️ Rule-Map (Laws of Physics)
- **Architecture**: `.agents/rules/Architecture.md` (Hexagonal + Ports/Adapters)
- **Jules CLI**: `.agents/rules/JulesCLI.md` (Remote & Task Delegation)
- **Tracking**: `.agents/rules/ProjectTracking.md` (Session Sync + Boot Sequence)
- **Software Standards**: `.agents/rules/SoftwareStandards.md` (DRY, KISS, SOLID)
- **Quality**: `.agents/rules/Quality.md` (TODO(ID) + Atomic Design)

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
- **Backend Sidecar**: Python 3.12, DuckDB, Drain3, aiohttp
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
    ai.py           ← Gemini CLI integration
```

## 🎨 Design System
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
| `get_logs` | `{ workspace_id, offset, limit, level?, query?, source_id? }` | `{ total, logs[], offset, limit }` |
| `get_clusters` | `{ workspace_id }` | `ClusterEntry[]` |
| `start_tail` | `{ filepath, workspace_id }` | `{ status }` |
| `stop_tail` | `{ filepath, workspace_id }` | `{ status }` |
| `is_tailing` | `{ filepath, workspace_id }` | `boolean` |
| `start_ssh_tail` | `{ host, port, username, password?, filepath, workspace_id }` | `{ status }` |
| `stop_ssh_tail` | `{ connection_id }` | `{ status }` |
| `ingest_logs` | `{ logs: ManualLogEntry[] }` | `{ status }` |
| `update_settings` | `{ settings: Record<string,string> }` | `{ status }` |
| `get_settings` | `{}` | `Record<string,string>` |
| `analyze_cluster` | `{ cluster_id, workspace_id }` | `{ summary, root_cause, recommended_actions[] }` |

## Golden Standards
- **Contract → Interface → Mock → Impl**: define boundaries before writing logic
- **get_cursor() ONLY**: every DuckDB query uses `self.db.get_cursor()` for thread safety
- **on_cleanup must be async**: `async def on_cleanup(_)` in the aiohttp app
- **No silent gaps**: missing logic gets a `TODO(ID)` with a detail file in `docs/TODOC/`
