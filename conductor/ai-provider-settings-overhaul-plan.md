# AI Provider Settings Overhaul Plan

## Objective
Ensure the AI settings UI and backend configuration are context-aware, showing only relevant fields for each provider and supporting dynamic model discovery.

## Key Files & Context
- **Frontend:** `src/components/organisms/SettingsPanel.tsx` (UI logic and conditional rendering)
- **Backend API:** `sidecar/src/api.py` (Settings persistence and provider initialization)
- **AI Providers:** 
  - `sidecar/src/ai/__init__.py` (Factory logic)
  - `sidecar/src/ai/ai_studio.py` (Dynamic model listing for Gemini AI Studio)
  - `sidecar/src/ai/openai_compatible.py` (Dynamic model listing for OpenAI Compatible)

## Implementation Steps

### Phase 1: Frontend UI Refactoring
1. **Conditional Rendering in `SettingsPanel.tsx`**:
   - Refactor the "AI Intelligence" section to use a clean conditional block for each provider.
   - **Gemini CLI**: Show `ai_model` (Strategy Select) and `ai_gemini_url`. Hide `ai_api_key`.
   - **Ollama**: Show `ai_model` (Dynamic Select + Refresh) and `ai_ollama_host`. Hide `ai_api_key`.
   - **Gemini AI Studio**: Show `ai_api_key` and `ai_model` (Dynamic Select + Refresh). Hide Host URL.
   - **OpenAI Compatible**: Show `ai_api_key`, `ai_model` (Dynamic Select + Refresh), and `ai_openai_host`.
2. **Standardize Model Selector**:
   - Update the model selector component to be used across Ollama, AI Studio, and OpenAI.
   - Ensure the "Refresh List" button is consistently visible and functional for these providers.
3. **Auto-fetch Logic**:
   - Trigger `fetchModels()` automatically when the provider changes or when host/key fields are updated (with debouncing).

### Phase 2: Backend Logic & Mapping
1. **Provider Mapping in `api.py`**:
   - Fix `method_update_settings` to correctly resolve `host` for `openai-compatible` and `openai` providers using `ai_openai_host`.
   - Ensure `AIProviderFactory` consistently receives the `host` parameter mapped from the correct setting key.
2. **Model Listing Implementation**:
   - **AI Studio**: Implement `list_models` in `AIStudioProvider` using the `google-genai` client.
   - **OpenAI Compatible**: Implement `list_models` in `OpenAICompatibleProvider` using the `openai` client.
   - **Gemini CLI**: Ensure `list_models` returns the standard strategy options (flash, pro, etc.) if not already present.

## Verification & Testing
1. **UI State Verification**:
   - Use the `chrome-devtools` skill to open the settings panel.
   - Programmatically switch between each provider and take screenshots/verify DOM state for field visibility.
2. **Functional Testing**:
   - Verify that "Refresh List" pulls actual models from Ollama (localhost), AI Studio (if key provided), and OpenAI.
   - Verify that saving settings correctly updates the backend AI provider instance with the new host/key/model.
3. **Completion Validation**:
   - Navigate to settings, select each provider, and confirm the UI matches the expected field map.
