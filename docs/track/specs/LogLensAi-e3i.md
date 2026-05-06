# Implementation Spec: DASH-002 - Advanced Dashboard

**Status:** Draft
**Related Issue:** LogLensAi-e3i
**Owner:** @pm

## 1. Overview
Upgrade the existing Dashboard into a high-fidelity analytics view with dual-mode (Static/AI) support, advanced filtering (Workspace, Log Source, Time), and expanded metrics.

## 2. Technical Strategy

### 2.1 Backend (Sidecar Engine)
- **File:** `sidecar/src/api.py`
- **Method:** `method_get_dashboard_stats`
- **Changes:**
    - Add parameters: `workspace_id: str | None`, `source_id: str | None`, `start_time: str | None`, `end_time: str | None`.
    - Update SQL queries to respect `source_id` and time range (`timestamp` column in `logs` table).
    - Increase `LIMIT` for top clusters to 10.
    - Ensure `workspace_count` and `active_tailers` remain global or filtered appropriately if scoped.

### 2.2 Frontend (React)
- **File:** `src/components/pages/DashboardPage.tsx`
- **Components:**
    - **Header**: Contains two dropdowns (Workspace, Log Source) and `TimeRangePicker`.
    - **Main Content**: 
        - High-level metrics (Total Logs, Total Patterns, Workspace Count, Active Streams).
        - Severity Distribution (Bar chart/Breakdown).
        - Top 10 Clusters (List with frequency bars).
    - **Floating Toggle**: A persistent pill-shaped toggle at the bottom center to switch between "Static Dashboard" and "AI Dashboard".
- **State Management**:
    - Use `useWorkspaceStore` for workspace/source selection.
    - Local state for `mode` (static | ai), `timeRange`, and `loading`.

## 3. Tasks

### Phase 1: Backend Enhancement
- [ ] Update `method_get_dashboard_stats` in `sidecar/src/api.py` to support filtering.
- [ ] Add unit tests for filtered stats in `sidecar/tests/test_api_stats.py`.

### Phase 2: Frontend Layout & Filtering
- [ ] Refactor `DashboardPage.tsx` header to include Workspace/Source dropdowns.
- [ ] Integrate `TimeRangePicker` into the dashboard header.
- [ ] Implement the `ModeToggle` molecule (Floating UI).

### Phase 3: Visualizations & Integration
- [ ] Update stats fetching logic to pass all filters.
- [ ] Expand Top Clusters to show 10 items.
- [ ] Add "AI Dashboard" placeholder view/state.

## 4. Acceptance Criteria
- [ ] Dashboard respects selected Workspace and Source.
- [ ] Time range filter correctly limits the metrics shown.
- [ ] Top clusters list shows 10 items.
- [ ] Floating toggle switch between Static and AI modes (Static is the default).
- [ ] UI is responsive and follows the [DESIGN.md](../../DESIGN.md) tokens.
