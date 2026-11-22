# Laya Settings Modals

## Overview
Controlled modal dialogs supporting the Laya rule configuration panel for adding or editing classification rules, reading the Laya usage guide, rolling back checkpoints, and committing new checkpoint snapshots.

## Interface
- `[AddEditRuleModal.tsx:AddEditRuleModalProps]` - Exported props interface (`isOpen`, `editingRuleName`, `ruleName`, `ruleType`, `ruleInstructions`, `ruleOptions`, `ruleRubric`, and change/save handlers).
- `[AddEditRuleModal.tsx:AddEditRuleModal]` - Exported React component rendering the add/edit classification rule dialog.
- `[LayaGuideModal.tsx:LayaGuideModalProps]` - Exported props interface (`isOpen`, `onOpenChange`).
- `[LayaGuideModal.tsx:LayaGuideModal]` - Exported React component rendering the Laya architecture and rule-type documentation dialog.
- `[RollbackModal.tsx:RollbackModalProps]` - Exported props interface (`rollbackTargetId`, `onOpenChange`, `onConfirmRollback`).
- `[RollbackModal.tsx:RollbackModal]` - Exported React component rendering the checkpoint rollback confirmation dialog.
- `[SaveCheckpointModal.tsx:SaveCheckpointModalProps]` - Exported props interface (`isOpen`, `checkpointAuthor`, `checkpointDesc`, `onOpenChange`, `onAuthorChange`, `onDescChange`, `onSaveRules`).
- `[SaveCheckpointModal.tsx:SaveCheckpointModal]` - Exported React component rendering the checkpoint commit metadata dialog.

## Invariants
- `[AddEditRuleModal.tsx:AddEditRuleModal]` Controlled by `isOpen` and `onOpenChange`; Cancel invokes `onOpenChange(false)`, while save invokes `onSaveRule` directly without closing the dialog or running internal field validation; renders `ruleOptions` only for `ruleType === "choice"`, `ruleRubric` only for `ruleType === "score"`, neither for `"noul"`, and toggles edit/add labels via `Boolean(editingRuleName)`.
- `[LayaGuideModal.tsx:LayaGuideModal]` Controlled by `isOpen` and `onOpenChange`; Close Guide invokes `onOpenChange(false)`.
- `[RollbackModal.tsx:RollbackModal]` Derives dialog open state exclusively from `Boolean(rollbackTargetId)`; Cancel invokes `onOpenChange(false)`, while Confirm Rollback invokes `onConfirmRollback` without calling `onOpenChange(false)`.
- `[SaveCheckpointModal.tsx:SaveCheckpointModal]` Controlled by `isOpen` and `onOpenChange`; Cancel invokes `onOpenChange(false)`, while Commit & Activate invokes `onSaveRules` without calling `onOpenChange(false)` or validating inputs internally.

## Side Effects
- `None`

## Verification
- Run: `bun test`
