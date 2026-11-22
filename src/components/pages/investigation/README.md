# Investigation Page

## Overview
Primary log investigation workspace page assembling log fetching, live tail polling, Drain3 clustering status, fusion editing, source management, sidebar layout, keyboard shortcuts, and export flows.

## Interface
- `[index.ts:InvestigationPage]` - Re-exports `InvestigationPage` from `./InvestigationPage`.
- `[index.ts:InvestigationModals]` - Re-exports `InvestigationModals` from `./components/InvestigationModals`.
- `[index.ts:InvestigationLeftSidebar]` - Re-exports `InvestigationLeftSidebar` from `./components/InvestigationSidebars`.
- `[index.ts:InvestigationRightSidebar]` - Re-exports `InvestigationRightSidebar` from `./components/InvestigationSidebars`.
- `[index.ts:InvestigationTableArea]` - Re-exports `InvestigationTableArea` from `./components/InvestigationTableArea`.
- `[index.ts:useInvestigationExport]` - Re-exports `useInvestigationExport` from `./hooks/useInvestigationExport`.
- `[index.ts:useInvestigationShortcuts]` - Re-exports `useInvestigationShortcuts` from `./hooks/useInvestigationShortcuts`.
- `[InvestigationPage.tsx:InvestigationPage]` - Exported `React.memo`-wrapped page component coordinating investigation state, hooks, sidebars, table/explorer area, and modals.
- Child contracts: [components](./components/README.md), [hooks](./hooks/README.md).

## Invariants
- `[InvestigationPage.tsx:InvestigationPageImpl]` Clears logs (`setLogs([], 0)`), facets (`setAvailableFacets({})`), and `timeRange` only when `lastWorkspaceRef.current` is truthy and differs from `activeWorkspaceId`; updates `lastSourceRef.current` only when `activeSourceId` is truthy.
- `[InvestigationPage.tsx:handleOpenImport]` Calls `resetImportForm()` only when `!useIngestionStore.getState().isImportProcessing` before opening the import modal.
- `[InvestigationPage.tsx:activeJobForSource]` Matches jobs strictly with `j.source_id === activeSourceId` and status in `["queued", "pending", "processing"]`; derives `isSourceLoading` from ingestion/transitioning/retrieving sets, active job presence, `loadedSourceId !== activeSourceId`, or `(isFetching && logs.length === 0)`.
- `[InvestigationPage.tsx:InvestigationPageImpl]` Syncs `isTailing` from `tailingSourceIds.has(activeSourceId)`, clears `transitioningSourceIds` entries only after a matching job appears in `jobs`, polls `fetchLogs()` every `1000` ms only when `activeWorkspaceId && activeSourceId && isTailing && !isFetching`, triggers `fetchLogs({ forceFull: true })` only on `activeJobForSource` completion (`true -> false`), excludes `"fusion"` sources from `nonFusionSources`, and gates distribution view on `showDistribution && !!activeSourceId`.
- `[InvestigationPage.tsx:handleToggleTail]` Guards on truthy `activeSourceId` and matching source, updating tailing and live-source state only after `callSidecar` resolves; `handleRemoveSource` stops tailing if active, clears logs/facets only when removing `activeSourceId`, and refreshes logs only when another `activeSourceId` remains.
- `[InvestigationPage.tsx:handleEditFusion]` Aborts if source is missing; `handleFusionSaved` updates existing source matching `s.path === fusionId` or creates and activates a new `"fusion"` source; `handleAnalyzeCluster` warns and skips `openDiagnostic` when zero loaded logs match `clusterId`.

## Side Effects
- `[InvestigationPage.tsx:InvestigationPageImpl]` Invokes hooks `useIngestionStatus`, `useLogFetching`, `useLogIngestion`, `useInvestigationShortcuts`, and `useInvestigationExport`; mutates Zustand stores `useInvestigationStore`, `useIngestionStore`, `useSettingsStore` (`fetchSettings`), `useWorkspaceStore`, and `useUIStore` (`openDiagnostic`); manages a `1000` ms `setInterval` polling timer; executes sidecar RPCs `start_tail`, `stop_tail`, and `delete_logs`; emits Sonner toasts; logs `console.warn` on `delete_logs` failure.

## Verification
- Run: `bun test`
