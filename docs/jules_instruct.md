# Jules Active Implementation Mission: Sprint 04 — Unified Analysis Engine

## 🎯 Primary Objective
Implement a professional-grade log analysis environment within the LogLensAi Investigation tab. This includes a toggleable distribution chart, a contextual right-click filtering system, a robust MCP server for agentic interaction, and the foundational Anomaly Detection and Template systems.

---

## 🏗️ Technical Roles & Architecture Protocols
- **Expert Personas**:
    - **@backend**: DuckDB, Python sidecar, MCP Server logic.
    - **@frontend**: React 19, Zustand stores, `VirtualLogTable` and `OrchestratorHub` UI.
    - **@qa**: TDD enforcement and behavioral validation.
- **Contract-First Flow**: 
    1. Define `Pydantic` models for JSON-RPC.
    2. Write isolated TDD spec (Vitest/Pytest).
    3. Implement concrete logic.
    4. **MANDATORY**: Produce or update `docs/TODOC/` for every change.
- **Design System**: Use `docs/design/theme.md` and `docs/design/ui-components.md`. NO hardcoded hex codes.

---

## 📋 Task List (Atomic Implementation — ONE BY ONE)

### 1. Visualization: Log Distribution Chart (ANALYSIS-001)
- **Ref**: `docs/TODOC/ANALYSIS-001.md`
- **TDD**: Create `sidecar/tests/test_distribution.py` for aggregation logic.
- **Backend**: Implement `method_get_log_distribution` with `time_bucket`.
- **Frontend**: Add `LogDistributionWidget` to `InvestigationLayout`, toggleable from a new "Visual Layers" section in `OrchestratorHub.tsx`.

### 2. Interaction: Contextual Selection Filter (ANALYSIS-002)
- **Ref**: `docs/TODOC/ANALYSIS-002.md`
- **TDD**: Unit test `investigationStore.setFilters` for inclusive/exclusive logic.
- **Frontend**: Implement `onMouseUp` selection listener in `VirtualLogTable.tsx`.
- **Action**: Show a Floating Action Pill: `(+) Include` / `(-) Exclude` / `(>>) Parser`.

### 3. Agentic: MCP Server Bridge (ANALYSIS-003)
- **Ref**: `docs/TODOC/ANALYSIS-003.md`
- **Architecture**: Integrated `mcp-python-sdk` as a background server in `api.py`.
- **Three-Tier Retrieval**: Implement tools: `ls_sources`, `query_logs`, `get_pattern_summary`.

### 4. Advanced: Anomaly Detection Layer (ANALYSIS-004)
- **Ref**: `docs/TODOC/ANALYSIS-004.md`
- **Logic**: Use Z-Score and Novelty detection from Drain3 clusters.
- **Frontend**: Toggleable overlay for the Distribution Chart and Log Table.

### 5. Utility: Source-Specific Templates (ANALYSIS-005)
- **Ref**: `docs/TODOC/ANALYSIS-005.md`
- **Save**: Add Icon to right of Highlights in `LogToolbar` -> "Template Summary Modal".
- **Load**: Manager in `OrchestratorHub` to apply templates back to specific sources.

---

## 🏁 Completion Protocol (Strict)
1. address **one task at a time** only.
2. After EACH task completion:
    - Run `bun run lint:fix` and `uv run ruff check --fix .`.
    - Update `docs/track/TODO.md` to reflect the task status `[x]`.
3. Commit message format: `feat(discovery): implemented <TASK_ID> with TDD and specs`.
4. Git stage, commit, and push before starting the next task.
