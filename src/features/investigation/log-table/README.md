# Log Table

## Overview
Virtualized investigation log table package integrating `@tanstack/react-virtual`, Zustand store bindings, column resizing and sorting, Shift/Ctrl multi-row selection, text-selection filter/facet creation, auto-tail scrolling, annotation editing, and status overlays.

## Interface
- `[index.ts]` — Re-exports `VirtualLogTable` and `type VirtualLogTableProps`.
- `[VirtualLogTable.tsx:VirtualLogTableProps]` — Readonly props interface (`logs`, `highlights`, `onAddComment`, `onSort`, `onAnalyzeCluster?`, `onOpenParser?`, `sortBy`, `sortOrder`, `anomalousClusters?`, `onImport?`, `activeJob?`, `isTransitioning?`, `fetchMoreLogs?`, `total?`, `isFetching?`).
- `[VirtualLogTable.tsx:VirtualLogTable]` — Primary virtualized log-table container orchestrating rows, headers, overlays, annotation drawer, and bulk/selection toolbars.
- Subdirectories:
  - [components](./components/README.md) — Presentational rows, cells, headers, annotation drawer, selection toolbar, and overlays.
  - [utils](./utils/README.md) — Highlight splitting, DOM text-selection extraction, and row/cluster Tailwind style mappers.

## Invariants
- `[VirtualLogTable.tsx:gridTemplateColumns]` Prepends a fixed `"12px"` leading column, forces `"message"` to `"minmax(200px, 1fr)"`, and defaults other visible columns to `"120px"`.
- `[VirtualLogTable.tsx:handleResizeStart]` Enforces a minimum column width of `50` px via `Math.max(50, startWidth + deltaX)`.
- `[VirtualLogTable.tsx:rowVirtualizer]` Appends one trailing `"loader-row"` item at index `logs.length` when `logs.length < (total ?? 0)` (`estimateSize: 40`, `overscan: 10`).
- `[VirtualLogTable.tsx:VirtualLogTable]` Triggers `fetchMoreLogs()` only when `virtualItems` is non-empty, `!isFetching`, `lastItem.index >= logs.length - 10`, and `logs.length < (total ?? 0)`; auto-scrolls on log growth only when `(activeJob || isTailing) && logs.length > prevLogsLength.current`.
- `[VirtualLogTable.tsx:handleSelectRow]` Shift-click selects an inclusive range between `selectionAnchorId` (or `lastSelectedId`) and the target row in `logs` (merging when `metaKey`/`ctrlKey` is pressed), resetting to `[id]` if the anchor is absent.
- `[VirtualLogTable.tsx:VirtualLogTable]` Enforces mutually exclusive overlay/table rendering (`showPreparing` > `showOverlay` > `showHydrating` > `isEmpty` > table rows), renders the bulk-selection bar only when `selectedLogIds.length > 0 && expandedRow === null && logs.length > 0 && !isTransitioning && !isFetching`, and dismisses `selectionInfo` on outside `mousedown` outside `parentRef.current` and `[role="toolbar"]`.
- `[VirtualLogTable.tsx:handleAddFacet]` Always creates facet entries with `group: 1` and `enabled: true`, escaping regex metacharacters in non-AI mode.

## Side Effects
- `[VirtualLogTable.tsx:handleAddFacet]` Calls sidecar RPC `"generate_facet_regex"` via `callSidecar` in AI mode, persists `facet_extractions` via `useSettingsStore.getState().updateSettings`, emits `sonner` toasts, and clears `globalThis.getSelection()`.
- `[VirtualLogTable.tsx:handleAddFilter]` Generates IDs via `crypto.randomUUID()`, updates `useInvestigationStore.setFilters`, displays a toast, and clears browser selection.
- `[VirtualLogTable.tsx:VirtualLogTable]` Invokes `useAiStore.fetchMapping(activeWorkspace.id)` in `useEffect`; mutates `useInvestigationStore`, `useUIStore` (`setColumnWidth`), and `useAiStore` (`setSidebarOpen(true)`); attaches/cleans up `mouseup`/`mousedown`/`mousemove` DOM listeners; triggers `rowVirtualizer.scrollToIndex` and `fetchMoreLogs`.

## Verification
- Run: `bun test`
