# Log Table Utils

## Overview
Pure helper utilities for text highlight rendering, DOM text-selection coordinate/metadata extraction, and Tailwind class styling for log rows and cluster badges.

## Interface
- `[highlightUtils.tsx:getHighlightedElements]` — Splits text on case-insensitive escaped highlight terms and wraps matching segments in `<mark>` elements.
- `[selectionUtils.ts:SelectionDetails]` — Interface `{ text: string; x: number; y: number; field: string; logText: string; sourceId: string }`.
- `[selectionUtils.ts:findFieldAndSource]` — Walks DOM ancestors from `anchorNode` to resolve `dataset.field` and `dataset.sourceId`.
- `[selectionUtils.ts:getSelectionDetails]` — Extracts trimmed text, scroll-adjusted popover coordinates, ancestor field/source metadata, and `parentElement.innerText` from a `Selection`.
- `[styleUtils.ts:getRowLevelStyles]` — Maps `LogLevel` to row Tailwind CSS classes.
- `[styleUtils.ts:getClusterStyles]` — Maps `clusterId` and optional `anomalousClusters` set to badge Tailwind CSS classes.

## Invariants
- `[highlightUtils.tsx:getHighlightedElements]` Escapes regex metacharacters in truthy `HighlightEntry.term` values, returns `<>{text}</>` unmodified when `text` or active terms are empty, matches parts case-insensitively, and keys matches by character offset `startPos`.
- `[selectionUtils.ts:findFieldAndSource]` Defaults `field` to `"raw_text"` and `sourceId` to `""`, walking up `parentNode` until `null` or `Node.DOCUMENT_NODE` or until both `field !== "raw_text"` and `Boolean(sourceId)` are resolved.
- `[selectionUtils.ts:getSelectionDetails]` Returns `null` when `selection.isCollapsed` or trimmed text is empty; computes `x = rect.left + rect.width / 2` and `y = rect.bottom + globalThis.scrollY + 10` from `selection.getRangeAt(0)`.
- `[styleUtils.ts:getRowLevelStyles]` Maps `FATAL`/`CRITICAL`/`ERROR`, `WARN`, `INFO`, `DEBUG`, and `TRACE`/`VERBOSE` to level-specific classes and falls back to `"hover:bg-bg-hover"`.
- `[styleUtils.ts:getClusterStyles]` Enforces strict precedence: `clusterId === "unknown"` first, then `anomalousClusters?.has(clusterId)`, then default primary styling.

## Side Effects
- None

## Verification
- Run: `bun test`
