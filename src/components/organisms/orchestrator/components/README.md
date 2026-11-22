# Orchestrator Components

## Overview
Subcomponents for the Orchestrator Hub dialog, providing strategy picker cards, AI workspace context editing, multi-source temporal offset alignment, source fusion form configuration, and shared header/footer chrome.

## Interface
- `[AiContextView.tsx:AiContextView]` - Exported React component rendering the workspace AI global system prompt textarea view.
- `[FusionFormView.tsx:FusionFormView]` - Exported React component rendering per-source parser and template binding controls for multi-source fusion.
- `[OrchestratorFooter.tsx:OrchestratorFooter]` - Exported React component rendering view-specific confirmation and cancellation controls.
- `[OrchestratorHeader.tsx:OrchestratorHeader]` - Exported React component rendering the view title header and close button.
- `[OrchestratorPickerView.tsx:OrchestratorPickerView]` - Exported React component rendering visualization toggles, Drain3 clustering controls, and operation picker cards.
- `[StrategyCard.tsx:StrategyCard]` - Exported React component rendering a clickable strategy selection card.
- `[TimeAlignmentView.tsx:TimeAlignmentView]` - Exported React component rendering per-source clock skew offset controls and sync triggers.

## Invariants
- `[OrchestratorFooter.tsx:OrchestratorFooter]` Returns `null` when `view === "picker"`; otherwise renders Cancel paired with the action for `"ai-context-form"` (`onSaveAiContext`), `"time-alignment-form"` (`onSaveTemporalOffsets`, disabled when `isSaving`), or `"fusion-form"` (`onDeployFusion`, disabled when `isSaving || !canDeployFusion`).
- `[OrchestratorHeader.tsx:VIEW_TITLES]` Maps every `OrchestratorView` (`"picker"`, `"ai-context-form"`, `"time-alignment-form"`, `"fusion-form"`) exhaustively to its dialog header title.
- `[FusionFormView.tsx:FusionFormView]` Replaces the source list with a loading indicator while `isLoadingConfig` is true; resolves source display names via `s.path === config.source_id` with basename fallback; exposes `onOpenParser` only when `config.enabled` is true and the template `<select>` only when `config.enabled && templates.length > 0`.
- `[OrchestratorPickerView.tsx:OrchestratorPickerView]` Sets clustering switch checked state via `!clusteringStatus?.paused` (true when `clusteringStatus` is null or unpaused) and restricts operation cards to `"fusion-form"` and `"time-alignment-form"`.
- `[TimeAlignmentView.tsx:TimeAlignmentView]` Defaults missing source offsets via `temporalOffsets[source.path] ?? 0` and formats offsets as `"0s"`, `"+<n>s"`, or `"<n>s"`.

## Side Effects
- `None`

## Verification
- Run: `bun test`
