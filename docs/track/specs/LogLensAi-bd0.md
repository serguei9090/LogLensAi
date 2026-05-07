# DASH-FIX-001: Dashboard & Sidebar Synchronization

## Problem Statement
1. **Metrics Inflation**: Dashboard reports 2 catalogs because the `logs` table contains entries for `default-ws` and a legacy ID (`ws-1776950500357`). Only `default-ws` is actually in the `workspaces` store.
2. **Sidebar Highlights**: Selecting "Dashboard" leaves the previously active Workspace highlighted, creating visual confusion.
3. **Ghost Data**: No easy way to prune logs from non-existent workspaces.

## Proposed Changes

### 1. Backend: Dashboard Stats Filtering
- Update `api.py`: `get_dashboard_stats` should accept an optional `active_workspace_ids` list.
- Modify the query to count only logs belonging to these IDs.
- Ensure the workspace count reflects the length of the provided list (or intersection with DB).

### 2. Frontend: Sidebar Highlight Exclusivity
- Update `Sidebar.tsx`:
    - When `activeNav === 'dashboard'`, ensure no workspace is visually "active".
    - Update `onNavSelect` to clear `activeWorkspaceId` when switching to dashboard.
    - Update `selectWorkspace` to set `activeNav` to `'investigation'`.

### 3. Backend: Database Diagnostic Tool
- Create `scripts/diagnose_db.py`:
    - Connect to `data/loglens.duckdb`.
    - Report:
        - List of `workspace_id`s in `logs` table.
        - Log count per ID.
        - Cluster count per ID.
    - Provide a `--cleanup` flag to delete entries for IDs not found in `workspaceStore.ts` (passed as args).

### 4. Cleanup Implementation
- Enhance `api.py` with `method_purge_inactive_workspaces` which takes a list of valid IDs and deletes everything else.

## Verification Plan
1. Run `diagnose_db.py` to see current state.
2. Apply `api.py` fixes and pass active IDs from frontend.
3. Verify Dashboard shows "1" catalog.
4. Test Sidebar navigation to ensure single highlights.
5. (Optional) Run purge to clean DB.
