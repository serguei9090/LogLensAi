# TODO(ORK-FE-001): Rename Support for Fusion Tabs

## Context
After editing a fusion's name or sources via OrchestratorHub, the corresponding tab in `WorkspaceTabs` should reflect the update. Currently, adding a new source exists (`addSource`), but updating an existing source (like the fusion's name or metadata) is not implemented in `workspaceStore.ts`.

## Proposed Changes
1. **Action Specification**:
   - `updateSource` action in `WorkspaceStore`: `(workspaceId: string, sourceId: string, updates: Partial<LogSource>) => void`
2. **Logic Override**:
   - Locate the source by `sourceId` in the specified `workspaceId`.
   - Merges the `updates` object with the existing `LogSource`.
   - Note: In fusion tabs, `LogSource.path` stores the `fusion_id`, and `LogSource.name` stores the display label.

## Roles
- **@frontend** (Zustand State)

## Files
- `src/store/workspaceStore.ts`: Action implementation and state update.
