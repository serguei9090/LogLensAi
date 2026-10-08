# 🏗️ Refactoring Plan: VirtualLogTable.tsx (1,411 lines)

## 📌 Executive Summary
`src/components/organisms/VirtualLogTable.tsx` currently contains **1,500 lines of code** with tangled concerns:
1. Virtualization logic, scrolling observers & infinite scroll fetching.
2. Ingestion & hydration state overlays (Queued, Preparing, Hydrating, Empty State with GridPattern).
3. Text selection toolbar & AI facet generation via portal.
4. Row annotation / sticky note bottom editor drawer.
5. Column resizing calculations & header rendering.
6. Table rows & individual cell renderers (`ClusterCell`, `ActionsCell`, `CustomFacetCell`, `LogTableCell`, `LogTableRow`).
7. Text highlighting algorithms (`getHighlightedElements`) & selection coordinate detection.

---

## 🎯 Target Architecture

We will modularize this into a dedicated organism directory adhering to the **Anti-Monolith Standard**:

```text
src/components/organisms/log-table/
├── index.ts                         # Backward-compatible barrel export
├── VirtualLogTable.tsx              # Coordinator shell (<280 lines): table container, virtualizer hook, selection state
├── components/
│   ├── TableHeader.tsx              # Column headers, sorting icons & resize drag handles (<140 lines)
│   ├── LogTableRow.tsx              # Memoized virtual table row with level styling & selection (<100 lines)
│   ├── LogTableCells.tsx            # Specialized cell renderers (ClusterCell, ActionsCell, CustomFacetCell) (<160 lines)
│   ├── TableOverlays.tsx            # Ingestion, Queued, Hydrating, Indexing, and Empty state screens (<200 lines)
│   ├── AnnotationDrawer.tsx         # Sticky bottom log entry annotation & note editor (<110 lines)
│   └── SelectionToolbar.tsx         # Floating text selection portal (Include/Exclude/AI Facet/Map Field) (<90 lines)
└── utils/
    ├── highlightUtils.tsx           # Text highlighting parser (getHighlightedElements) (<60 lines)
    ├── selectionUtils.ts            # DOM coordinate extraction & field matching (<70 lines)
    └── styleUtils.ts                # getRowLevelStyles, getClusterStyles (<50 lines)
```

---

## 🔍 Step-by-Step Execution Plan

### Step 1: Extract Pure Utilities & Helpers (Zero-Risk)
- `styleUtils.ts`: `getRowLevelStyles`, `getClusterStyles`.
- `highlightUtils.tsx`: `getHighlightedElements` (pure text-splitting & highlight matcher).
- `selectionUtils.ts`: `findFieldAndSource`, `getSelectionDetails`.

### Step 2: Extract Subcomponents & Floating Portals
- `SelectionToolbar.tsx`: The floating text selection toolbar rendered into `document.body` via `createPortal`.
- `AnnotationDrawer.tsx`: The sticky bottom annotation drawer (`expandedRow` editor with delete/save note).
- `TableOverlays.tsx`: The `Preparing`, `Hydrating`, `Queued`, `Indexing`, and `Empty` state overlays.

### Step 3: Extract Table Header & Row/Cell Renderers
- `LogTableCells.tsx`: `ClusterCell`, `ActionsCell`, `CustomFacetCell`, and `LogTableCell`.
- `LogTableRow.tsx`: `LogTableRow` (memoized virtual row component with measureElement ref).
- `TableHeader.tsx`: Sticky table header `<thead>` with column resize handlers and sort arrows.

### Step 4: Streamline `VirtualLogTable.tsx` Coordinator Shell
- Assemble all pieces in `VirtualLogTable.tsx`:
  - Maintains `useVirtualizer` setup and scroll state.
  - Manages row selection (Shift+Click, Ctrl+Click range logic) and floating bulk selection bar.
  - Reduced to **~250 lines** (down from 1,500 lines).

### Step 5: Verification & Build
- Create backward-compatible proxy `src/components/organisms/VirtualLogTable.tsx` re-exporting from `./log-table`.
- Run `bun run build` to verify zero type regressions, clean bundling, and functional parity.
- Update [`docs/track/CodeDebt_Monolith_Refactor.md`](file:///i:/01-Master_Code/Apps/LogLensAi/docs/track/CodeDebt_Monolith_Refactor.md).
