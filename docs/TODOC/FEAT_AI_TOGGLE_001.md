# FEAT_AI_TOGGLE_001: Reasoning Toggle Validation

## Objective
Implement a UI switch to enable or disable the AI's deep reasoning phase on a per-session/request basis.

## Architectural Choices
- **Frontend State**: Add `isReasoningEnabled` local state in `AIInvestigationSidebar.tsx`.
- **UI Component**: Use `lucide-react`'s `Lightbulb` and `LightbulbOff` icons in the footer header next to the Trash icon. Color it emerald/amber when active, and gray/opacity-50 when inactive.
- **Backend Sync**: (Future Step) We need to update `useAiStore` and the sidecar payload to pass this flag to limit the `gemma4` trigger nudges when disabled.

## Progress
- [x] Spec created.
- [x] UI Toggle implemented.
- [x] Backend RPC updated to respect flag.
