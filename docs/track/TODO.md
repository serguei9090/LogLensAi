# LogLensAi - TODO

> Last updated: 2026-03-26
> Source of truth for all sprint work. All Jules sessions must be anchored to items here.
> **Note to Jules**: Your primary entry point and rule-map is `AGENTS.md`. Make sure to read it to understand the Hexagonal architecture, Tech Stack (React 19, Tauri v2, Python 3.12, DuckDB, Drain3), and atomic design requirements.

---

## ✅ Done
- [x] Project genesis & scaffolding (`AGENTS.md`, rules, lefthook)
- [x] Core Python sidecar: DuckDB, Drain3, JSON-RPC API
- [x] Local file tailer (FileTailer)
- [x] SSH remote tailer (SSHLoader)
- [x] Basic React shell with Tauri v2

---

## 🟡 Sprint 01 — Foundation Reset (Current Focus)

### P0 — Architecture & Design Spec
- [x] **ARCH-001**: Define atomic folder structure in `src/components/`
  - Atoms / Molecules / Organisms / Templates / Pages
  - Ref: `docs/design/ui-components.md`
- [x] **ARCH-002**: Implement global CSS variables from `docs/design/theme.md`
  - All colors as CSS custom properties in `src/styles/globals.css`
  - JetBrains Mono + Inter fonts loaded
- [x] **ARCH-003**: Create `src/components/ui/` with all shadcn components
  - See `docs/design/ui-components.md` for full list

### P1 — Workspace Management
- [x] **WS-001**: Zustand store for workspaces (`src/store/workspaceStore.ts`)
  - Each workspace has: `id`, `name`, `sourceType` (local/ssh), `sourcePath`, `createdAt`
  - Active workspace selector
- [x] **WS-002**: Sidebar — Workspace list UI
  - Create / rename / delete workspace
  - Click to switch active workspace
- [x] **WS-003**: Sidecar — workspace-scoped DuckDB queries
  - All `get_logs` / `get_clusters` filtered by `workspace_id`

### P2 — Investigation Page (Core)
- [x] **INV-001**: `LogToolbar` organism
  - `SearchBar` — debounced full-text search
  - `FilterBuilder` — add/remove filters; each filter: field + operator + value
    - Operators: `=`, `!=`, `contains`, `not contains`, `starts with`
    - Fields: `level`, `source_id`, `cluster_id`, `raw_text`
  - `HighlightBuilder` — add/remove highlight rules; each: term + color (from theme palette)
  - `TailSwitch` — ON/OFF, calls `start_tail` / `stop_tail` RPC
- [x] **INV-002**: `VirtualLogTable` organism
  - TanStack Virtual for rendering 1M+ rows without lag
  - Columns: `#`, `Timestamp`, `Level`, `Message`, `Cluster`
  - Log rows colored per level (from theme)
  - Highlight terms rendered with background color in cell
  - Click row → expand raw text panel
- [x] **INV-003**: `ImportFeedModal` organism
  - Tab 1 — Local file: browse + path input + TailSwitch
  - Tab 2 — SSH: host/port/user/pass/path + TailSwitch  
  - Tab 3 — Manual paste: textarea + ingest button
- [x] **INV-004**: Sidecar — `start_tail` / `stop_tail` / `is_tailing` RPC methods
  - Key: `workspace_id:filepath` prevents duplicate tailers
  - `stop_tail` stops the background thread cleanly

### P3 — Settings Page
- [x] **SET-001**: Settings layout with Card sections
  - Section: **AI Provider**
  - Section: **Drain3 Configuration**
  - Section: **General**
- [x] **SET-002**: AI Provider section
  - Selector: `gemini-cli` (default) | `openai` | `anthropic`
  - **Gemini CLI setup**: calls `gemini -p "<prompt>"` as a subprocess; response parsed as JSON
    - Output format: `{ "summary": "...", "root_cause": "...", "actions": ["..."] }`
    - Sidecar method: `analyze_cluster(cluster_id, workspace_id)` → returns structured JSON
- [ ] **SET-003**: Drain3 configuration section
  - Fields with tooltips:
    - `Similarity Threshold` (0.0–1.0) — Tooltip: "Controls how aggressively logs are grouped. Higher = stricter matching."
    - `Max Children` (int) — Tooltip: "Max branches per node in the parse tree. Increase for very diverse logs."
    - `Max Clusters` (int) — Tooltip: "Cap on total clusters. Prevents memory bloat on huge log sets."
  - Saved to `Settings` table in DuckDB
- [ ] **SET-004**: General section
  - `Log Row Height` (compact / default / comfortable)
  - `Font Size` slider (12–16px)

---

### P5 — Workspace Tabs (Multi-Source support)
- [x] **WS-TABS-001**: Update `workspaceStore.ts` model to support `sources[]` and `activeSourceId`
- [x] **WS-TABS-002**: Sidecar — Update `FileTailer` and `SSHLoader` to populate `source_id` column
- [x] **WS-TABS-003**: Sidecar — Add `get_workspace_sources(workspace_id)` method to `api.py`
- [x] **WS-TABS-004**: UI — Create `WorkspaceTabs` molecule and integrate into `LogToolbar`
- [x] **WS-TABS-005**: UI — Update `InvestigationPage` to filter logs by `activeSourceId`

### P7 — Stabilization & Orchestration (Active)
- [x] **STAB-001**: Sidecar — Implement CORS support and restrict to 127.0.0.1 binding
- [x] **STAB-002**: UI — Remove all "Browser Mode" and Tauri-detection fallbacks (Desktop Only)
- [x] **STAB-003**: Sidecar — Fix BUG-001 (DuckDB thread safety) and BUG-002 (Async cleanup)
- [x] **AUDIT-001**: Complete Architectural Audit of RPC signatures and DuckDB mapping.
- [ ] **STAB-004**: Dev Mode — Ensure sidecar is automatically started or reachable

---

### P6 — Testing & Quality
- [ ] **TEST-001**: Set up Vitest and React Testing Library for frontend unit tests
- [ ] **TEST-002**: Frontend generic tests (test `LogToolbar`, `TailSwitch` rendering and state)
- [ ] **TEST-003**: Set up `pytest` and `pytest-asyncio` for sidecar backend unit tests
- [ ] **TEST-004**: Backend unit tests (`api.py` query/tail handling, `db.py` cursor safety)
- [ ] **TEST-005**: Integration tests (E2E simulation of loading a log file via RPC and verifying response)

---

## 🔵 Backlog (Future Sprints)

- [ ] **DASH-001**: Dashboard page (placeholder shell only — disabled in nav)
- [x] **ANN-001**: Log row annotation / notes (Multi-line + Sortable)
- [ ] **EXPORT-001**: Export filtered logs to CSV / JSON
- [ ] **KEYBIND-001**: Keyboard shortcuts (⌘K command palette)

---

## 🔴 Known Bugs
- [x] **BUG-001**: DuckDB shared connection throws "No open result set" under concurrent read/write
  - Root cause: single `conn` object shared between FileTailer thread and API query thread
  - Fix: use `conn.cursor()` per query call (thread-isolated)
- [x] **BUG-002**: Sidecar `on_cleanup` fires as a sync function inside `aiohttp`, causing `TypeError: NoneType can't be used in await`
  - Fix: convert to `async def on_cleanup(_)`
