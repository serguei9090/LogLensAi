# Settings Components

## Overview
Reusable form field primitives and provider-aware model selection controls for the Settings feature.

## Interface
- `[ModelSelector.tsx:ModelSelector]` — Connection-gated model selector supporting provider model list refresh, searchable dropdown/manual input, and OpenRouter free-model chips.
- `[SectionLabel.tsx:SectionLabel]` — Styled `<label>` primitive for settings sections.
- `[SettingInput.tsx:SettingInput]` — Styled `<input>` wrapper merging caller `InputHTMLAttributes<HTMLInputElement>`.
- `[SettingSelect.tsx:SettingSelect]` — Custom accessible combobox/listbox supporting optional search, `:free` model filtering/badges, keyboard navigation, and custom value fallback.

## Invariants
- `[ModelSelector.tsx:ModelSelector]` Renders Refresh List button only when `isVerified` is true and `provider` is one of `["ollama", "lmstudio", "ai-studio", "openai-compatible", "openrouter", "openai"]`; shows Test Connection prompt when `!isVerified`; prepends `<option value={value}>` if `value` is absent from `availableModels`; enables `SettingSelect` search when `availableModels.length > 5 || provider === "openrouter"`; enables `showFreeBadge`, `showFreeFilter`, and `OPENROUTER_FREE_MODELS` quick-select chips strictly when `provider === "openrouter"`.
- `[SettingSelect.tsx:parseOptionChildren]` Extracts option items strictly from valid React elements (`React.isValidElement`), defaulting missing `value` to `""` and missing `children` to `String(value)`.
- `[SettingSelect.tsx:SettingSelect]` Identifies free models by lowercased values matching `:free` or `"openrouter/free"`; resets `searchQuery` (`""`), `onlyFree` (`false`), and `highlightedIndex` (`-1`) when closed; wraps `ArrowDown`/`ArrowUp` across `filteredOptions`; renders custom fallback button only when `filteredOptions.length === 0` and `searchQuery.trim()` is non-empty.

## Side Effects
- `[SettingSelect.tsx:SettingSelect]` Registers and cleans up `document` `"mousedown"` and `"keydown"` listeners while `isOpen` is true; schedules a `50` ms `setTimeout` (cleared on cleanup) to focus `searchInputRef.current` when `isOpen && searchable`; calls `scrollIntoView({ block: "nearest" })` on the highlighted option element.

## Verification
- Run: `bun test`
