# LogLensAi - TODO

> Last updated: 2026-03-28 (Session: Orchestrator Hub Sprint)
> Source of truth for all sprint work. All Jules sessions must be anchored to items here.

---

## ✅ Done

- [x] Project genesis & scaffolding (AGENTS.md, rules, lefthook)
- [x] Core Python sidecar: DuckDB, Drain3, JSON-RPC API
- [x] Local file tailer (FileTailer)
- [x] SSH remote tailer (SSHLoader)
- [x] Basic React shell with Tauri v2
- [x] Workspace management & source isolation
- [x] Investigation Layout with unified tabs
- [x] Sidecar Stabilization (CORS, 127.0.0.1 binding)
- [x] **FUSION-001**: `FusionConfigEngine` layout (Checklist + Timezone + Parser Status)
- [x] **FUSION-002**: Persistent source configurations via `fusion_configs` in DuckDB
- [x] **FUSION-003**: Sidecar — Implement `get_fused_logs` for optimized multi-source querying
- [x] **ORK-001**: `OrchestratorHub` slide-in drawer (Strategy Picker → Fusion Form) — `src/components/organisms/OrchestratorHub.tsx`
- [x] **ORK-002**: Removed Fusion tab from `WorkspaceTabs`; Fusion now appears as a named source tab — `src/components/molecules/WorkspaceTabs.tsx`
- [x] **ORK-003**: Permanent "Orchestrate" button in `LogToolbar` (violet accent, always visible) — `src/components/organisms/LogToolbar.tsx`
- [x] **ORK-004**: Extended `LogSource.type` with `"fusion"` in `workspaceStore.ts`
- [x] **ORK-005**: Fixed OrchestratorHub self-close bug (stopPropagation + useMemo) — `OrchestratorHub.tsx` + `InvestigationPage.tsx`
- [x] **ORK-006**: Rebuilt `docs/design/theme.md` as full Design System Reference (colors, typography, z-index stack, guardrails)
- [x] **ORK-007**: Toast position moved to `top-center` to avoid blocking drawer footer — `src/App.tsx`
- [x] **PARS-001**: `CustomParserModal` UI — Highlight-to-Parse engine with floating context menu

---

## 🔵 Sprint 03 — Orchestrator Completion (Active)

### P0 — Backend Wire-Up (Blockers)

- [ ] **ORK-BE-001**: Sidecar — Add `fusion_id` param support to `update_fusion_config` / `get_fusion_config`
  - **Files**: `sidecar/src/api.py`, `sidecar/src/db.py`
  - Currently `fusion_config` table uses `workspace_id` only — needs `fusion_id` column to support multiple named fusions per workspace
  - Detail: `docs/TODOC/ORK-BE-001.md`

- [ ] **ORK-BE-002**: Sidecar — `get_fused_logs` must accept optional `fusion_id` param to filter by named fusion config
  - **Files**: `sidecar/src/api.py`
  - Fallback: if no `fusion_id`, return all enabled sources (backward compat)
  - Detail: `docs/TODOC/ORK-BE-002.md`

### P1 — Frontend Completion

- [ ] **ORK-FE-001**: `workspaceStore.ts` — Add `updateSource` action for renaming fusion tabs after edit
  - **Files**: `src/store/workspaceStore.ts`
  - Currently fusion name update after edit does nothing (TODO marker at line 298 in InvestigationPage.tsx)

- [ ] **ORK-FE-002**: `InvestigationPage.tsx` — Wire `handleFusionSaved` to call `updateSource` when editing existing fusion
  - **Files**: `src/components/pages/InvestigationPage.tsx`
  - Depends on: `ORK-FE-001`

- [ ] **ORK-FE-003**: `OrchestratorHub.tsx` — Add validation: show disabled state on "Deploy Fusion" if < 2 sources enabled
  - **Files**: `src/components/organisms/OrchestratorHub.tsx`
  - Already validated server-side via toast, but no visual feedback on button

### P2 — Parsing Integration

- [ ] **PARS-002**: Sidecar — Dynamic regex application from `parser_config` JSON stored in `fusion_configs`
  - **Files**: `sidecar/src/parser.py`, `sidecar/src/api.py`
  - Parser config blob from `CustomParserModal` must be decoded and applied during ingest

- [ ] **PARS-003**: Sidecar — Integrate regex parser into `FileTailer` live-tail flow
  - **Files**: `sidecar/src/tailer.py`, `sidecar/src/parser.py`
  - Tailed lines must be normalized using the fusion's parser config before DuckDB insert

- [ ] **PARS-004**: Timezone offset normalization in sidecar (UTC conversion using `tz_offset` from fusion config)
  - **Files**: `sidecar/src/api.py` (ingest path), `sidecar/src/db.py`

---

## 🟡 Sprint 04 — Unified Analysis Engine (Active)

### P0 — Visualization & Context
- [x] **ANALYSIS-001**: Log Distribution Chart (Histogram) — Toggleable via Orchestrator Hub
- [x] **ANALYSIS-002**: Contextual Selection Filter — Right-click/Select-to-Filter logic
- [ ] **FEA-002**: Global Temporal Filtering System
  - [ ] `FEA-002-UI-001`: Migrate `TimeRangePicker` to `LogToolbar`.
  - [ ] `FEA-002-UI-002`: Remove redundant picker from `LogDistributionWidget`.
  - [ ] `FEA-002-BE-001`: Audit `api.py` timestamp parsing for ISO parity.
  - Detail: `docs/TODOC/FEA-002.md`
- [x] **ANALYSIS-003**: Agentic MCP Server — Expose sidecar tools for external AI agents

### P1 — Advanced Intel
- [x] **ANALYSIS-004**: Anomaly Engine — Statistical outlier detection (Toggle in Hub)
- [x] **ANALYSIS-005**: Logical Templates — Save/Load filter-highlights per log source
- [x] **AI-001**: Implement `analyze_cluster` calling the `gemini-cli`
- [x] **AI-002**: Display AI explanation in Diagnostic Sidebar

---

## 🟢 Sprint 05 — Quality & Stability (Active)

### P0 — Sidecar Verification
- [ ] **TEST-BE-001**: sidecar/api.py — Full JSON-RPC parity test suite (Pytest)
  - Detail: `docs/TODOC/TEST-BE-001.md`
- [ ] **TEST-BE-002**: sidecar/mcp_server.py — MCP tools validation
  - Detail: `docs/TODOC/TEST-BE-002.md`

### P1 — Frontend Integrity
- [ ] **TEST-FE-001**: src/store/workspaceStore.ts — Full state management coverage (Vitest)
  - Detail: `docs/TODOC/TEST-FE-001.md`
- [ ] **TEST-FE-002**: src/store/investigationStore.ts — View state and source isolation verification
  - Detail: `docs/TODOC/TEST-FE-002.md`

---

## 🟣 Sprint 06 — AI Investigation & Intelligence (Planning)

### P0 — AI Multi-Provider Backend
- [ ] **AI-BE-001**: Modular `AIProvider` Strategy (Gemini CLI, AI Studio, Ollama) — `sidecar/src/ai.py`
- [ ] **AI-BE-002**: AI Persistence Schema in DuckDB (sessions, messages) — `sidecar/src/db.py`
- [ ] **AI-BE-003**: API: `list_models`, `chat_session` orchestration — `sidecar/src/api.py`

### P1 — Multi-Log Selection UI
- [ ] **AI-FE-001**: `VirtualLogTable` row selection (checkboxes) & "Actions" column refactor
- [ ] **AI-FE-002**: "Batch Send to AI" Action Pill logic

### P2 — AI Investigation Sidebar
- [ ] **AI-FE-003**: `AIInvestigationSidebar` (Chat interface with session history)
- [ ] **AI-FE-004**: "Agent" Toolbar Integration & Global Settings update

### P3 — Note Refinement
- [ ] **NOTE-FE-001**: Refactor Note View into a smaller floating card/popover (Reduced height, no raw data duplicate)

---

## 🎨 Sprint 07 — UI/UX Refinement (Planning)

### P1 — General Ergonomics
- [x] **UX-001**: Sidebar Collapse Functionality
  - [x] State management for `isCollapsed`
  - [x] Header/Logo refactor for collapsed view
  - [x] Mini workspace icons with tooltips
  - [x] Bottom navigation collapse
  - Detail: `docs/TODOC/UX-001.md`

---

## ⚪ Backlog (Future Sprints)

- [ ] **DASH-001**: Dashboard page (placeholder nav item)
- [ ] **EXPORT-001**: Export filtered logs to CSV / JSON
- [ ] **KEYBIND-001**: Keyboard shortcuts (⌘K command palette)
