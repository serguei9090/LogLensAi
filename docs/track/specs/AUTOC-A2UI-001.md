# TODOC: AUTOC-A2UI-001 - A2UI v0.9 Integration

## Objective
Implement A2UI v0.9 (Agent-to-UI) protocol to enable the AI assistant to render dynamic, interactive UI components in the investigation sidebar.

## Architecture Decisions
1. **Frontend Protocol**: Extend `AiMessage` to support optional `a2ui_payload`.
2. **Stream Interceptor**: The sidecar API will monitor the AI stream for `[[A2UI]]...[[/A2UI]]` blocks.
3. **Renderer**: A new `A2UIRenderer` component will map A2UI primitives to project-standard `shadcn/ui` components.
4. **Action Handling**: Interactions on A2UI components (e.g., buttons) will callback to the sidecar or update the frontend store via a flexible callback system.

## Implementation Steps

### Iteration 1: Structural Setup
- [ ] Add `a2ui_payload` to `AiMessage` in `src/store/aiStore.ts`.
- [ ] Create `src/components/atoms/A2UIRenderer.tsx` with basic component mapping.
- [ ] Update `AIInvestigationSidebar.tsx` to handle `a2ui_payload`.

### Iteration 2: Streaming & Parsing
- [ ] Update `sidecar/src/api.py` to parse A2UI markers from the SSE stream.
- [ ] Update `sidecar/src/ai/base.py` (Base AI provider instructions).

### Iteration 3: Feature Enrichment & Prompting
- [ ] Implement advanced A2UI components (Log Charts, Action Keys).
- [ ] Update `gemini_cli.py` / `ollama.py` system prompts to leverage A2UI.
- [ ] Verify with 3-iteration loop completion.

## References
- Google A2UI v0.9 Draft Spec
- LogLensAi UI Standards (Atomic Design)
