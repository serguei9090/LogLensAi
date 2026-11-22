# Laya Settings Panel

## Overview
Feature panel for configuring the Laya local classification engine, supporting hardware device selection, model weight downloading, visual/JSON rule authoring, checkpoint commits and rollbacks, and an interactive classification playground.

## Interface
- `[index.ts:LayaSettingsPanel]` - Re-exports `LayaSettingsPanel` from `./LayaSettingsPanel`.
- `[index.ts:LayaHeaderBanner]` - Re-exports `LayaHeaderBanner` from `./components/LayaHeaderBanner`.
- `[index.ts:HardwareAcceleration]` - Re-exports `HardwareAcceleration` from `@/components/molecules/HardwareAcceleration`.
- `[index.ts:ModelWeightsStatus]` - Re-exports `ModelWeightsStatus` from `@/components/molecules/ModelWeightsStatus`.
- `[index.ts:VisualRulesTab]` - Re-exports `VisualRulesTab` from `./components/VisualRulesTab`.
- `[index.ts:JsonEditorTab]` - Re-exports `JsonEditorTab` from `./components/JsonEditorTab`.
- `[index.ts:CheckpointsTab]` - Re-exports `CheckpointsTab` from `./components/CheckpointsTab`.
- `[index.ts:TestPlaygroundTab]` - Re-exports `TestPlaygroundTab` from `./components/TestPlaygroundTab`.
- `[index.ts:AddEditRuleModal]` - Re-exports `AddEditRuleModal` from `./modals/AddEditRuleModal`.
- `[index.ts:SaveCheckpointModal]` - Re-exports `SaveCheckpointModal` from `./modals/SaveCheckpointModal`.
- `[index.ts:RollbackModal]` - Re-exports `RollbackModal` from `./modals/RollbackModal`.
- `[index.ts:LayaGuideModal]` - Re-exports `LayaGuideModal` from `./modals/LayaGuideModal`.
- `[LayaSettingsPanel.tsx:LayaSettingsPanel]` - Exported prop-less React component coordinating Laya store state, tab switching, rule validation, and modal workflows.
- Child contracts: [components](./components/README.md), [modals](./modals/README.md).

## Invariants
- `[LayaSettingsPanel.tsx:LayaSettingsPanel]` Constrains `activeTab` to `"visual" | "json" | "history" | "test"` (default `"visual"`), showing `"Add Rule"` only on `"visual"` and `"Commit"` only on `"json"`.
- `[LayaSettingsPanel.tsx:LayaSettingsPanel]` Syncs `jsonText` from `settings.questions` when truthy; JSON rule saves validate a non-null, non-array object and reset dialog state only after `saveRules` resolves.
- `[LayaSettingsPanel.tsx:LayaSettingsPanel]` Visual rule saving validates non-empty trimmed `ruleName` and `ruleInstructions`, deletes renamed `editingRuleName` keys before writing, enforces type-specific rules (`"choice"` requires non-empty options, `"score"` requires non-NaN integer rubric items, else `"noul"`), and resets form fields only after `saveRules` resolves; `handleConfirmRollback` guards on truthy `rollbackTargetId`; `handleRunTest` aborts on empty `testText.trim()` and calls `clearTestResult()` beforehand (`selectedQuestionName` defaults to `"category"`).

## Side Effects
- `[LayaSettingsPanel.tsx:LayaSettingsPanel]` Fetches settings and checkpoints via `useLayaStore` on mount/workspace changes, dispatches `updateSettings`, `downloadModel`, `saveRules`, `rollbackCheckpoint`, `clearTestResult`, and `testRule` store actions, and emits Sonner `toast.success`/`toast.info`/`toast.error` notifications.

## Verification
- Run: `bun test`
