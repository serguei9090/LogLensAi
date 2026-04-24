# PM Analysis: OpenAI-Compatible Settings UI

## Objective
Implement and refine the Settings UI for the OpenAI-Compatible Provider (`openai_compatible.py`) to properly expose and explain the host/base URL and API key fields. This ensures users understand how to configure local engines (like LM Studio) and external APIs (like Groq).

## Context Discovery Summary
- **Backend:** `sidecar/src/ai/openai_compatible.py` uses `host` and `api_key`.
- **Frontend Store:** `src/store/settingsStore.ts` persists `ai_openai_host` and `ai_api_key`.
- **Frontend UI:** `src/components/organisms/SettingsPanel.tsx` currently has the `ai_openai_host` and `ai_api_key` fields conditionally rendering, but the UX/copy is generic and doesn't explicitly support/guide the user for "LM Studio, Groq, etc." as requested by the Master Objective.
- **Action Required:** Enhance the UI text, placeholders, and layout in `SettingsPanel.tsx` to clearly indicate support for local engines (making API key optional/clearer) and third-party APIs.

## Implementation Spec
1. Modify the `ai_openai_host` input in `SettingsPanel.tsx`:
   - Update placeholder to `http://localhost:1234/v1 or https://api.groq.com/openai/v1`
   - Update helper text to explicitly mention LM Studio, Groq, and vLLM.
2. Modify the `ai_api_key` helper text to note that it may be optional for local engines like LM Studio.
