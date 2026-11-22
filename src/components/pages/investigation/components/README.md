# Investigation Components

## Overview
Section composition wrappers for the Investigation page, lazily mounting investigation modals, assembling the left facet/column and right AI sidebars, and switching between the virtualized log table and workspace file explorer.

## Interface
- `[InvestigationModals.tsx:InvestigationModals]` - Exported React component lazily rendering `CustomParserModal`, `ImportFeedModal`, `OrchestratorHub`, and `WorkspaceEngineSettings`.
- `[InvestigationSidebars.tsx:InvestigationLeftSidebar]` - Exported React component rendering `FacetSidebar` and `ColumnManagerSidebar`.
- `[InvestigationSidebars.tsx:InvestigationRightSidebar]` - Exported React component rendering `AIInvestigationSidebar`.
- `[InvestigationTableArea.tsx:InvestigationTableArea]` - Exported React component toggling between `VirtualLogTable` (when a source is active) and `ExplorerView`.

## Invariants
- `[InvestigationModals.tsx:InvestigationModals]` Conditionally mounts each lazy modal inside `<Suspense fallback={null}>` only when its trigger prop is truthy (`activeParserSource`, `isImportOpen`, `isOrchestratorOpen`, `isEngineSettingsOpen`) and coerces `workspaceId` via `activeWorkspaceId ?? ""`.
- `[InvestigationModals.tsx:InvestigationModals]` `CustomParserModal.onSaved` returns early if `!activeWorkspaceId || !activeParserSource` before dispatching `callSidecar`.
- `[InvestigationSidebars.tsx:InvestigationLeftSidebar]` Computes `FacetSidebar` `isLoading` as `isSourceLoading || isFetching || hasActiveJob` and renders `ColumnManagerSidebar` unconditionally.
- `[InvestigationTableArea.tsx:InvestigationTableArea]` Renders `VirtualLogTable` exclusively when `activeSourceId` is truthy, otherwise renders `ExplorerView`.
- `[InvestigationTableArea.tsx:InvestigationTableArea]` Optimistic `onAddComment` snapshots `originalLog` from `logs.find((l) => l.id === id)`, computes `has_comment = comment.trim().length > 0`, and rolls back on RPC rejection only if `originalLog` was found; `ExplorerView` guards `renameSource` on truthy `activeWorkspaceId` while coalescing `activeWorkspaceId ?? ""` for selection/folder creation.

## Side Effects
- `[InvestigationModals.tsx:InvestigationModals]` Declares module-level `React.lazy` imports (`custom-parser`, `ImportFeedModal`, `OrchestratorHub`, `WorkspaceEngineSettings`), calls `callSidecar({ method: "update_source_parser", ... })` on parser save with `toast.success`/`toast.error` and `console.error`, and forwards import callbacks bound to `activeFolderId`.
- `[InvestigationTableArea.tsx:InvestigationTableArea]` Calls `callSidecar({ method: "update_log_comment", ... })` with optimistic store mutation (`updateLog`), rollback on error, and `toast.success`/`toast.error`; delegates folder and source mutations (`updateFolder`, `deleteFolder`, `renameSource`, `handleRemoveSource`) to callbacks.

## Verification
- Run: `bun test`
