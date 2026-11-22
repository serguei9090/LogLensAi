# Virtual Log Table

## Overview
High-throughput virtualized log table organism (`@tanstack/react-virtual`) coordinating resizable/reorderable columns, infinite scroll pagination, live tail auto-scrolling, multi-row range selection, text-selection facet/filter extraction, row annotations, and state overlays.

## Interface
- `[index.ts:VirtualLogTable]` - Re-exports `VirtualLogTable` from `./VirtualLogTable`.
- `[index.ts:VirtualLogTableProps]` - Re-exports type `VirtualLogTableProps` from `./VirtualLogTable`.
- `[VirtualLogTable.tsx:VirtualLogTableProps]` - Exported readonly props interface for log rows, highlights, callbacks (`onAddComment`, `onSort`, `onAnalyzeCluster`, `onOpenParser`, `onImport`, `fetchMoreLogs`), sorting, job status, total count, and fetching flags.
- `[VirtualLogTable.tsx:VirtualLogTable]` - Exported React component orchestrating table virtualization, overlays, annotation drawer, selection bars, and mouse/keyboard interactions.
- Child contracts: [components](./components/README.md), [utils](./utils/README.md).

## Invariants
- `[VirtualLogTable.tsx:VirtualLogTable]` Preserves `columnOrder` filtered by `visibleColumns[colId] ?? false`, prepends a `"12px"` selection gutter in `gridTemplateColumns`, gives `"message"` `"minmax(200px, 1fr)"`, defaults other columns to `"120px"`, and clamps drag resizing to `Math.max(50, startWidth + deltaX)`.
- `[VirtualLogTable.tsx:VirtualLogTable]` Enables pagination loader row (`"loader-row"`) when `logs.length < (total ?? 0)` and invokes `fetchMoreLogs` only when `!isFetching` and `lastItem.index >= logs.length - 10`; auto-scrolls on new logs only when `activeJob || isTailing`.
- `[VirtualLogTable.tsx:VirtualLogTable]` Enforces single-row expansion (`expandedRow`), multi-select Shift+click range anchor resolution (`selectionAnchorId ?? lastSelectedId`), floating action bar exclusivity (`selectedLogIds.length > 0 && expandedRow === null && !isTransitioning && !isFetching`), regex escaping for literal facets, and mutually exclusive overlay states (`showPreparing` -> `showOverlay` -> `showHydrating` -> `isEmpty` -> `<table>`).
- `[VirtualLogTable.tsx:VirtualLogTable]` Invokes `fetchMapping` only when `activeWorkspace?.id` is truthy.

## Side Effects
- `[VirtualLogTable.tsx:VirtualLogTable]` Calls sidecar RPC `generate_facet_regex` (via `toast.promise`) for AI facet extraction; mutates `useInvestigationStore`, `useUIStore`, `useAiStore`, and `useSettingsStore`; registers/cleans `document` `mousemove`/`mouseup`/`mousedown` and `parentRef` `mouseup` listeners; reads and clears `globalThis.getSelection()`; allocates IDs with `crypto.randomUUID()`; drives `rowVirtualizer.scrollToIndex`; emits Sonner toasts; and invokes parent callbacks.

## Verification
- Run: `bun test`
