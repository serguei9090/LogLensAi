# FIX-RESET-001: Unified Factory Reset & State Synchronization

## Issue
The user deleted the DuckDB database file manually but still observed "test workspaces" in the UI. This is because workspace metadata is persisted in the frontend's `localStorage` via Zustand, while logs and clusters are in the backend. This creates a fragmented state where the backend is empty but the frontend "ghosts" previous configurations.

## Goal
Implement a unified "Factory Reset" mechanism that clears both backend persistence (DuckDB, Drain3 state, AI sqlite) and frontend persistence (Zustand stores).

## Proposed Changes

### Backend (sidecar/src/api.py)
- Implement `method_factory_reset`:
    1. Close database connection.
    2. Remove `data/loglens.duckdb`, `data/loglens.duckdb.wal`.
    3. Remove `data/drain/` directory content.
    4. Remove `data/ai_state.sqlite`.
    5. Re-initialize the `App` state.

### Backend (sidecar/src/db.py)
- Modify `LogDatabase` to prevent default local file creation if path is not provided.
- Ensure `reset()` properly handles file handles.

### Frontend (src/store/workspaceStore.ts & settingsStore.ts)
- Add a `factoryReset` action that clears all workspaces and resets the store to initial state.
- Ensure `persist` storage is cleared.

### Frontend (src/components/organisms/SettingsPanel.tsx)
- Add a "Danger Zone" section.
- Add a "Factory Reset" button with a confirmation dialog.
- Trigger both sidecar and local store resets.

## Verification
1. Create a workspace with some sources.
2. Ingest logs.
3. Perform Factory Reset.
4. Verify the app reloads to a completely blank state with no workspaces and an empty database.
