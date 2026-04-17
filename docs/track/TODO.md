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
- [x] **AI-BE-004**: Persistent Provider Session Tracking (A2A `taskId` persistence in DuckDB)
- [x] **AI-BE-005**: Automatic Session Hydration (Recover A2A tasks from DB metadata)
- [x] **PR-TEST-001**: Implement Unit Tests for AI Providers (Ollama, AI Studio, Gemini CLI)
- [x] **PR-TEST-002**: Test persistent AI Session taskId Logic (Hot Mode)
- [x] **PR-TEST-003**: Test Multi-Source Fusion with Timezone Normalization (PARS-004)
- [x] **PR-TEST-004**: Unit Test for Metadata Extractor
- [x] **PR-TEST-005**: Unit Test for `VirtualLogTable` virtualization & selection logic
- [x] **PR-TEST-006**: sidecar/api.py — `method_get_health` diagnostic endpoint & uptime tracking
- [x] **PR-TEST-007**: Test sidecar tailing lifecycle (start/stop/is_tailing) with Windows path normalization
- [x] **PARS-004**: Timezone offset normalization in sidecar (UTC conversion using `tz_offset`)
- [x] **AI-FE-001**: `VirtualLogTable` row selection (checkboxes) & Batch Action Pill
- [x] **AI-FE-002**: "Batch Send to AI" logic integrated with Investigation Hub
- [x] **FEAT-AI-NAV-001**: AI Navigation & History Search (Global Trigger + Command Palette)
- [x] **AI-FE-003**: `AIInvestigationSidebar` (Chat interface with session history)
- [x] **AI-FE-004**: "Agent" Toolbar Integration (Orchestrate Hub hooks)
- [x] **NOTE-FE-001**: Refactor Note View into a smaller floating card/bottom panel
- [x] **UX-001**: Sidebar Collapse Functionality (Mini workspace icons + Tooltips)

---

## 🔵 Bug Fixes (Active)

- [x] **FIX-FE-003**: Restore Trash2 Icon in History (Regression from UI refactor)
  - **Files**: `src/components/organisms/AIInvestigationSidebar.tsx`
  - **Detail**: `docs/TODOC/FIX-FE-003.md`
- [x] **FIX-BE-001**: Missing 'os' Import in Ollama Provider (Regression from ENV stabilization)
  - **Files**: `sidecar/src/ai/ollama.py`
  - **Detail**: `docs/TODOC/FIX-BE-001.md`
- [x] **FIX-CORE-001**: Restore AIChatMessage Export (Regression from lint cleanup)
  - **Files**: `sidecar/src/ai/__init__.py`
  - **Detail**: `docs/TODOC/FIX-CORE-001.md`
- [x] **FIX-AI-001**: AI Persistence & Context Strategy (Commit transactions + Multi-turn history)
  - **Files**: `sidecar/src/api.py`, `sidecar/src/ai/ai_studio.py`
  - **Detail**: `docs/TODOC/FIX-AI-001.md`
- [ ] **FIX-AI-002**: Standardized AI History & Universal Auto-Healing (Context Injection)
  - **Files**: `sidecar/src/api.py`, `sidecar/src/ai/gemini_cli.py`, `sidecar/src/ai/ai_studio.py`
  - **Detail**: `docs/TODOC/FIX-AI-002.md`
- [ ] **FIX-FE-001**: Sidebar Button Nesting & Sync (Fix component recursion + Initial fetch)
  - **Files**: `src/components/organisms/AIInvestigationSidebar.tsx`, `src/store/aiStore.ts`
- [ ] **FIX-UX-004**: Context-Aware AI Hub (Highlight session logs + VS Code style history + Renaming)
  - **Files**: `src/components/organisms/AIInvestigationSidebar.tsx`, `src/components/organisms/VirtualLogTable.tsx`, `sidecar/src/api.py`, `src/store/aiStore.ts`
  - **Detail**: `docs/TODOC/FIX-UX-004.md`
- [ ] **FIX-UX-006**: Chat Scroll & Context Persistence (Auto-Scroll to Last Answer)
  - **Files**: `src/components/organisms/AIInvestigationSidebar.tsx`
  - **Detail**: `docs/TODOC/FIX-UX-006.md`
- [x] **FIX-UX-005**: Async LLM Provider Stability (Non-blocking CLI execution)
  - **Files**: `sidecar/src/ai/gemini_cli.py`
  - **Detail**: `docs/TODOC/FIX-UX-005.md`
- [x] **FIX-FE-002**: Sidebar Accessibility & Type Safety (Standard native buttons + Readonly props)
  - **Files**: `src/components/organisms/Sidebar.tsx`, `src/components/organisms/AIInvestigationSidebar.tsx`
  - **Detail**: `docs/TODOC/FIX-FE-002.md`
- [x] **FIX-LOG-001**: General Code Quality & Linting Overhaul (Biome/Ruff fixes)
  - **Files**: `src/components/pages/InvestigationPage.tsx`, `sidecar/src/ai.py`, `src/components/organisms/SettingsPanel.tsx`, etc.
  - **Detail**: `docs/TODOC/FIX_LOG_001.md`
- [x] **FIX-CLEAN-001**: Technical Debt Remediation (React Keys, Hooks, A11y)
  - **Files**: `src/components/atoms/MarkdownContent.tsx`, `src/components/organisms/CustomParserModal.tsx`, etc.
  - **Detail**: `docs/TODOC/FIX-CLEAN-001.md`

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
- [x] **PARS-004**: Timezone offset normalization in sidecar (UTC conversion using `tz_offset`)

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
- [x] **FEAT-AI-TOOLS-001**: Advanced AI Copilot Tools & Memory (Search, Memory, Autocompletes)
  - **Detail**: `docs/TODOC/FEAT_AI_TOOLS_001.md`
- [ ] **FEAT-AI-TOOLS-002**: Copilot Context, Skills Manager & UX Polish
  - **Detail**: `docs/TODOC/FEAT_AI_TOOLS_002.md`

---

## ⚪ Backlog (Future Sprints)

- [ ] **DASH-001**: Dashboard page (placeholder nav item)
- [ ] **EXPORT-001**: Export filtered logs to CSV / JSON
- [ ] **KEYBIND-001**: Keyboard shortcuts (⌘K command palette)
