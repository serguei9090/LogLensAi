# TODO(drain_settings_001): Workspace-Specific Drain3 Configuration

## Problem Statement
Currently, Drain3 clustering settings (similarity threshold, max clusters, masking patterns) are global. This is problematic because different log types (e.g., Kubernetes vs. System Logs) require different thresholds and masking rules.

## Proposed Solution
Implement a hierarchical settings system where global settings serve as defaults, and each workspace can optionally override them.

### Data Layer
- Create `workspace_settings` table in DuckDB:
  - `workspace_id`: TEXT
  - `key`: TEXT
  - `value`: TEXT
  - PRIMARY KEY (`workspace_id`, `key`)

### Backend (Sidecar API)
- Update `method_get_settings(workspace_id: str = None)`:
  - If `workspace_id` is provided, fetch both global and workspace-specific settings.
  - Merge them, with workspace settings overriding global ones.
- Update `method_update_settings(settings: dict, workspace_id: str = None)`:
  - If `workspace_id` is provided, save to `workspace_settings` table.
- Update `get_drain_parser(workspace_id)`:
  - Fetch merged settings for the workspace.
  - Initialize the `DrainParser` with these values.

### Frontend (Store)
- Update `useSettingsStore` to support fetching/updating settings for a specific workspace.
- Maintain a local cache of workspace overrides.

### Frontend (UI)
- Add a "Workspace Settings" button/modal in the `LogToolbar` or `InvestigationHeader`.
- Provide a UI to edit:
  - Similarity Threshold
  - Max Clusters / Max Children
  - Masking Rules (Variable Masking)
- Indicate when a value is "Inherited" from global.

## Technical Details
- **Settings Merging**: `merged = {**global_settings, **workspace_settings}`
- **Persistence**: Workspace overrides are stored permanently in DuckDB.
- **UI Component**: Reuse parts of `SettingsPanel.tsx` but filtered for Drain settings.
