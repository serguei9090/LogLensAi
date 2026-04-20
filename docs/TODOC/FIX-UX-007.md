# FIX-UX-007: AI Provider Polish & Dependency Alignment

## 🛠️ Problem Statement
1. **ModuleNotFoundError**: The sidecar failed to start because the `openai` package was used in `sidecar/src/ai/openai_compatible.py` but not installed in the `uv` environment.
2. **UI Aesthetic Issue**: The AI provider select menu contained descriptive text in brackets (e.g., `(Native Local)`) which the user identified as non-professional.

## 🎯 Objectives
- Install `openai` library in the sidecar.
- Remove all bracketed descriptions from `SettingsPanel.tsx`.

## 🏗️ Implementation Details

### Backend
- **Action**: Run `uv add openai` in `sidecar/`.
- **Validation**: Verify that `ruff` check passes.

### Frontend
- **Action**: Update `SettingsPanel.tsx` option labels.
- **Before**: `Gemini CLI (Native Local)`
- **After**: `Gemini CLI`

## ✅ Verification Results
- [x] `openai` installed via `uv`.
- [x] Dropdown names cleaned.
- [x] `ruff` check passed.
- [x] `biome` check passed.
