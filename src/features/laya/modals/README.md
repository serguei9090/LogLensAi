# Laya Modals

## Overview
Controlled React modal dialogs for creating or editing Laya decision rules, viewing Laya primitive documentation, confirming rule checkpoint rollbacks, and committing new checkpoints.

## Interface
- `[AddEditRuleModal.tsx:AddEditRuleModalProps]` — Readonly props interface for rule form fields (`isOpen`, `editingRuleName`, `ruleName`, `ruleType`, `ruleInstructions`, `ruleOptions`, `ruleRubric`) and change/save callbacks.
- `[AddEditRuleModal.tsx:AddEditRuleModal]` — Controlled dialog for adding or editing a `choice`, `score`, or `noul` decision rule.
- `[LayaGuideModal.tsx:LayaGuideModalProps]` — Readonly props `{ isOpen, onOpenChange }`.
- `[LayaGuideModal.tsx:LayaGuideModal]` — Informational reference dialog detailing Laya System 1 cluster tagging and the Choice, Score, and Noul primitives.
- `[RollbackModal.tsx:RollbackModalProps]` — Readonly props `{ rollbackTargetId, onOpenChange, onConfirmRollback }`.
- `[RollbackModal.tsx:RollbackModal]` — Controlled rollback confirmation dialog displaying `rollbackTargetId`.
- `[SaveCheckpointModal.tsx:SaveCheckpointModalProps]` — Readonly props `{ isOpen, checkpointAuthor, checkpointDesc, onOpenChange, onAuthorChange, onDescChange, onSaveRules }`.
- `[SaveCheckpointModal.tsx:SaveCheckpointModal]` — Controlled dialog capturing checkpoint author and change description before invoking `onSaveRules`.

## Invariants
- `[AddEditRuleModal.tsx:AddEditRuleModal]` Switches header/description/submit labels based on `Boolean(editingRuleName)`; renders comma-separated options input only when `ruleType === "choice"` and rubric scale input only when `ruleType === "score"`.
- `[RollbackModal.tsx:RollbackModal]` Derives dialog open state directly from `Boolean(rollbackTargetId)`.

## Side Effects
- None

## Verification
- Run: `bun test`
