# Orchestrator

## Overview
Orchestration feature module defining shared fusion/template contracts, the `OrchestratorHub` slide-over drawer (clustering control, AI global context, log fusion builder, and temporal offset alignment), the standalone `FusionConfigEngine` panel, and the `TimeShiftModal` offset calculator.

## Interface
- `[index.ts]` — Re-exports `OrchestratorHub` (default and named), `TimeShiftModal`, and `FusionConfigEngine`.
- `[types.ts:FusionSourceConfig]` — Per-source fusion settings (`source_id`, `enabled`, `tz_offset`, `custom_format`, `parser_config`).
- `[types.ts:DiscoveryTemplate]` — Saved parser template contract (`id`, `name`, `config`, `created_at`).
- `[types.ts:OrchestratorView]` — Discriminator union `"picker" | "fusion-form" | "ai-context-form" | "time-alignment-form"`.
- `[types.ts:OrchestratorHubProps]` — Props interface for `OrchestratorHub`.
- `[OrchestratorHub.tsx:OrchestratorHub]` — Portal slide-over drawer coordinating clustering status, AI context, fusion creation/editing, and time alignment.
- `[FusionConfigEngine.tsx:FusionConfigEngine]` — Standalone panel for toggling sources, setting UTC offsets, launching `CustomParserModal`, and deploying fusion config.
- `[TimeShiftModal.tsx:TimeShiftModal]` — Dialog calculating manual relative offsets or sample timestamp deltas in seconds.
- Subdirectories:
  - [components](./components/README.md) — Stateless view panels and header/footer chrome (`AiContextView`, `FusionFormView`, `OrchestratorFooter`, `OrchestratorHeader`, `OrchestratorPickerView`, `StrategyCard`, `TimeAlignmentView`).

## Invariants
- `[FusionConfigEngine.tsx:TIMEZONE_OPTIONS]` Generates 27 integer UTC offsets (`-12` to `+14`); `TimezoneSelect` falls back to `TIMEZONE_OPTIONS[12]` (`UTC +00:00`) and clamps panel width to `>= 148` px (`MIN_DROPDOWN_WIDTH`).
- `[FusionConfigEngine.tsx:FusionConfigEngine]` Merges `get_fusion_config` results onto `availableSources` by `source_id === source.path` (defaults: `enabled: true`, `tz_offset: 0`, `custom_format: null`, `parser_config: null`) and disables save when `isSaving || configs.length === 0`.
- `[OrchestratorHub.tsx:OrchestratorHub]` Returns `null` when `!isOpen` and resets view to `"picker"` and modal source IDs to `null`; switches directly to `"fusion-form"` when `editingFusionId` is set on open, otherwise initializes sources with `enabled: false`.
- `[OrchestratorHub.tsx:deployFusion]` Requires at least 2 enabled sources (`enabledCount < 2` aborts), derives `fusionId` from `editingFusionId ?? \`fusion_${Date.now()}\``, and defaults blank `fusionName` to `"Log Fusion"`.
- `[OrchestratorHub.tsx:applyTemplateToSource]` & `[OrchestratorHub.tsx:OrchestratorHub]` Applies `parser_config` only when `t.id.toString() === templateId`; normalizes whitespace-only AI context to `null` (`tempContext.trim() || null`).
- `[TimeShiftModal.tsx:TimeShiftModal]` Clamps relative days/hours/mins/secs inputs via `Math.max(0, ...)` and clears sample fields on open; `handleApply` in `"sample"` mode normalizes first space to `"T"`, aborts if either `Date` is `NaN`, and computes `Math.floor((d2.getTime() - d1.getTime()) / 1000)`.

## Side Effects
- `[FusionConfigEngine.tsx:TimezoneSelect]` Portals dropdown into `document.body`, attaches/removes a `document` `mousedown` listener, and calls `scrollIntoView`.
- `[FusionConfigEngine.tsx:FusionConfigEngine]` Calls sidecar RPCs `get_fusion_config` and `update_fusion_config` via `callSidecar`, emits `sonner` toasts, logs `console.error`, and calls `onConfigSaved()`.
- `[OrchestratorHub.tsx:OrchestratorHub]` Portals drawer into `document.body` and lazy-loads `CustomParserModal` / `TimeShiftModal`; mutates `useClusteringStore` (`fetchStatus`, `setPaused`) and `useInvestigationStore` (`setShowDistribution`, `setShowAnomalies`, `setWorkspaceGlobalContext`); calls sidecar RPCs `get_fusion_config`, `get_templates`, `get_temporal_offsets`, `update_temporal_offsets`, and `update_fusion_config`; emits `sonner` toasts, logs `console.error`, and invokes `onFusionSaved`, `onClose`, and `onEngineSettingsOpen`.
- `[TimeShiftModal.tsx:handleApply]` Emits `toast.error` / `console.error` on invalid sample timestamps and invokes `onSaved(total)` and `onClose()`.

## Verification
- Run: `bun test`
