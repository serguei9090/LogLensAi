# LogLensAi - TODO

> Last updated: 2026-03-26
> Source of truth for all sprint work. All Jules sessions must be anchored to items here.

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
- [ ] **ARCH-001**: Define atomic folder structure in `src/components/`
  - Atoms / Molecules / Organisms / Templates / Pages
  - Ref: `docs/design/ui-components.md`
- [ ] **ARCH-002**: Implement global CSS variables from `docs/design/theme.md`
  - All colors as CSS custom properties in `src/styles/globals.css`
  - JetBrains Mono + Inter fonts loaded
- [ ] **ARCH-003**: Create `src/components/ui/` with all shadcn components
  - See `docs/design/ui-components.md` for full list

### P1 — Workspace Management
- [ ] **WS-001**: Zustand store for workspaces (`src/store/workspaceStore.ts`)
  - Each workspace has: `id`, `name`, `sourceType` (local/ssh), `sourcePath`, `createdAt`
  - Active workspace selector
- [ ] **WS-002**: Sidebar — Workspace list UI
  - Create / rename / delete workspace
  - Click to switch active workspace
- [ ] **WS-003**: Sidecar — workspace-scoped DuckDB queries
  - All `get_logs` / `get_clusters` filtered by `workspace_id`

### P2 — Investigation Page (Core)
- [ ] **INV-001**: `LogToolbar` organism
  - `SearchBar` — debounced full-text search
  - `FilterBuilder` — add/remove filters; each filter: field + operator + value
    - Operators: `=`, `!=`, `contains`, `not contains`, `starts with`
    - Fields: `level`, `source_id`, `cluster_id`, `raw_text`
  - `HighlightBuilder` — add/remove highlight rules; each: term + color (from theme palette)
  - `TailSwitch` — ON/OFF, calls `start_tail` / `stop_tail` RPC
- [ ] **INV-002**: `VirtualLogTable` organism
  - TanStack Virtual for rendering 1M+ rows without lag
  - Columns: `#`, `Timestamp`, `Level`, `Message`, `Cluster`
  - Log rows colored per level (from theme)
  - Highlight terms rendered with background color in cell
  - Click row → expand raw text panel
- [ ] **INV-003**: `ImportFeedModal` organism
  - Tab 1 — Local file: browse + path input + TailSwitch
  - Tab 2 — SSH: host/port/user/pass/path + TailSwitch  
  - Tab 3 — Manual paste: textarea + ingest button
- [ ] **INV-004**: Sidecar — `start_tail` / `stop_tail` / `is_tailing` RPC methods
  - Key: `workspace_id:filepath` prevents duplicate tailers
  - `stop_tail` stops the background thread cleanly

### P3 — Settings Page
- [ ] **SET-001**: Settings layout with Card sections
  - Section: **AI Provider**
  - Section: **Drain3 Configuration**
  - Section: **General**
- [ ] **SET-002**: AI Provider section
  - Selector: `gemini-cli` (default) | `openai` | `anthropic`
  - **Gemini CLI setup**: calls `gemini -p "<prompt>"` as a subprocess; response parsed as JSON
    - Output format: `{ "summary": "...", "root_cause": "...", "actions": ["..."] }`
    - Sidecar method: `analyze_cluster(cluster_id, workspace_id)` → returns structured JSON
  - API key input (hidden, stored in a local `.env` file, never committed)
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

## 🔵 Backlog (Future Sprints)

- [ ] **DASH-001**: Dashboard page (placeholder shell only — disabled in nav)
- [ ] **MULTI-001**: Multi-file chrono-merge (multiple sources per workspace)
- [ ] **ANN-001**: Log row annotation / notes
- [ ] **EXPORT-001**: Export filtered logs to CSV / JSON
- [ ] **KEYBIND-001**: Keyboard shortcuts (⌘K command palette)

---

## 🔴 Known Bugs
- [ ] **BUG-001**: DuckDB shared connection throws "No open result set" under concurrent read/write
  - Root cause: single `conn` object shared between FileTailer thread and API query thread
  - Fix: use `conn.cursor()` per query call (thread-isolated)
- [ ] **BUG-002**: Sidecar `on_cleanup` fires as a sync function inside `aiohttp`, causing `TypeError: NoneType can't be used in await`
  - Fix: convert to `async def on_cleanup(_)`
