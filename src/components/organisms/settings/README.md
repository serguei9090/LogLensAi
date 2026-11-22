# Settings Panel

## Overview
Main settings orchestrator organism managing section navigation (`ai`, `rag`, `laya`, `drain`, `ingestion`), sidecar settings hydration/persistence, AI connection testing, model discovery, pattern resets, and factory reset flows.

## Interface
- `[index.ts:SettingsPanel]` - Re-exports `SettingsPanel` from `./SettingsPanel`.
- `[index.ts:SectionId]` - Re-exports type `SectionId` from `./SettingsPanel`.
- `[SettingsPanel.tsx:SectionId]` - Exported union type `"ai" | "rag" | "laya" | "drain" | "ingestion"`.
- `[SettingsPanel.tsx:SettingsPanel]` - Exported React component accepting `{ readonly onSave: (settings: AppSettings) => void }`.
- Child contracts: [components](./components/README.md), [sections](./sections/README.md), [utils](./utils/README.md).

## Invariants
- `[SettingsPanel.tsx:SectionId]` `activeSection` is constrained to `"ai" | "rag" | "laya" | "drain" | "ingestion"`, matching the 5 `SECTIONS` tabs and conditional section branches.
- `[SettingsPanel.tsx:SettingsPanel]` Initializes `settings` to `defaultSettings`, `activeSection` to `"ai"`, all dialog/loading/saved flags to `false`, and `availableModels` to `providerModelsCache[settings.ai_provider] ?? []`.
- `[SettingsPanel.tsx:SettingsPanel]` `update(key, value, immediate = true)` always updates local `settings`, while invoking `onSave(newSettings)` and `saved` banner feedback only when `immediate` is truthy.
- `[SettingsPanel.tsx:SettingsPanel]` `fetchModels` aborts when resolved `provider` is empty, caches only non-empty model arrays, and always clears `isFetchingModels` in `finally`; `handleTestConnection` persists and flushes pending settings before `test_ai_connection` and verifies/fetches models only when `res.status === "success"`.
- `[SettingsPanel.tsx:SettingsPanel]` `handleResetPatterns` sends `workspace_id: undefined` when `drain_template_scope === "global"` (otherwise `activeWorkspaceId`) and closes the modal only on success; `handleFactoryReset` clears stores, `localStorage`, and schedules reload only on `factory_reset` success (leaving `isRestarting = true` on catch); `handleResetAll` schedules reload only when `updateSettings(defaultSettings)` succeeds; mount `useEffect` applies `parseRemote` only when `get_settings` returns a truthy object.

## Side Effects
- `[SettingsPanel.tsx:SettingsPanel]` Invokes sidecar RPCs `get_settings`, `list_ai_models`, `test_ai_connection`, `reset_templates`, and `factory_reset`; updates `useSettingsStore`, `useIngestionStore`, `useWorkspaceStore`, and `useInvestigationStore`; clears `localStorage`; schedules `setTimeout` / `globalThis.setTimeout` timers (`saved` reset, `globalThis.location.reload()`); shows Sonner toasts; logs `console.error`; and invokes `onSave`.

## Verification
- Run: `bun test`
