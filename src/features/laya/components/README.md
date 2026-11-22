# Laya Components

## Overview
Stateless presentational React tab and header components for configuring Laya System 1 decision rules, editing raw rulebook JSON, managing rule checkpoints, and testing rules interactively.

## Interface
- `[CheckpointsTab.tsx:CheckpointsTabProps]` — Readonly props `{ checkpoints, activeCheckpointId?, onOpenRollback }`.
- `[CheckpointsTab.tsx:CheckpointsTab]` — Renders checkpoint version history cards, empty state, active indicator badge, and rollback triggers.
- `[JsonEditorTab.tsx:JsonEditorTabProps]` — Readonly props `{ jsonText, jsonError, onJsonChange }`.
- `[JsonEditorTab.tsx:JsonEditorTab]` — Controlled monospace JSON editor displaying caller-provided validation status.
- `[LayaHeaderBanner.tsx:LayaHeaderBannerProps]` — Readonly props `{ isEnabled, onToggleEnabled, onOpenGuide }`.
- `[LayaHeaderBanner.tsx:LayaHeaderBanner]` — Renders Laya System 1 banner, Guide & Primitives trigger, and enable switch.
- `[TestPlaygroundTab.tsx:TestPlaygroundTabProps]` — Readonly props `{ testText, selectedQuestionName, isTesting, testResult, questionsList, onTestTextChange, onQuestionNameChange, onRunTest }`.
- `[TestPlaygroundTab.tsx:TestPlaygroundTab]` — Renders log sample input, rule selector, evaluation button, and probability distribution readout.
- `[VisualRulesTab.tsx:VisualRulesTabProps]` — Readonly props `{ questionsList, onOpenAddRule, onOpenEditRule, onDeleteRule }`.
- `[VisualRulesTab.tsx:VisualRulesTab]` — Renders decision rule rows with primitive badges and edit/delete triggers.

## Invariants
- `[CheckpointsTab.tsx:CheckpointsTab]` Suppresses the rollback button when `cp.id === activeCheckpointId`, preventing rollback of the active checkpoint, and keys rows by `cp.id`.
- `[JsonEditorTab.tsx:JsonEditorTab]` Performs no internal JSON parsing; displays `"Valid JSON"` whenever `jsonError` is falsy.
- `[LayaHeaderBanner.tsx:LayaHeaderBannerProps]` Declares all component props `readonly` across all five components.
- `[TestPlaygroundTab.tsx:TestPlaygroundTab]` Disables the evaluation button while `isTesting` is `true` and displays expected score only when `testResult.question_type === "score"`.
- `[VisualRulesTab.tsx:VisualRulesTab]` Handles `QuestionType` variants (`"choice"`, `"score"`, `"noul"`), caps inline choice option chips at 3 via `q.options.slice(0, 3)`, and keys rows by `q.name`.

## Side Effects
- None

## Verification
- Run: `bun test`
