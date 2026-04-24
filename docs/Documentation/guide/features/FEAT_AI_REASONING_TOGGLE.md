# Feature Spec: AI Reasoning Toggle

## Phase 1: Description
Add a quick toggle in the AI Investigation Sidebar to explicitly enable or disable the AI's deep reasoning phase (the "think" feature). This allows users to opt for quicker responses when deep analysis is not needed.

## Frontend Requirements
1. **Atoms**: Add a new toggle button (Lightbulb / LightbulbOff) next to the "Clear Conversation" trash icon in the AI Investigation Sidebar.
2. **State**: Maintain `isReasoningEnabled` state (defaulting to true).
3. **Styles**: Highlight color (e.g., emerald or yellow) when ON, muted/opacity when OFF.

## Backend Requirements
1. Update `sendMessage` JSON-RPC call to accept a new `reasoning` boolean flag.
2. Update the Python sidecar `stream_chat` endpoint and `OllamaProvider` to respect this flag, conditionally applying the `<|think|>` triggers instead of hardcoding it for all `gemma4` requests.

## Acceptance Criteria
- Clicking the lightbulb icon toggles the state visually.
- When OFF, chat requests to `gemma4` skip the reasoning phase and provide immediate text output.
- When ON, the deep reasoning phase is enforced.
