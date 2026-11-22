# Investigation Components

## Overview
View-composition components assembling the Investigation page's lazy-loaded modals, left/right sidebars, and main log table or workspace explorer area.

## Interface
- `[InvestigationModals.tsx:InvestigationModals]` — Renders lazy-loaded `CustomParserModal`, `ImportFeedModal`, `OrchestratorHub`, and `WorkspaceEngineSettings` inside `Suspense` boundaries.
- `[InvestigationSidebars.tsx:InvestigationLeftSidebar]` — Composes `FacetSidebar` and `ColumnManagerSidebar`.
- `[InvestigationSidebars.tsx:InvestigationRightSidebar]` — Composes `AIInvestigationSidebar` and forwards `onEngineSettingsOpen`.
- `[InvestigationTableArea.tsx:InvestigationTableArea]` — Renders `VirtualLogTable` (when `activeSourceId` is truthy) or `ExplorerView` (when falsy).

## Invariants
- `[InvestigationModals.tsx:InvestigationModals]` Each modal mounts only when its guard prop is truthy (`activeParserSource`, `isImportOpen`, `isOrchestratorOpen`, `isEngineSettingsOpen`); `activeWorkspaceId` falls back to `""` when null; `CustomParserModal` `onSaved` returns early without RPC if `activeWorkspaceId` or `activeParserSource` is falsy.
- `[InvestigationSidebars.tsx:InvestigationLeftSidebar]` Computes `FacetSidebar` `isLoading` as `isSourceLoading || isFetching || hasActiveJob`.
- `[InvestigationTableArea.tsx:InvestigationTableArea]` `VirtualLogTable` and `ExplorerView` are mutually exclusive on `Boolean(activeSourceId)`; `onAddComment` computes `has_comment` from `comment.trim().length > 0` and reverts to `originalLog` if found when `update_log_comment` rejects; `onRenameSource` runs only when `activeWorkspaceId` is truthy.

## Side Effects
- `[InvestigationModals.tsx:InvestigationModals]` Dynamically imports `../custom-parser`, `../import-modal`, `@/features/orchestrator/OrchestratorHub`, and `@/features/settings/WorkspaceEngineSettings` when opened; invokes sidecar RPC `update_source_parser` via `callSidecar`, emits `sonner` toasts, logs errors via `console.error`, and invokes parent modal callbacks.
- `[InvestigationTableArea.tsx:InvestigationTableArea]` Optimistically mutates log state via `updateLog`, calls sidecar RPC `update_log_comment` via `callSidecar`, reverts on failure, emits `sonner` toasts, and invokes injected workspace/table callbacks.

## Verification
- Run: `bun test`
