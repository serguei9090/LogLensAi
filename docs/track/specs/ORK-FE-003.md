# TODO(ORK-FE-003): OrchestratorHub Validation UI

## Context
A fusion must have at least 2 log sources to interleave. Currently, only a server-side toast prevents deploying a single-source "fusion."

## Proposed Changes
1. **Visual State**:
   - IF `enabledCount < 2`:
     - Show a distinct disabled UI on the "Deploy Fusion" / "Update Fusion" button.
     - (Optional) Use a `Tooltip` or an inline notice below the source list: "Fusion requires at least 2 sources."
2. **Logic Override**:
   - `handleDeploy`: Keep server-side validation, but primary guard is `disabled` attribute on button.

## Roles
- **@frontend** (UI Refinement)

## Files
- `src/components/organisms/OrchestratorHub.tsx`: Deploy button state.
