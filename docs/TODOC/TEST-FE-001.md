# TODO(TEST-FE-001): src/store/workspaceStore.ts Full State Management Coverage

## 🎯 Objective
Ensure `workspaceStore.ts` (the global source of truth for workspaces & tabs) remains robust.

## 🏗️ Architectural Choice
- **Framework**: `Vitest`
- **Isolation**: Clean store state via `beforeEach`.
- **Primary Flows to Verify**:
  1. `addSource`: Logic for auto-detecting file/folder/ssh and tab generation.
  2. `removeSource`: Correct tab removal and active tab adjustment.
  3. `setActiveSource`: State transition between views.
  4. `updateSource`: Renaming/Metadata editing.
  5. `loadWorkspaces`: Mocked IDB/Storage persistence layer.

## 🧪 Critical Edge Cases
- Adding duplicate file paths.
- Removing the "last" active tab (ensure zero-state handled).
- Rapidly switching sources during ingestion.
