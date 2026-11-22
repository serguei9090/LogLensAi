# Log Table Components

## Overview
Structural subcomponents of the virtualized log grid, rendering sticky column headers with sorting/resizing, virtualized rows, severity/cluster/custom-facet cells, an annotation drawer, a floating selection toolbar, and loading/empty-state overlays.

## Interface
- `[AnnotationDrawer.tsx:AnnotationDrawer]` - Exported React component rendering the sticky bottom log note editor and clear action.
- `[LogTableCells.tsx:ClusterCell]` - Exported React component rendering the cluster ID badge and optional `cluster_percent` cell.
- `[LogTableCells.tsx:ActionsCell]` - Exported React component rendering per-row note and AI investigation buttons.
- `[LogTableCells.tsx:CustomFacetCell]` - Exported React component rendering auto-extracted or regex-matched custom facet values.
- `[LogTableCells.tsx:LogTableCellProps]` - Exported TypeScript interface for `LogTableCell` props.
- `[LogTableCells.tsx:LogTableCell]` - Exported React component dispatching column cell rendering across built-in and custom columns.
- `[LogTableRow.tsx:LogTableRowProps]` - Exported TypeScript interface for `LogTableRow` props.
- `[LogTableRow.tsx:LogTableRow]` - Exported `memo` React component rendering a virtualized grid-aligned table row with selection and expansion affordances.
- `[SelectionToolbar.tsx:SelectionToolbar]` - Exported React component rendering a portal-mounted floating action bar over highlighted text.
- `[TableHeader.tsx:TableHeader]` - Exported React component rendering the sticky table header with select-all, column sort toggles, and resize handles.
- `[TableOverlays.tsx:TableOverlays]` - Exported React component rendering ingestion, hydration, indexing, queued, filtered-empty, and workspace-empty states.

## Invariants
- `[AnnotationDrawer.tsx:AnnotationDrawer]` Computes `lineDisplay` as `(currentLog?.line_id ?? -1) + 1 || expandedRow` from `logs.find((l) => l.id === expandedRow)` and shows Delete Note only when `currentLog?.has_comment` is truthy.
- `[LogTableCells.tsx:ClusterCell]` Renders the cluster button and `cluster_percent` (`toFixed(1)%`) only when `log.cluster_id` is truthy (otherwise `"—"`), invoking `onAnalyzeCluster` only when both `log.cluster_id` and `onAnalyzeCluster` are defined.
- `[LogTableCells.tsx:ActionsCell]` Clicking the AI trigger preserves context and calls `setSession(existingSessionId)` when `logSessionMap[log.id]` exists; otherwise resets session (`setSession(null)`), clears selection, sets `setSelectedLogIds([log.id])`, and opens the AI sidebar.
- `[LogTableCells.tsx:CustomFacetCell]` Reads `log.facets?.[custom.id] ?? null` when `custom.source === "auto"`, otherwise applies `new RegExp(custom.regex)` to `log.raw_text ?? log.message` (`null` on regex failure); applies HTTP status colors only for `custom.id === "http_status"`.
- `[LogTableCells.tsx:LogTableCell]` Dispatches strictly on `colId` (`id`, `timestamp`, `ingest_timestamp`, `level`, `message`, `cluster_id`, `actions`) before falling back to `customColumns.find((c) => c.id === colId)` or `null`.
- `[LogTableRow.tsx:LogTableRow]` Prepends a leading selection-indicator `<td>` before `activeVisibleColumns`, positions rows via `translateY(${virtualRow.start}px)` and CSS grid `gridTemplateColumns`, sets `aria-controls` only when `isExpanded` is true, and triggers `onSelect` only on click or `Enter`/`Space`.
- `[SelectionToolbar.tsx:SelectionToolbar]` Positions fixed at `(selectionInfo.x, selectionInfo.y)` with `translateX(-50%)`; Map Field requires both `selectionInfo.sourceId` and `onOpenParser` before opening the parser and clearing browser selection.
- `[TableHeader.tsx:TableHeader]` Computes `isAllSelected` as `totalLogsCount > 0 && selectedLogIds.length === totalLogsCount`, restricts sorting to `["id", "timestamp", "ingest_timestamp", "level", "cluster_id"]`, omits resize handles on `"actions"` and `"message"`, and prepends a select-all `<th>` aligned with `LogTableRow`.
- `[TableOverlays.tsx:TableOverlays]` Evaluates overlays in strict precedence: `showPreparing` -> `showHydrating` -> `showOverlay && !showPreparing && !showHydrating` (checking `activeJob.total_lines > 0` for bar width) -> `isEmpty` -> `null`.

## Side Effects
- `[AnnotationDrawer.tsx:AnnotationDrawer]` Displays Sonner toasts (`toast.success("Note cleared")` / `toast.success("Note saved")`) and calls `onAddComment`, `setCommentText`, and `onClose`.
- `[LogTableCells.tsx:ClusterCell]` Calls `e.stopPropagation()` and invokes `onAnalyzeCluster`.
- `[LogTableCells.tsx:ActionsCell]` Mutates `useAiStore` (`setSession`, `setSidebarOpen(true)`) and `useInvestigationStore` (`clearSelection`, `setSelectedLogIds([log.id])`), calls `e.stopPropagation()`, and invokes `onToggleView`.
- `[LogTableRow.tsx:LogTableRow]` Registers row `<tr>` with `measureElement` ref for `@tanstack/react-virtual`, calls `e.preventDefault()` on `Enter`/`Space`, and calls `onSelect`.
- `[SelectionToolbar.tsx:SelectionToolbar]` Portals into `document.body` via `createPortal`, clears browser selection via `globalThis.getSelection()?.removeAllRanges()`, triggers `toast.info(...)` when source/handler is unavailable, calls `e.preventDefault()` on `onMouseDown`, and invokes filter/facet/parser callbacks.
- `[TableHeader.tsx:TableHeader]` Calls `e.stopPropagation()` on select-all click and invokes `onToggleSelectAll`, `onSort`, and `onResizeStart`.
- `[TableOverlays.tsx:TableOverlays]` Invokes `onClearFilters` and `onImport` callbacks on empty-state actions.

## Verification
- Run: `bun test`
