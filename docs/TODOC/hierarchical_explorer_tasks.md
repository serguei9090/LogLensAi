# Task List: Hierarchical Workspace Explorer Implementation

## Affected Files and Functions

### 1. Database & Schema (`sidecar/src/db.py`)
- **Function: `_setup_schema`**
  - Add `CREATE TABLE IF NOT EXISTS folders`
  - Add `CREATE TABLE IF NOT EXISTS log_sources`
- **New Functions: Hierarchy Management**
  - `get_workspace_hierarchy(workspace_id: str)`: Fetch all folders and sources for a workspace.
  - `create_folder(...)`, `update_folder(...)`, `delete_folder(...)`
  - `upsert_source(...)`, `delete_source(...)`
- **Function: `_run_migrations`**
  - Add migration to create new tables if they don't exist.

### 2. API Models (`sidecar/src/models.py`)
- **New Models:**
  - `FolderCreateRequest`, `FolderUpdateRequest`, `FolderDeleteRequest`
  - `SourceMoveRequest`
  - `HierarchyNode` (Recursive model for tree representation)
- **Update Models:**
  - `GetLogsRequest`: Ensure `source_id` still works (it uses the path currently).

### 3. Backend API (`sidecar/src/api.py`)
- **New Methods:**
  - `method_get_hierarchy`: RPC endpoint for fetching the tree.
  - `method_create_folder`, `method_rename_folder`, `method_delete_folder`
  - `method_move_source`
- **Update Methods:**
  - `method_ingest_logs`: Ensure it can handle sources within folders.

### 4. Frontend State (`src/store/workspaceStore.ts`)
- **Interfaces:**
  - Update `LogSource` to include `folderId?: string`.
  - Add `Folder` interface.
  - Update `Workspace` to include `folders: Folder[]`.
- **Actions:**
  - `addFolder`, `renameFolder`, `removeFolder`, `moveSourceToFolder`.
  - Refactor `addSource`, `removeSource` to call backend API and sync state.
- **Sync Logic:**
  - Implement a mechanism to hydrate the store from the backend on load.

### 5. UI Components (Frontend)
- **`src/components/organisms/Sidebar.tsx`**
  - **Refactor**: Transform static workspace list into an accordion/tree.
  - **New Component**: `SidebarTreeItem` (Recursive component).
  - **Logic**: Handle expansion states and selection.
- **`src/components/organisms/LogToolbar.tsx`**
  - **Refactor**: Delete the `ScrollArea` containing source tabs.
  - **New Component**: `ActiveSourceBreadcrumb` to show current location.
- **`src/components/templates/InvestigationLayout.tsx`**
  - Update props to match new source selection flow.
- **`src/components/pages/InvestigationPage.tsx`**
  - Update `handleSelectSource` and related handlers to work with the tree.

### 6. AI Tools
- **File: `sidecar/src/ai/tools.py` (if it exists) or search-related tools.**
  - Update search context to include folder hierarchy so the AI can report "Found in /Prod/Logs/api.log".

## Implementation Task List

- [ ] **Task 01**: Backend Schema & Models
  - [ ] Update `models.py` with hierarchy requests/responses.
  - [ ] Update `db.py` with `folders` and `log_sources` tables.
  - [ ] Write pytest for `db.py` hierarchy operations.
- [ ] **Task 02**: Backend API Implementation
  - [ ] Implement hierarchy RPC methods in `api.py`.
  - [ ] Verify via standalone RPC calls.
- [ ] **Task 03**: Frontend Store Refactor
  - [ ] Update `workspaceStore.ts` types.
  - [ ] Implement API sync logic.
  - [ ] Write unit tests for the store.
- [ ] **Task 04**: UI - Sidebar Tree
  - [ ] Implement the hierarchical rendering in `Sidebar.tsx`.
  - [ ] Add folder creation/management UI.
- [ ] **Task 05**: UI - Toolbar Cleanup
  - [ ] Remove tabs from `LogToolbar.tsx`.
  - [ ] Implement breadcrumbs.
- [ ] **Task 06**: AI Integration
  - [ ] Update AI tools to respect hierarchy.
- [ ] **Task 07**: Final E2E Verification
  - [ ] Run `bun tauri dev` and verify full flow.
