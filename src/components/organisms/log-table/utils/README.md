# Log Table Utils

## Overview
Pure utility functions for regex-based log text highlight markup, browser DOM text-selection inspection for context toolbars, and Tailwind row/cluster status styling in `VirtualLogTable`.

## Interface
- `[highlightUtils.tsx:getHighlightedElements]` - Exported function `(text: string, highlights: HighlightEntry[]) => JSX.Element` splitting log text on active highlight terms and wrapping matches in styled `<mark>` tags.
- `[selectionUtils.ts:SelectionDetails]` - Exported interface `{ text: string; x: number; y: number; field: string; logText: string; sourceId: string }`.
- `[selectionUtils.ts:findFieldAndSource]` - Exported function `(anchorNode: Node | null) => { field: string; sourceId: string }` walking ancestor DOM elements for `data-field` and `data-source-id` attributes.
- `[selectionUtils.ts:getSelectionDetails]` - Exported function `(selection: Selection) => SelectionDetails | null` computing floating toolbar anchor coordinates and field/source metadata from a browser `Selection`.
- `[styleUtils.ts:getRowLevelStyles]` - Exported function `(level: LogLevel) => string` mapping log severity levels to row hover/accent classes.
- `[styleUtils.ts:getClusterStyles]` - Exported function `(clusterId: string, anomalousClusters?: Set<string>) => string` mapping cluster IDs to badge styling classes.

## Invariants
- `[highlightUtils.tsx:getHighlightedElements]` Returns `<>{text}</>` immediately when `!highlights`, `highlights.length === 0`, `!text`, or no entry has a truthy `h.term`.
- `[highlightUtils.tsx:getHighlightedElements]` Escapes regex metacharacters in each truthy `h.term`, joins with `"|"` in a case-insensitive global `RegExp`, resolves styling from the first matching entry (`h.term?.toLowerCase() === part.toLowerCase()`), and appends hex alpha suffixes (`25`, `40`, `15`) to `match.color`.
- `[selectionUtils.ts:findFieldAndSource]` Defaults to `field = "raw_text"` and `sourceId = ""`, walks `parentNode` up until `null` or `Node.DOCUMENT_NODE`, inspects only `Node.ELEMENT_NODE` nodes for `dataset.field` and `dataset.sourceId`, and stops early once `field !== "raw_text" && sourceId` are both truthy.
- `[selectionUtils.ts:getSelectionDetails]` Returns `null` when `selection.isCollapsed` or `selection.toString().trim()` is empty; computes `x = rect.left + rect.width / 2` and `y = rect.bottom + globalThis.scrollY + 10` from `selection.getRangeAt(0)` and reads `logText` from `selection.anchorNode?.parentElement?.innerText || ""`.
- `[styleUtils.ts:getRowLevelStyles]` Maps `"FATAL"`, `"CRITICAL"`, `"ERROR"` together, `"TRACE"`, `"VERBOSE"` together, and `"WARN"`, `"INFO"`, `"DEBUG"`, defaulting any unknown value to `"hover:bg-bg-hover"`.
- `[styleUtils.ts:getClusterStyles]` Evaluates `clusterId === "unknown"` before `anomalousClusters?.has(clusterId)`, returning zinc styles for `"unknown"`, orange styles when anomalous, and primary styles otherwise.

## Side Effects
- `None`

## Verification
- Run: `bun test`
