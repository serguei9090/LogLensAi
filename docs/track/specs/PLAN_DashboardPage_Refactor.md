# Specification & Plan: Refactoring `src/components/pages/DashboardPage.tsx`

## 1. Problem Statement
`src/components/pages/DashboardPage.tsx` is currently **876 lines long**, exceeding the **300–400 line** component limit. It aggregates multiple independent UI features:
- Filter toolbar & Context Selectors (`DashboardFilters`)
- Source Heatmap visualization (`SourceHeatmap`)
- Data fetching logic (`useDashboardData` hook)
- AI Observation card (`AIObservationCard`)
- Error & Noise cluster rows (`ErrorClustersSection`, `NoiseClustersSection`)
- AI Canvas view & widget rendering (`AICanvasView`, `LazyCanvasWidget`)
- The page layout coordinator (`DashboardPage`)

## 2. Decomposition Target Architecture
We will extract cohesive subcomponents and hooks into a collocated module folder: `src/components/pages/dashboard/`:

```text
src/components/pages/dashboard/
├── types.ts                     (~25 lines)  - DashboardStats interface & data contracts
├── hooks/
│   └── useDashboardData.ts      (~130 lines) - Fetches stats, syncs time bounds & active workspace
├── components/
│   ├── DashboardHeader.tsx      (~30 lines)  - Title, mode badge, and descriptions
│   ├── DashboardFilters.tsx     (~110 lines) - Context workspace/source Select and TimeRangePicker
│   ├── SourceHeatmap.tsx        (~80 lines)  - Heatmap grid rows with skeleton loading
│   ├── AIObservationCard.tsx    (~50 lines)  - DecryptedText AI insight banner + Deep Dive button
│   ├── ClustersSections.tsx     (~110 lines) - ErrorClustersSection and NoiseClustersSection
│   └── AICanvasView.tsx         (~80 lines)  - Canvas grid, LazyCanvasWidget, and sidebar panel
├── DashboardPage.tsx            (~200 lines) - Lightweight coordinator shell
└── index.ts                     (~15 lines)  - Clean exports
```

At `src/components/pages/DashboardPage.tsx`, we will replace the monolith with a clean re-export:
```tsx
export { DashboardPage as default } from "./dashboard";
```
This guarantees 100% backward-compatibility with `src/App.tsx` (`lazy(() => import("@/components/pages/DashboardPage"))`).

## 3. Verification Plan
1. Check that all exports match.
2. Run `bun run build` to verify 0 TypeScript/Vite errors.
3. Update `docs/track/CodeDebt_Monolith_Refactor.md`.
