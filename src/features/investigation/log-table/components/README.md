# Log Table Components

## Overview
Presentational and interactive React components forming the virtualized investigation log table: sticky resizable/sortable headers, virtualized rows and typed/custom facet cells, an inline row annotation drawer, a portal selection toolbar, and state overlays.

## Interface
- `[AnnotationDrawer.tsx:AnnotationDrawer]` — Sticky bottom editor drawer for viewing, saving, and clearing row annotations.
- `[LogTableCells.tsx:ClusterCell]` — Renders cluster badge (`#id`) and optional cluster percentage.
- `[LogTableCells.tsx:ActionsCell]` — Renders per-row note toggle and AI investigation session buttons.
- `[LogTableCells.tsx:CustomFacetCell]` — Renders auto-extracted facet values or regex-extracted custom column values with HTTP status color coding.
- `[LogTableCells.tsx:LogTableCellProps]` — Props interface for `LogTableCell`.
- `[LogTableCells.tsx:LogTableCell]` — Cell dispatcher switching on `colId` across built-in columns and `customColumns`.
- `[LogTableRow.tsx:LogTableRowProps]` — Props interface for `LogTableRow`.
- `[LogTableRow.tsx:LogTableRow]` — Memoized virtualized `<tr>` row with leading selection indicator, grid column alignment, and `aria-expanded` row-details linkage.
- `[SelectionToolbar.tsx:SelectionToolbar]` — `document.body` portal toolbar anchored to active text selections for filter, facet, and custom-parser actions.
- `[TableHeader.tsx:TableHeader]` — Sticky CSS-grid `<thead>` with select-all control, sortable column buttons, and resize handles.
- `[TableOverlays.tsx:TableOverlays]` — Full-bleed overlays for preparing, hydrating, queued/indexing jobs, filtered-empty, and empty workspace states.

## Invariants
- `[AnnotationDrawer.tsx:AnnotationDrawer]` Computes displayed line number via `(currentLog?.line_id ?? -1) + 1 || expandedRow`, sets container/textarea IDs `row-details-${expandedRow}` and `note-editor-${expandedRow}`, and renders Delete Note only when `currentLog?.has_comment` is truthy.
- `[LogTableCells.tsx:ClusterCell]` Formats `cluster_percent` with `toFixed(1)` only when `log.cluster_id` is truthy and `log.cluster_percent !== undefined`; otherwise renders an em-dash placeholder when `cluster_id` is falsy.
- `[LogTableCells.tsx:CustomFacetCell]` Reads `log.facets?.[custom.id]` when `custom.source === "auto"`; otherwise compiles `new RegExp(custom.regex)` against `log.raw_text ?? log.message` catching errors as `null`; applies HTTP status color thresholds (`>=500`, `>=400`, `>=300`) only when `custom.id === "http_status"`.
- `[LogTableCells.tsx:LogTableCell]` Displays `log.line_id + 1` for `"id"`, falls back to `log.timestamp` when `log.ingest_timestamp` is falsy, resolves unrecognized `colId` against `customColumns`, and returns `null` when unmatched.
- `[LogTableRow.tsx:LogTableRow]` Positions rows via CSS grid (`gridTemplateColumns`) and `translateY(${virtualRow.start}px)`, prepends a selection-indicator `<td>`, and binds `aria-expanded={isExpanded}` and `aria-controls={isExpanded ? "row-details-" + log.id : undefined}`.
- `[SelectionToolbar.tsx:SelectionToolbar]` Centers horizontally (`translateX(-50%)`) at `(selectionInfo.x, selectionInfo.y)` with `role="toolbar"`; requires both `selectionInfo.sourceId` and `onOpenParser` to open custom parser mapping.
- `[TableHeader.tsx:TableHeader]` Computes `isAllSelected` as `totalLogsCount > 0 && selectedLogIds.length === totalLogsCount`, limits sort controls to `["id", "timestamp", "ingest_timestamp", "level", "cluster_id"]`, and omits resize handles on `"actions"` and `"message"`.
- `[TableOverlays.tsx:TableOverlays]` Enforces overlay priority `showPreparing > showHydrating > (showOverlay && !showPreparing && !showHydrating) > isEmpty (hasActiveFilters before empty workspace) > null`; within `showOverlay`, `isQueued && activeJob` takes precedence and progress width guards `activeJob.total_lines <= 0`.

## Side Effects
- `[AnnotationDrawer.tsx:AnnotationDrawer]` Invokes `onAddComment`, triggers `sonner` toasts (`"Note cleared"` / `"Note saved"`), and invokes `setCommentText` / `onClose`.
- `[LogTableCells.tsx:ClusterCell]` Calls `e.stopPropagation()` and `onAnalyzeCluster(log.cluster_id)`.
- `[LogTableCells.tsx:ActionsCell]` Mutates Zustand stores `useAiStore` (`setSession`, `setSidebarOpen`) and `useInvestigationStore` (`clearSelection`, `setSelectedLogIds`) and invokes `onToggleView(log.id)`.
- `[LogTableRow.tsx:LogTableRow]` Registers `measureElement` ref for `@tanstack/react-virtual` and handles click / `Enter` / `Space` selection callbacks.
- `[SelectionToolbar.tsx:SelectionToolbar]` Portals DOM into `document.body`, calls `e.preventDefault()` on `mousedown`, invokes `onAddFilter` / `onAddFacet` / `onOpenParser` / `onClose`, clears `globalThis.getSelection()?.removeAllRanges()`, or emits `toast.info` when parser context is missing.
- `[TableHeader.tsx:TableHeader]` Invokes `onToggleSelectAll`, `onSort`, and `onResizeStart`.
- `[TableOverlays.tsx:TableOverlays]` Invokes `onClearFilters` and `onImport`.

## Verification
- Run: `bun test`
