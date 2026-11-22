# Orchestrator Hub

## Overview
Portal drawer modal coordinating workspace-level log analysis workflows: Drain3 clustering toggle, visualization preferences, workspace AI system prompt configuration, multi-source clock-skew alignment, and multi-source fusion stream deployment.

## Interface
- `[types.ts:FusionSourceConfig]` - Exported interface `{ source_id: string; enabled: boolean; tz_offset: number; custom_format: string | null; parser_config: string | null }`.
- `[types.ts:DiscoveryTemplate]` - Exported interface `{ id: number; name: string; config: string; created_at: string }`.
- `[types.ts:OrchestratorView]` - Exported union `"picker" | "fusion-form" | "ai-context-form" | "time-alignment-form"`.
- `[types.ts:OrchestratorHubProps]` - Exported readonly props interface controlling modal visibility, workspace ID, available sources, optional fusion edit target, and save callbacks.
- `[index.ts:OrchestratorHub]` - Re-exports `OrchestratorHub` from `./OrchestratorHub`.
- `[index.ts:DiscoveryTemplate]` - Re-exports type `DiscoveryTemplate` from `./types`.
- `[index.ts:FusionSourceConfig]` - Re-exports type `FusionSourceConfig` from `./types`.
- `[index.ts:OrchestratorHubProps]` - Re-exports type `OrchestratorHubProps` from `./types`.
- `[index.ts:OrchestratorView]` - Re-exports type `OrchestratorView` from `./types`.
- `[OrchestratorHub.tsx:OrchestratorHub]` - Exported React component rendering the portal-mounted orchestrator drawer and lazy sub-modals.
- Child contract: [components](./components/README.md).

## Invariants
- `[types.ts:OrchestratorView]` View state is restricted to `"picker" | "fusion-form" | "ai-context-form" | "time-alignment-form"`.
- `[OrchestratorHub.tsx:OrchestratorHub]` When `isOpen` is false, renders `null` (no portal) and resets `view` to `"picker"`, `activeParserSource` to `null`, and `activeTimeShiftSource` to `null` without issuing fetches.
- `[OrchestratorHub.tsx:OrchestratorHub]` When opened with `editingFusionId`, switches to `"fusion-form"`, loads `get_fusion_config` while `isLoadingConfig` is true, and defaults `fusionName` to `editingFusionName ?? ""`; otherwise initializes `configs` from `availableSources` with `enabled: false, tz_offset: 0`.
- `[OrchestratorHub.tsx:OrchestratorHub]` `applyTemplateToSource` aborts cleanly if `templateId` does not match an entry in `templates`; fusion deployment enforces `configs.filter((c) => c.enabled).length >= 2`, uses `editingFusionId ?? \`fusion_${Date.now()}\``, and defaults blank names to `"Log Fusion"`.
- `[OrchestratorHub.tsx:OrchestratorHub]` `saveTemporalOffsets` and `deployFusion` always clear `isSaving` in `finally`; `onSaveAiContext` normalizes blank prompts to `null`; `onToggleClustering` passes `!checked` to `setPaused`; lazy `CustomParserModal` and `TimeShiftModal` mount only when their target source state is set.

## Side Effects
- `[OrchestratorHub.tsx:CustomParserModal]` Lazily imports `../custom-parser` via `React.lazy`.
- `[OrchestratorHub.tsx:TimeShiftModal]` Lazily imports `../TimeShiftModal` via `React.lazy`.
- `[OrchestratorHub.tsx:OrchestratorHub]` Portals into `document.body` via `createPortal` when open; invokes sidecar RPCs `get_fusion_config`, `get_templates`, `get_temporal_offsets`, `update_temporal_offsets`, and `update_fusion_config`; updates `useClusteringStore` and `useInvestigationStore`; shows Sonner toasts; logs `console.error` on save failures; invokes `onFusionSaved`, `onClose`, and `onEngineSettingsOpen`.

## Verification
- Run: `bun test`
