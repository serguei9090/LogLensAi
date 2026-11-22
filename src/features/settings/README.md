# Settings

## Overview
Settings feature package exporting the lazy-loaded `SettingsPage`, the multi-section `SettingsPanel` (`ai`, `rag`, `laya`, `drain`, `ingestion`) with sidecar synchronization and reset/connection workflows, and the `WorkspaceEngineSettings` workspace override dialog.

## Interface
- `[index.ts]` — Re-exports `SettingsPage` (default and named), `SettingsPanel`, `SectionId`, `WorkspaceEngineSettings`, all section components (`./sections/*`), and `SectionLabel`.
- `[SettingsPage.tsx:SettingsPage]` — Wraps lazy-loaded `SettingsPanel` in `Suspense` (`data-testid="settings-loader"`), wiring `useSettingsStore().updateSettings` as `onSave`.
- `[SettingsPanel.tsx:SectionId]` — Union `"ai" | "rag" | "laya" | "drain" | "ingestion"`.
- `[SettingsPanel.tsx:SettingsPanel]` — Main settings shell accepting `{ readonly onSave: (settings: AppSettings) => void }` with section navigation, connection testing, model fetching, and pattern/factory reset dialogs.
- `[WorkspaceEngineSettings.tsx:WorkspaceEngineSettings]` — Modal dialog inspecting and saving workspace-scoped Drain3 and facet extraction overrides (`{ isOpen, onClose, workspaceId }`).
- Subdirectories:
  - [components](./components/README.md) — Form field primitives and `ModelSelector` / `SettingSelect` controls.
  - [sections](./sections/README.md) — Section panels for AI, Drain3, Ingestion, Laya, and RAG settings.
  - [utils](./utils/README.md) — Provider metadata lookups and tolerant settings deserialization (`safeParse`, `parseRemote`).

## Invariants
- `[SettingsPanel.tsx:SECTIONS]` Fixes navigation to the five `SectionId` tabs (default `"ai"`) and initializes local settings to `defaultSettings`; `[SettingsPanel.tsx:update]` mutates local state before conditionally invoking `onSave(newSettings)` when `immediate` is true.
- `[SettingsPanel.tsx:handleResetPatterns]` Passes `workspace_id: undefined` to `reset_templates` when `drain_template_scope === "global"`, otherwise `activeWorkspaceId`.
- `[SettingsPanel.tsx:fetchModels]` & `[SettingsPanel.tsx:handleTestConnection]` `fetchModels` exits early if no provider is active and caches models only when `list_ai_models` returns a non-empty array; `handleTestConnection` calls `onSave(settings)` and awaits `flushPendingSettings()` before calling `test_ai_connection`; remote `get_settings` merges via `parseRemote(remoteSettings, prev)`.
- `[WorkspaceEngineSettings.tsx:handleSave]` Restricts workspace overrides persisted via `updateSettings(overrides, workspaceId)` to `drain_similarity_threshold`, `drain_max_children`, `drain_max_clusters`, `drain_masks`, and `facet_extractions`; `safeParse` falls back from `JSON.parse` to Python literal replacement, coercing invalid arrays to `[]` and numeric Drain defaults to `0.5`, `100`, and `1000`.
- `[WorkspaceEngineSettings.tsx:WorkspaceEngineSettings]` Executes workspace/global fetches and sync effects only when `isOpen` is `true` (and `workspaceId` is truthy for `fetchSettings`).

## Side Effects
- `[SettingsPage.tsx:SettingsPage]` Dynamically imports `./SettingsPanel` via `React.lazy` and persists updates via `useSettingsStore().updateSettings`.
- `[SettingsPanel.tsx:SettingsPanel]` Calls sidecar RPCs `get_settings`, `list_ai_models`, `test_ai_connection`, `reset_templates`, and `factory_reset` via `callSidecar`; schedules `setTimeout` timers for saved badge reset (`2000` ms) and page reloads (`1000` ms on reset-all, `1500` ms on factory-reset); clears `useIngestionStore`, `useWorkspaceStore`, `useInvestigationStore`, and `localStorage.clear()` on factory reset; mutates `useSettingsStore` (`updateSettings`, `flushPendingSettings`, `setProviderCachedModels`, `markProviderVerified`); emits `sonner` toasts and logs `console.error`.
- `[WorkspaceEngineSettings.tsx:WorkspaceEngineSettings]` Calls `fetchSettings`, `updateSettings`, sidecar RPCs `get_settings` and `reset_workspace_settings`, emits `sonner` toasts, logs `console.debug`/`console.error`, and invokes `onClose()`.

## Verification
- Run: `bun test`
