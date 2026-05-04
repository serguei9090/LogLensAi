# Spec: LM Studio Provider Integration (LogLensAi-jak)

## Objective
Add LM Studio as a first-class AI provider option in LogLensAi, enabling dynamic model pulling and seamless local inference via LM Studio's OpenAI-compatible endpoint.

## Architecture
- **Provider Layer**: Reuse `OpenAICompatibleProvider` logic but wrap it in an `LMStudio` specific configuration.
- **Settings Store**: Introduce `ai_lmstudio_host` to track the local LM Studio instance URL.
- **UI**: Add a dedicated selection for LM Studio in the settings panel with a pre-filled default URL.

## Implementation Details

### Backend (`sidecar/src/ai/__init__.py`)
- Update `AIProviderFactory` to support `lmstudio`.
- Map `lmstudio` to the `ai_lmstudio_host` setting.
- Default host: `http://localhost:1234/v1`.

### Frontend State (`src/store/settingsStore.ts`)
- Interface `AppSettings` updated with `ai_lmstudio_host`.
- `defaultSettings` updated with `ai_lmstudio_host: "http://localhost:1234/v1"`.

### Frontend UI (`src/components/organisms/SettingsPanel.tsx`)
- Add `lmstudio` to the provider dropdown.
- Add host input field for LM Studio.
- Update labels and descriptions.
- Ensure model list fetching works for LM Studio.

## Verification Plan
1. Open Settings -> AI Intelligence.
2. Select "LM Studio" as provider.
3. Verify "LM Studio Server Host" input appears with default value.
4. Click "Test Connection" (mocked or real if LM Studio is running).
5. Verify "Refresh List" pulls models from LM Studio endpoint.
