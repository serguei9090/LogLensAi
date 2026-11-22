# Laya

## Overview
Feature package for Laya System 1 decision engine settings, connecting `useLayaStore` and `useWorkspaceStore` to rulebook management tabs (Visual Rules, JSON Editor, Checkpoints, Test Playground), model/hardware acceleration controls, and rule/checkpoint modals.

## Interface
- `[index.ts]` — Re-exports `LayaSettingsPanel` (named and default) along with child components (`LayaHeaderBanner`, `VisualRulesTab`, `JsonEditorTab`, `CheckpointsTab`, `TestPlaygroundTab`) and modals (`AddEditRuleModal`, `SaveCheckpointModal`, `RollbackModal`, `LayaGuideModal`).
- `[LayaSettingsPanel.tsx:LayaSettingsPanel]` — Stateful container managing rulebook JSON editing, visual rule CRUD, checkpoint commit/rollback, model download, and interactive rule evaluation.
- Subdirectories:
  - [components](./components/README.md) — Stateless tab views and status banner (`CheckpointsTab`, `JsonEditorTab`, `LayaHeaderBanner`, `TestPlaygroundTab`, `VisualRulesTab`).
  - [modals](./modals/README.md) — Controlled rule, guide, checkpoint, and rollback dialogs.

## Invariants
- `[LayaSettingsPanel.tsx:LayaSettingsPanel]` `handleSaveJsonRules` requires `jsonText` to parse as a non-null, non-array object before calling `saveRules`; `JsonEditorTab` edits validate live via `JSON.parse` into `jsonError`.
- `[LayaSettingsPanel.tsx:LayaSettingsPanel]` `handleSaveVisualRule` requires non-empty trimmed `ruleName` and `ruleInstructions`; `"choice"` rules require at least one non-empty comma-separated option, `"score"` rules require at least one base-10 integer in `ruleRubric`, and any other `ruleType` stores `"noul"`; renaming a rule (`editingRuleName && editingRuleName !== trimmedName`) removes the old `editingRuleName` key from the cloned questions map.
- `[LayaSettingsPanel.tsx:LayaSettingsPanel]` `handleConfirmRollback` returns early if `rollbackTargetId` is `null`; `handleRunTest` requires non-empty trimmed `testText` before invoking `clearTestResult` and `testRule`.

## Side Effects
- `[LayaSettingsPanel.tsx:LayaSettingsPanel]` Calls `fetchSettings(activeWorkspaceId)` and `fetchCheckpoints(activeWorkspaceId)` on mount / workspace change and syncs local `jsonText` and `jsonError` when `settings.questions` updates.
- `[LayaSettingsPanel.tsx:LayaSettingsPanel]` Invokes `useLayaStore` actions (`updateSettings`, `downloadModel`, `saveRules`, `rollbackCheckpoint`, `clearTestResult`, `testRule`) scoped to `activeWorkspaceId` and displays `sonner` toast notifications.

## Verification
- Run: `bun test`
