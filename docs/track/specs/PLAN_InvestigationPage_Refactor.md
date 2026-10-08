# Refactoring Plan: Decompose `InvestigationPage.tsx` (771 lines)

## 1. Context & Motivation
- **File**: `src/components/pages/InvestigationPage.tsx` (771 lines)
- **Goal**: Decompose into a structured feature module under `src/components/pages/investigation/` adhering to the 300–400 line UI ceiling and Single Responsibility Principle.
- **Verification Gate**: `bun run build` must pass cleanly with 0 errors and 0 type regressions.

---

## 2. Proposed Architecture (`src/components/pages/investigation/`)

```
src/components/pages/investigation/
├── hooks/
│   ├── useInvestigationExport.ts    (~90 lines) - Handles Tauri & Web CSV/JSON log exports
│   └── useInvestigationShortcuts.ts (~45 lines) - Handles keyboard hotkeys and custom window events
├── components/
│   ├── InvestigationSidebars.tsx    (~35 lines) - Wraps FacetSidebar, ColumnManagerSidebar, AIInvestigationSidebar
│   ├── InvestigationTableArea.tsx   (~95 lines) - Switches between VirtualLogTable and ExplorerView
│   └── InvestigationModals.tsx      (~105 lines) - Lazy modal dialogs (CustomParserModal, ImportFeedModal, OrchestratorHub, WorkspaceEngineSettings)
├── InvestigationPage.tsx            (~240 lines) - Slim coordinator shell
└── index.ts                         (~10 lines)  - Barrel export

src/components/pages/InvestigationPage.tsx (~5 lines) - Re-export proxy
```

---

## 3. Component & Hook Responsibilities
1. **`hooks/useInvestigationExport.ts`**:
   - Manages CSV/JSON generation, date stamping, Tauri dialog save vs. Web Blob download fallback, error toasts.
2. **`hooks/useInvestigationShortcuts.ts`**:
   - Registers keyboard shortcuts (`Ctrl+F`, `R`, `Escape`) and custom events (`loglens:refresh-logs`, `loglens:clear-filters`).
3. **`components/InvestigationSidebars.tsx`**:
   - Assembles the left and right panels for `InvestigationLayout`.
4. **`components/InvestigationTableArea.tsx`**:
   - Renders `VirtualLogTable` with annotation and cluster analysis callbacks when `activeSourceId` exists, or `ExplorerView` when browsing folders.
5. **`components/InvestigationModals.tsx`**:
   - Encapsulates the 4 lazy-loaded modal dialogs inside `Suspense` containers.
6. **`InvestigationPage.tsx`**:
   - Manages workspace subscriptions, log fetching coordination, tail toggles, and feeds the pieces into `InvestigationLayout`.

---

## 4. Verification Plan
1. Implement all files in `src/components/pages/investigation/`.
2. Update `src/components/pages/InvestigationPage.tsx` with clean proxy.
3. Run `bun run build`.
4. Update `docs/track/CodeDebt_Monolith_Refactor.md`.
