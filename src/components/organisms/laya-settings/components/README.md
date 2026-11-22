# Laya Settings Components

## Overview
Tab views for the Laya rule engine configuration panel, rendering header enable/guide controls, checkpoint version history, raw JSON rule editing, live classification testing, and visual rule management.

## Interface
- `[CheckpointsTab.tsx:CheckpointsTabProps]` - Exported interface with readonly props `checkpoints`, `activeCheckpointId?`, and `onOpenRollback`.
- `[CheckpointsTab.tsx:CheckpointsTab]` - Exported React component rendering saved Laya checkpoints with rule counts and rollback triggers.
- `[JsonEditorTab.tsx:JsonEditorTabProps]` - Exported interface with readonly props `jsonText`, `jsonError`, and `onJsonChange`.
- `[JsonEditorTab.tsx:JsonEditorTab]` - Exported React component rendering a controlled raw JSON rules editor and validation status banner.
- `[LayaHeaderBanner.tsx:LayaHeaderBannerProps]` - Exported interface with readonly props `isEnabled`, `onToggleEnabled`, and `onOpenGuide`.
- `[LayaHeaderBanner.tsx:LayaHeaderBanner]` - Exported React component rendering the Laya engine header banner, active/disabled switch, and guide launcher.
- `[TestPlaygroundTab.tsx:TestPlaygroundTabProps]` - Exported interface with readonly props `testText`, `selectedQuestionName`, `isTesting`, `testResult`, `questionsList`, `onTestTextChange`, `onQuestionNameChange`, and `onRunTest`.
- `[TestPlaygroundTab.tsx:TestPlaygroundTab]` - Exported React component rendering a live log classification playground with label/score probability breakdowns.
- `[VisualRulesTab.tsx:VisualRulesTabProps]` - Exported interface with readonly props `questionsList`, `onOpenAddRule`, `onOpenEditRule`, and `onDeleteRule`.
- `[VisualRulesTab.tsx:VisualRulesTab]` - Exported React component rendering the visual rule card list with add, edit, and delete actions.

## Invariants
- `[CheckpointsTab.tsx:CheckpointsTab]` All props are `Readonly<CheckpointsTabProps>`; `onOpenRollback(cp.id)` is rendered and clickable only when `cp.id !== activeCheckpointId`; keys rows by `cp.id` and falls back `cp.questions` to `{}` and `cp.description` to `"No description provided"`.
- `[JsonEditorTab.tsx:JsonEditorTab]` All props are `Readonly<JsonEditorTabProps>`; renders controlled textarea from `jsonText` and displays `"Valid JSON"` whenever `jsonError` is falsy without parsing JSON internally.
- `[LayaHeaderBanner.tsx:LayaHeaderBanner]` All props are `Readonly<LayaHeaderBannerProps>`; `"Active"`/`"Disabled"` status text and `Switch` checked state are controlled strictly by `isEnabled`.
- `[TestPlaygroundTab.tsx:TestPlaygroundTab]` All props are `Readonly<TestPlaygroundTabProps>`; disables evaluation button while `isTesting` is true, renders result panel only when `testResult` is truthy, renders `selected_score` only when `testResult.question_type === "score"`, pairs `testResult.labels` with `testResult.probabilities[idx]` (fallback `0`), and formats probabilities/confidence scaled by `100`.
- `[VisualRulesTab.tsx:VisualRulesTab]` All props are `Readonly<VisualRulesTabProps>`; keys rule cards by `q.name` and switches rendering on `q.type` (`"choice"` slices `q.options` to 3 with `+N` overflow, `"score"` displays `q.rubric`, `"noul"` renders `"True / False Probability"`).

## Side Effects
- `None`

## Verification
- Run: `bun test`
