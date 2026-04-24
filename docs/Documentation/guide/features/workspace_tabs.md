# Feature Spec: Workspace Tabs (Multi-Source Support)

## 1. Overview
Users need the ability to monitor multiple related log files within a single workspace context. Currently, a workspace is tied to a single source. This feature introduces "Tabs" within a workspace to allow multiple sources (local files or SSH paths) and easy switching between them.

## 2. User Stories
- **As a developer**, I want to add multiple log files (e.g., `access.log`, `error.log`) to a single "Web Server" workspace so I can switch between them without changing workspaces.
- **As an SRE**, I want to tail multiple remote logs over SSH and see them as tabs in my investigation view.
- **As a user**, I want to see which logs are currently being tailed and switch the active view to any of them.

## 3. Technical Design

### 3.1 Data Model (Frontend)
Update `Workspace` in `src/store/workspaceStore.ts`:
```typescript
export interface LogSource {
  id: string;      // Unique ID for the source
  name: string;    // Display name (e.g. filename)
  type: "local" | "ssh" | "manual";
  path: string;    // Filepath or connection string
  isActive: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  sources: LogSource[];
  activeSourceId: string | null;
  createdAt: string;
}
```

### 3.2 Data Model (Backend/Database)
- The `logs` table in DuckDB already has a `source_id` column.
- **Change**: `FileTailer` and `SSHLoader` must populate `source_id` with the absolute path of the file being tailed.
- **Change**: `method_get_logs` should default to filtering by `activeSourceId` if provided by the frontend.

### 3.3 RPC Boundary Updates
- **`get_logs`**: Add `source_id` as an optional parameter (or use it via `filters`).
- **`get_workspace_sources(workspace_id)`**: New method returning a list of unique `source_id` values found in the `logs` table for that workspace.

### 3.4 UI Components (Atomic Design)
- **Atoms**: 
    - `SourceBadge`: Indicates if a source is live tailing.
- **Molecules**:
    - `WorkspaceTabs`: A scrollable tab list showing all sources in the current workspace.
    - `AddSourceDialog`: A dialog to add a new `LogSource` to the active workspace.
- **Organisms**:
    - `LogToolbar`: Will host the `WorkspaceTabs`.

## 4. Acceptance Criteria
1. [ ] A user can add multiple local files to a single workspace.
2. [ ] A user can switch between added files using a tab bar.
3. [ ] Switching tabs updates the virtualized log table to show only logs from that source.
4. [ ] The sidecar correctly attributes logs to their respective `source_id`.
5. [ ] Multiple sources can be tailed simultaneously in the background.

## 5. Implementation Plan
1. **Backend**: Update `FileTailer` and `SSHLoader` to ingest `source_id`.
2. **Backend**: Implement `get_workspace_sources` in `api.py`.
3. **Frontend**: Refactor `workspaceStore.ts` to support multiple sources.
4. **Frontend**: Create `WorkspaceTabs` component.
5. **Frontend**: Update `InvestigationPage` to handle source switching and filtering.
