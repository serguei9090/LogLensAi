# Investigation

## Overview
Core log investigation workspace package coordinating `InvestigationPage` state and sidecar ingestion/tailing RPCs, the `InvestigationLayout` shell, `LogToolbar`, `ExplorerView`, `FacetSidebar`, `ColumnManagerSidebar`, `LogDistributionWidget`, template/AI-history modals, and child subpackages (`ai-sidebar`, `components`, `custom-parser`, `hooks`, `import-modal`, `log-table`).

## Interface
- `[index.ts]` — Re-exports `InvestigationPage` (default and named), `LogToolbar`, `VirtualLogTable` (and `type VirtualLogTableProps`), `AIInvestigationSidebar`, `CustomParserModal`, `ImportFeedModal`, `FacetSidebar`, `ColumnManagerSidebar`, `LogDistributionWidget`, `ExplorerView`, `SaveTemplateModal`, `LoadTemplateModal`, `AIHistorySearchModal`, and `InvestigationLayout`.
- `[InvestigationPage.tsx:InvestigationPage]` — Memoized page container (`memo(InvestigationPageImpl)`) orchestrating workspace/investigation stores, ingestion/fetching/export/shortcut hooks, live tailing, source removal, and cluster diagnostics.
- `[InvestigationLayout.tsx:InvestigationLayout]` — Three-pane shell combining `LogToolbar`, `WorkspaceTabs`, lazy `LogDistributionWidget`, left/right sidebars, and main content slot.
- `[ExplorerView.tsx:ExplorerView]` — Grid explorer for folders and log sources with inline rename, folder creation, drag-and-drop, and confirmation-gated deletion.
- `[FacetSidebar.tsx:FacetSidebar]` — Collapsible left sidebar wrapping `FacetList` with facet/level-only filter clearing.
- `[ColumnManagerSidebar.tsx:ColumnManagerSidebar]` — Collapsible sidebar for toggling visibility, `@dnd-kit` reordering, and creating/deleting user custom columns.
- `[LogToolbar.tsx:LogToolbar]` — Sticky top toolbar for search, time-range filtering, LLQL filter/highlight builders, saved view templates, export, tailing, orchestration, and AI sidebar toggle.
- `[LogDistributionWidget.tsx:LogDistributionWidget]` — Interactive ECharts timeline histogram (`get_log_distribution` + `get_anomalies`) with bar-click time zoom.
- `[AIHistorySearchModal.tsx:AIHistorySearchModal]` — Searchable modal for selecting or deleting saved AI investigation sessions.
- `[LoadTemplateModal.tsx:LoadTemplateModal]` — Modal fetching, applying, and deleting saved filter/highlight templates.
- `[SaveTemplateModal.tsx:SaveTemplateModal]` — Modal persisting current filters and highlights as a named template.
- `[ImportFeedModal.tsx]` & `[VirtualLogTable.tsx]` — Thin barrel re-exports from `./import-modal` and `./log-table`.
- Subdirectories:
  - [ai-sidebar](./ai-sidebar/README.md) — Resizable AI assistant sidebar, model selector, and thinking/A2UI message rendering.
  - [components](./components/README.md) — Lazy modal wrappers, sidebar composition, and table/explorer switching area.
  - [custom-parser](./custom-parser/README.md) — Interactive regex/offset mapping modal for timestamp and level extraction.
  - [hooks](./hooks/README.md) — Log export (`useInvestigationExport`) and keyboard/event shortcuts (`useInvestigationShortcuts`).
  - [import-modal](./import-modal/README.md) — Multi-tab ingestion feed modal (`Local`, `SSH`, `Manual`, `Live`).
  - [log-table](./log-table/README.md) — Virtualized log table, cells, selection toolbar, annotation drawer, and status overlays.

## Invariants
- `[InvestigationPage.tsx:InvestigationPageImpl]` Computes `isSourceLoading` from active ingestion/transitioning/retrieving source sets, active jobs (`queued`/`pending`/`processing`), mismatched `loadedSourceId`, or `isFetching && logs.length === 0`; switching `activeWorkspaceId` clears logs/facets and resets `timeRange` to `"All Time"`; live tail polling (`1000` ms) skips when `isFetching` is true; `handleToggleTail` aborts if `activeSourceId` is missing or unmapped; `handleAnalyzeCluster` aborts if no loaded logs match `clusterId`.
- `[InvestigationLayout.tsx:InvestigationLayout]` Renders `WorkspaceTabs` only when `sources?.length > 0 && onSelectSource`; mounts lazy `LogDistributionWidget` only when `showDistribution && workspaceId` are truthy, passing `fusionId={activeSource.path}` (`sourceIds={null}`) for `"fusion"` sources.
- `[ExplorerView.tsx:ExplorerView]` Resolves `currentFolder` recursively via `findFolder(hierarchy, folderId)` (falling back to `"Folder not found"`); inline renames run only when trimmed and changed; `handleConfirmDelete` gates folder/source deletion via `ConfirmationDialog`.
- `[FacetSidebar.tsx:clearFacetFilters]` Clears only filters where `f.field.startsWith("facets.") || f.field === "level"`, preserving other filters.
- `[ColumnManagerSidebar.tsx:ColumnManagerSidebar]` Marks built-in columns (`id`, `timestamp`, `ingest_timestamp`, `level`, `message`, `cluster_id`, `actions`) read-only (`"built-in"`), exposes delete only for `source === "user"` custom columns, enforces `PointerSensor` distance `4`, and reorders `columnOrder` only on valid distinct `active.id !== over.id`.
- `[LogToolbar.tsx:LogToolbar]` Renders `StatusDot` and Import unconditionally while gating source-dependent controls (Export, Orchestrate, Tail, Search, Filters, Templates, AI toggle) on a truthy `activeSourceId` (`tailingSourceIds`, `onSelectSource`, `onRemoveSource`, `onEditFusion`, `onRenameSource` props are unused).
- `[LogDistributionWidget.tsx:LogDistributionWidget]` `fetchDistribution` returns early when `workspaceId` is falsy and guards updates with a `mounted` flag; `getBucketDurationMs` defaults to `3600000` ms; `handleChartClick` zooms only on `params.componentType === "series"`.
- `[LoadTemplateModal.tsx:LoadTemplateModal]`, `[SaveTemplateModal.tsx:SaveTemplateModal]`, `[AIHistorySearchModal.tsx:AIHistorySearchModal]` `LoadTemplateModal` fetches only on `isOpen` and aborts apply on malformed JSON; `SaveTemplateModal` rejects blank `name.trim()`; `AIHistorySearchModal` requires truthy `activeWorkspaceId` for deletion.

## Side Effects
- `[InvestigationPage.tsx:InvestigationPageImpl]` Calls sidecar RPCs `start_tail`, `stop_tail`, and `delete_logs` via `callSidecar`; runs a `1000` ms tail polling `setInterval`; fetches logs/settings and mutates `useInvestigationStore`, `useWorkspaceStore`, `useIngestionStore`, and `useUIStore` (`openDiagnostic`); emits `sonner` toasts and `console.warn`.
- `[InvestigationLayout.tsx:LogDistributionWidget]` Dynamically imports `./LogDistributionWidget` via `React.lazy`.
- `[LogDistributionWidget.tsx:LogDistributionWidget]` Calls sidecar RPCs `get_log_distribution` and `get_anomalies` (and polls every `3000` ms while `isTailing` is true), mutates `useInvestigationStore` (`setTimeRange`, `resetTimeRangeToAllTime`), and logs `console.error`.
- `[LoadTemplateModal.tsx:LoadTemplateModal]` & `[SaveTemplateModal.tsx:SaveTemplateModal]` Call sidecar RPCs `get_templates`, `delete_template`, and `save_template`, emit `sonner` toasts, and log `console.error`.
- `[AIHistorySearchModal.tsx:AIHistorySearchModal]`, `[ColumnManagerSidebar.tsx:ColumnManagerSidebar]`, `[FacetSidebar.tsx:FacetSidebar]`, `[LogToolbar.tsx:LogToolbar]` Mutate `useAiStore`, `useUIStore`, and `useInvestigationStore` and invoke parent callbacks.

## Verification
- Run: `bun test`
