# Coder Notes

## Implementation Logic
- `SettingsPanel.tsx` already had conditional rendering for `ai_openai_host` and `ai_api_key`. The issue was that the UX was confusing for users trying to use local engines like LM Studio.
- I updated the helper text under the `ai_api_key` input to state that the key is optional for some local engines like LM Studio.
- I updated the placeholder for `ai_openai_host` to provide examples for both a local engine (`http://localhost:1234/v1`) and a third-party API (`https://api.groq.com/openai/v1`).
- I updated the helper text under `ai_openai_host` to explicitly mention "LM Studio, Groq, vLLM".

These changes comply with Atomic Design, reuse the existing `SettingInput` and `SectionLabel` components, and fulfill the Master Objective.
