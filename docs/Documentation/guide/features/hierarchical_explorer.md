# Feature Spec: Hierarchical Workspace Explorer

## Overview
Refactor the log source management from a tab-based UI to a hierarchical explorer in the sidebar. This supports workspaces containing nested folders and log sources, preventing UI breakage with many files and improving organization.

## User Story
As a user with many log files in a workspace, I want to organize them into folders and view them in a tree structure in the sidebar, so that I can easily navigate and search across my logs without breaking the interface.

## Architectural Changes

### 1. Database Schema (DuckDB)
We need to persist the hierarchy in the backend to ensure consistency across sessions and enable server-side searching/organization.

- **New Table: `folders`**
  - `id`: TEXT (Primary Key)
  - `workspace_id`: TEXT (Foreign Key)
  - `parent_id`: TEXT (Nullable, for nesting)
  - `name`: TEXT
  - `created_at`: TIMESTAMP

- **New Table: `log_sources`** (Migrating from frontend-only storage)
  - `id`: TEXT (Primary Key)
  - `workspace_id`: TEXT (Foreign Key)
  - `folder_id`: TEXT (Nullable)
  - `name`: TEXT
  - `type`: TEXT ('local', 'ssh', 'manual', 'fusion', 'live')
  - `path`: TEXT
  - `created_at`: TIMESTAMP

### 2. Backend API (JSON-RPC)
Add methods for managing the hierarchy:
- `get_hierarchy(workspace_id)`: Returns the tree of folders and sources.
- `create_folder(workspace_id, name, parent_id?)`
- `rename_folder(folder_id, name)`
- `delete_folder(folder_id)`
- `move_source(source_id, folder_id?)`
- `move_folder(folder_id, parent_id?)`

### 3. Frontend Store (`workspaceStore.ts`)
- Refactor `Workspace` and `LogSource` types to include hierarchy metadata.
- Sync state with the backend API instead of relying solely on `localStorage`.
- Add actions for folder management.

### 4. UI Components
- **`Sidebar.tsx`**: 
  - Update workspace item to be expandable.
  - Implement a recursive `FileTree` component to render folders and sources.
  - Add "New Folder" action and drag-and-drop support (optional, but "move" action required).
- **`LogToolbar.tsx`**: 
  - Remove the horizontal tab bar for sources.
  - Add a "Breadcrumb" or current source indicator.
- **`InvestigationLayout.tsx`**:
  - Adjust layout to accommodate the sidebar-driven source selection.

## AI Tools & Search
- Update search tools to be aware of the folder structure.
- When searching for a log file, the AI should be able to identify its location in the hierarchy (e.g., `Workspace > System Logs > auth.log`).

## Implementation Plan

### Phase 1: Documentation & Specification (Current)
- [x] Create feature spec (`docs/features/hierarchical_explorer.md`)
- [ ] Create detailed task list with affected functions (`docs/track/specs/hierarchical_explorer_tasks.md`)

### Phase 2: Database & Backend
- [ ] Implement `folders` and `log_sources` tables in `db.py`.
- [ ] Add RPC methods in `api.py`.
- [ ] Add Pydantic models in `models.py`.
- [ ] Create unit tests for hierarchy management.

### Phase 3: Frontend Refactor
- [ ] Update `workspaceStore.ts` types and sync logic.
- [ ] Refactor `Sidebar.tsx` to render the tree.
- [ ] Remove tabs from `LogToolbar.tsx`.
- [ ] Update `InvestigationPage.tsx` to handle tree-based selection.

### Phase 4: AI & Polish
- [ ] Update AI search tools.
- [ ] Final UI polish and responsiveness checks.
