---
trigger: model_decision
description: Protocol standard for Agent-to-UI (A2UI) v0.9 communication and rendering logic.
---

# A2UI Protocol Standard (LogLensAi)

This rule defines the mandatory structure for AI-to-User Interface (A2UI) communication within LogLensAi.

## 1. Syntax & Markers
All AI-generated UI elements MUST be wrapped in the `[[A2UI]]` and `[[/A2UI]]` markers. 

### Supported Formats:
- **Markup format (Preferred)**: Token-efficient tag-based syntax.
  ```text
  [[A2UI]]
  button label="Filter Errors" action={ "type": "filter", "params": {"level": "ERROR"} }
  [[/A2UI]]
  ```
- **JSON format (Legacy)**: Standard JSON object syntax.
  ```json
  [[A2UI]]
  { "type": "button", "label": "Analyze", "action": "analyze" }
  [[/A2UI]]
  ```

## 2. Rendering Implementation
- **Renderer**: All A2UI payloads MUST be rendered by `A2UIRenderer.tsx`.
- **Styling**: Renderers MUST map A2UI primitives (button, text, surface) to local project design tokens (CSS variables) and `shadcn/ui` components.
- **Library**: Leverage `@a2ui/react` and `@a2ui/web_core` for parsing while maintaining the visual parity of LogLensAi.

## 3. Communication Channel
- **Transport**: A2UI payloads are extracted from the streaming AI chat channel (SSE) or stored as `a2ui_payload` columns in the `ai_messages` table.
- **Persistence**: Every A2UI interaction in history MUST remain interactive upon page reload by storing the raw blueprint.

## 4. Security
- **No Scripting**: A2UI blueprints MUST NEVER contain Javascript code. Actions are limited to pre-defined `action` handlers in the host application.
- **Host Control**: The host application decides IF and HOW an action is executed (e.g., confirming a deletion action).
