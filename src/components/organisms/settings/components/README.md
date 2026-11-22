# Settings Components

## Overview
Reusable form control primitives for the Settings panel, supplying section headings, styled text inputs, searchable custom dropdown selectors with OpenRouter free-model filtering, and verified AI provider/model pickers.

## Interface
- `[ModelSelector.tsx:ModelSelector]` - Exported React component rendering model refresh controls, unverified connection prompt, searchable `SettingSelect` or manual `SettingInput`, and OpenRouter quick-free presets.
- `[SectionLabel.tsx:SectionLabel]` - Exported React component rendering a styled `<label>` header with optional `htmlFor`.
- `[SettingInput.tsx:SettingInput]` - Exported React component wrapping `<input>` with consistent Tailwind theme classes merged via `cn`.
- `[SettingSelect.tsx:SettingSelect]` - Exported React component rendering an accessible custom listbox dropdown with optional live search, `:free` filtering, keyboard navigation, and custom model entry fallback.

## Invariants
- `[ModelSelector.tsx:ModelSelector]` Refresh button renders only when `isVerified` is true and `provider` is in `["ollama", "lmstudio", "ai-studio", "openai-compatible", "openrouter", "openai"]`, and is disabled while `isFetching` is true.
- `[ModelSelector.tsx:ModelSelector]` When `!isVerified`, replaces the model input with a connection verification banner and `Test Connection` button disabled while `isTestingConnection` is true.
- `[ModelSelector.tsx:ModelSelector]` When `isVerified && availableModels.length > 0`, renders `SettingSelect` (`id="ai_model_selector"`, `searchable={availableModels.length > 5 || provider === "openrouter"}`) and prepends `value` if missing from `availableModels`; otherwise renders manual `SettingInput` with `"ollama"` or `"openrouter"` hints; renders `OPENROUTER_FREE_MODELS` quick buttons whenever `provider === "openrouter"` regardless of `isVerified`.
- `[SettingInput.tsx:SettingInput]` Spreads `{...props}` before `className={cn(..., props.className)}` so base classes merge rather than get overwritten.
- `[SettingSelect.tsx:SettingSelect]` Extracts options strictly from `React.isValidElement` children via `parseOptionChildren`; resolves `listboxId` to `${id}-listbox` or a memoized random `select-listbox-*` identifier.
- `[SettingSelect.tsx:SettingSelect]` Identifies free options by `.toLowerCase().includes(":free")` or exact `"openrouter/free"`; filters options by `onlyFree` and case-insensitive substring match on `label`/`value`; wraps `highlightedIndex` on `ArrowDown`/`ArrowUp`, selects on `Enter` when index is valid, resets `searchQuery`/`onlyFree` on close, and renders a custom-model fallback button only when `filteredOptions.length === 0 && searchQuery.trim()`.

## Side Effects
- `[SettingSelect.tsx:SettingSelect]` Updates `highlightedIndex` in `useEffect`, scrolls the active child option via `optionEl.scrollIntoView({ block: "nearest" })`, schedules a 50 ms `setTimeout` (with `clearTimeout` cleanup) to focus `searchInputRef.current`, attaches/removes global `document` `"mousedown"` and `"keydown"` listeners while `isOpen` is true, and calls `onChange(...)`.
- `[ModelSelector.tsx:ModelSelector]` Invokes `onRefresh`, `onTestConnection`, and `onChange` callbacks from UI interactions.

## Verification
- Run: `bun test`
