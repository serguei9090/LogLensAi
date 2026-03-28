# Jules Active Implementation Mission: Sprint 03 — Orchestrator & Parser Completion

## 🎯 Primary Objective
Complete the backend and frontend wiring for the new Orchestrator Hub and the Custom Parser Engine. This includes database schema updates, multi-fusion query support, and dynamic regex application.

---

## 🏗️ Technical Roles & Guardrails
- **Design System**: Use `docs/design/theme.md` and `docs/design/ui-components.md`. NO hardcoded hex codes.
- **Backend Architecture**: Use thread-safe `get_cursor()` in DuckDB.
- **Frontend Architecture**: Use Atomic Design for components and Zustand for global state.

---

## 📋 Task List (Atomic Implementation)

### 1. Backend: Multi-Fusion Schema (ORK-BE-001)
- **Ref**: `docs/TODOC/ORK-BE-001.md`
- Update `sidecar/src/db.py` to add `fusion_id` column to `fusion_configs` (Primary Key: `workspace_id`, `fusion_id`).
- Update `sidecar/src/api.py` methods `update_fusion_config` and `get_fusion_config` to handle the `fusion_id` parameter.

### 2. Backend: Multi-Fusion Querying (ORK-BE-002)
- **Ref**: `docs/TODOC/ORK-BE-002.md`
- Update `get_fused_logs` in `sidecar/src/api.py` to filter logs by `fusion_id` if provided.

### 3. Frontend: Store & Wiring (ORK-FE-001 / ORK-FE-002)
- **Ref**: `docs/TODOC/ORK-FE-001.md`, `docs/TODOC/ORK-FE-002.md`
- Add `updateSource` to `src/store/workspaceStore.ts`.
- Wire `handleFusionSaved` in `src/components/pages/InvestigationPage.tsx` to call `updateSource` for existing fusions.

### 4. Frontend: UI Validation (ORK-FE-003)
- **Ref**: `docs/TODOC/ORK-FE-003.md`
- Disable "Deploy" button in `OrchestratorHub.tsx` if checked sources < 2.

### 5. Parser Integration (PARS-002 / 003 / 004)
- **Ref**: `docs/TODOC/PARS-002.md`, `PARS-003.md`, `PARS-004.md`
- Implement `apply_custom_config` in `sidecar/src/parser.py`.
- Integrate parser into `FileTailer` in `sidecar/src/tailer.py`.
- Implement `tz_offset` normalization in `sidecar/src/api.py`.

---

## 🏁 Completion Protocol
1. Run `bun run lint:fix` and `uv run ruff check --fix .`.
2. **MANDATORY**: Update `docs/track/TODO.md` to reflect the completion of all Sprint 03 tasks.
3. Verify that new fusion tabs can be created, edited, and renamed.
