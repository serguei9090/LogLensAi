# TODO(ORK-FE-002): Wiring Edit Saves for Fusion Tabs

## Context
Editing an orchestration session in `OrchestratorHub` is already hooked into `InvestigationPage.tsx` via `handleEditFusion`. After saving, the callback `handleFusionSaved` currently only handles adding a NEW fusion source if it doesn't already exist.

## Proposed Changes
1. **Logic Override**:
   - `handleFusionSaved(fusionId, fusionName)` check:
     - IF existing source with `path === fusionId` is found:
       1. Call `updateSource(activeWorkspaceId, existingSrc.id, { name: fusionName })`.
     - ELSE:
       1. Call `addSource(...)` as it currently does.

## Roles
- **@frontend** (UI Wiring)

## Files
- `src/components/pages/InvestigationPage.tsx`: Fusion save handler.
