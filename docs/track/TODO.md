# LogLensAi - TODO

> Last updated: 2026-03-30 (Session: FixCycle & Audit Sprint)
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
- [x] **ORK-001**: `OrchestratorHub` slide-in drawer (Strategy Picker → Fusion Form)
- [x] **ORK-002**: Fusion tab appears as a named source tab
- [x] **ORK-003**: Permanent "Orchestrate" button in `LogToolbar` (violet accent)
- [x] **ORK-004**: Extended `LogSource.type` with `"fusion"`
- [x] **ORK-005**: Fixed OrchestratorHub self-close bug
- [x] **ORK-006**: Rebuilt `docs/design/theme.md` as full Design System Reference
- [x] **ORK-007**: Toast position moved to `top-center`
- [x] **PARS-001**: `CustomParserModal` UI — Highlight-to-Parse engine
- [x] **ORK-BE-001**: Sidecar — Add `fusion_id` support to configs
- [x] **ORK-BE-002**: Sidecar — `get_fused_logs` with `fusion_id` filtering
- [x] **FEA-002**: Global Temporal Filtering System (Integrated into LogToolbar)
- [x] **TEST-BE-001**: sidecar/api.py — Full JSON-RPC parity test suite
- [x] **TEST-BE-002**: sidecar/mcp_server.py — MCP tools validation
- [x] **TEST-FE-001**: src/store/workspaceStore.ts — Full state management coverage
- [x] **TEST-FE-002**: src/store/investigationStore.ts — View state and source isolation verification
- [x] **AI-BE-001**: Modular `AIProvider` Strategy (Gemini CLI, AI Studio, Ollama)
- [x] **AI-BE-002**: AI Persistence Schema in DuckDB (sessions, messages)
- [x] **AI-BE-003**: API: `list_models`, `chat_session` orchestration
- [x] **AI-FE-001**: `VirtualLogTable` row selection (checkboxes) & Batch Action Pill
- [x] **AI-FE-002**: "Batch Send to AI" logic integrated with Investigation Hub
- [x] **AI-FE-003**: `AIInvestigationSidebar` (Chat interface with session history)
- [x] **AI-FE-004**: "Agent" Toolbar Integration (Orchestrate Hub hooks)
- [x] **NOTE-FE-001**: Refactor Note View into a smaller floating card/bottom panel
- [x] **UX-001**: Sidebar Collapse Functionality (Mini workspace icons + Tooltips)

---

## 🔵 Bug Fixes (Active)

- [x] **FIX-UX-002**: Selection Logic Parity (Normalize row selection in `VirtualLogTable`)
  - **Files**: `src/components/organisms/VirtualLogTable.tsx`
  - **Detail**: `docs/TODOC/FIX-UX-002.md`

---

## 🔵 Sprint 03 — Orchestrator Completion (Active)

### P1 — Frontend Completion

- [ ] **ORK-FE-001**: `workspaceStore.ts` — Add `updateSource` action for renaming fusion tabs after edit
  - **Files**: `src/store/workspaceStore.ts`
  - Currently fusion name update after edit does nothing
- [ ] **ORK-FE-002**: `InvestigationPage.tsx` — Wire `handleFusionSaved` to call `updateSource` when editing
  - **Files**: `src/components/pages/InvestigationPage.tsx`
- [ ] **ORK-FE-003**: `OrchestratorHub.tsx` — Add validation: disabled state on "Deploy Fusion" if < 2 sources
  - **Files**: `src/components/organisms/OrchestratorHub.tsx`

---

## 🔵 Sprint 04 — Dynamic Parsing Engine (Active)

### P0 — Parsing Integration

- [ ] **PARS-002**: Sidecar — Dynamic regex application from `parser_config` JSON
  - **Files**: `sidecar/src/parser.py`, `sidecar/src/api.py`
- [ ] **PARS-003**: Sidecar — Integrate regex parser into `FileTailer` live-tail flow
  - **Files**: `sidecar/src/tailer.py`, `sidecar/src/parser.py`
- [ ] **PARS-004**: Timezone offset normalization in sidecar (UTC conversion using `tz_offset`)

---

## 🟡 Sprint 05 — Advanced Intelligence (Planning)

### P0 — Visualization & Context
- [x] **ANALYSIS-001**: Log Distribution Chart (Histogram) — Toggleable via Orchestrator Hub
- [x] **ANALYSIS-002**: Contextual Selection Filter — Right-click/Select-to-Filter logic
- [x] **ANALYSIS-003**: Agentic MCP Server — Expose sidecar tools for external AI agents

### P1 — Advanced Intel
- [x] **ANALYSIS-004**: Anomaly Engine — Statistical outlier detection
- [x] **ANALYSIS-005**: Logical Templates — Save/Load filter-highlights per log source
- [x] **AI-001**: Implement `analyze_cluster` calling the `gemini-cli`
- [x] **AI-002**: Display AI explanation in Diagnostic Sidebar

---

## ⚪ Backlog (Future Sprints)

- [ ] **DASH-001**: Dashboard page (placeholder nav item)
- [ ] **EXPORT-001**: Export filtered logs to CSV / JSON
- [ ] **KEYBIND-001**: Keyboard shortcuts (⌘K command palette)
