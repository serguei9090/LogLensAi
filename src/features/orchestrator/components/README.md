# Orchestrator Components

## Overview
Stateless presentational React subviews and chrome components for the Orchestrator panel, rendering header/footer shells, the main command picker, AI architecture context editor, log fusion form, and temporal offset alignment controls.

## Interface
- `[AiContextView.tsx:AiContextView]` — Controlled textarea editor for workspace AI architecture context (`tempContext`, `setTempContext`, `onBack`).
- `[FusionFormView.tsx:FusionFormView]` — Log fusion builder for naming fusions, toggling enabled sources, applying saved templates, and opening parser configuration.
- `[OrchestratorFooter.tsx:OrchestratorFooter]` — View-aware footer rendering Cancel and Save/Apply/Deploy buttons.
- `[OrchestratorHeader.tsx:OrchestratorHeader]` — Header bar displaying dynamic view subtitle and close action.
- `[OrchestratorPickerView.tsx:OrchestratorPickerView]` — Command center picker with telemetry switches, Drain3 clustering toggle, AI context/engine triggers, and operation strategy cards.
- `[StrategyCard.tsx:StrategyCard]` — Clickable ghost-button card rendering an icon, title, and description.
- `[TimeAlignmentView.tsx:TimeAlignmentView]` — Per-source temporal offset readout and sync trigger list.

## Invariants
- `[OrchestratorHeader.tsx:VIEW_TITLES]` Typed as `Record<OrchestratorView, string>`, enforcing exhaustive subtitle coverage across `"picker"`, `"ai-context-form"`, `"time-alignment-form"`, and `"fusion-form"`.
- `[OrchestratorFooter.tsx:OrchestratorFooter]` Returns `null` when `view === "picker"`; disables Apply in `"time-alignment-form"` while `isSaving` is `true`; disables Deploy in `"fusion-form"` while `isSaving || !canDeployFusion`.
- `[FusionFormView.tsx:FusionFormView]` Correlates each `FusionSourceConfig` to `LogSource` by `s.path === config.source_id` and hides template selection (`config.enabled && templates.length > 0`) and parser trigger (`config.enabled`) for disabled sources.
- `[OrchestratorPickerView.tsx:OrchestratorPickerView]` Derives active clustering state from `!clusteringStatus?.paused` and routes strategy cards exclusively to `"fusion-form"` or `"time-alignment-form"`.
- `[TimeAlignmentView.tsx:TimeAlignmentView]` Defaults missing `temporalOffsets[source.path]` entries to `0` (`"0s"`, `"+<n>s"`, or `"<n>s"`).

## Side Effects
- None

## Verification
- Run: `bun test`
