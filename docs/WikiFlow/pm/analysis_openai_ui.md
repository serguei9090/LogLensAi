# PM Analysis: OpenAI-Compatible Settings UI

## Objective
Enable users to configure OpenAI-compatible providers (LM Studio, Groq, local inference) by providing a UI for the API Base URL and API Key in the Settings Panel.

## Context Discovery Summary
- **Backend:** `sidecar/src/ai/openai_compatible.py` expects `host` and `api_key` in `__init__`.
- **Frontend Store:** `src/store/settingsStore.ts` already defines `ai_openai_host` and `ai_api_key`.
- **Frontend UI:** `src/components/organisms/SettingsPanel.tsx` has some partial logic for `openai-compatible` but lacks the specific input fields for `ai_openai_host` when that provider is selected. It currently only shows `ai_api_key`.
- **Atomic Design:** Must use `SettingInput` and `SectionLabel` atoms defined in `SettingsPanel.tsx`.

## Task Breakdown
1. **Frontend Modification:**
   - Update `src/components/organisms/SettingsPanel.tsx`.
   - Ensure `ai_openai_host` is visible and editable when `ai_provider === 'openai-compatible'`.
   - (Optional) Enhance the UI to specifically mention local engines like LM Studio for this provider.

2. **Validation:**
   - Verify `update` function correctly persists the host URL.
   - Verify `fetchModels` (which is already reactive to `settings.ai_openai_host`) triggers correctly.

## Proposed Plan
- I will hand off to **Coder (Frontend)** to implement the missing `ai_openai_host` input field in the `ai` section of the `SettingsPanel`.
