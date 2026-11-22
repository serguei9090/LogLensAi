# Dashboard Page

## Overview
Primary Dashboard view combining filter controls, KPI stat tiles, lazy-loaded ECharts distributions, viewport-gated error/noise cluster sections, source-activity heatmaps, and a mode switch into the AI Insights Studio.

## Interface
- `[types.ts:DashboardStats]` - Exported interface describing aggregated workspace/source metrics, cluster lists, time-series points, source heatmaps, latest AI insight, active tailers, and optional time bounds.
- `[DashboardPage.tsx:DashboardPage]` - Exported React page component orchestrating static telemetry views and AI Insights Studio mode.
- `[DashboardPage.tsx:default]` - Default export of `DashboardPage`.
- `[index.ts:default]` - Re-exports `DashboardPage` as default from `./DashboardPage`.
- `[index.ts:DashboardPage]` - Re-exports `DashboardPage` from `./DashboardPage`.
- `[index.ts:DashboardHeader]` - Re-exports `DashboardHeader` from `./components/DashboardHeader`.
- `[index.ts:DashboardFilters]` - Re-exports `DashboardFilters` from `./components/DashboardFilters`.
- `[index.ts:SourceHeatmap]` - Re-exports `SourceHeatmap` from `./components/SourceHeatmap`.
- `[index.ts:AIObservationCard]` - Re-exports `AIObservationCard` from `./components/AIObservationCard`.
- `[index.ts:ErrorClustersSection]` - Re-exports `ErrorClustersSection` from `./components/ClustersSections`.
- `[index.ts:NoiseClustersSection]` - Re-exports `NoiseClustersSection` from `./components/ClustersSections`.
- `[index.ts:AIInsightsStudio]` - Re-exports `AIInsightsStudio` from `./components/AIInsightsStudio`.
- `[index.ts:useDashboardData]` - Re-exports `useDashboardData` from `./hooks/useDashboardData`.
- `[index.ts:DashboardStats]` - Re-exports type `DashboardStats` from `./types`.
- Child contracts: [components](./components/README.md), [hooks](./hooks/README.md).

## Invariants
- `[DashboardPage.tsx:DashboardPage]` Initializes `mode` (`DashboardMode`) to `"static"`; renders `DashboardFilters`, `AIObservationCard`, `StatCard` grid, `DashboardCharts`, cluster sections, and `SourceHeatmap` exclusively when `mode === "static"`, and renders `AIInsightsStudio` exclusively when `mode !== "static"`.
- `[DashboardPage.tsx:DashboardPage]` Derives `sources` from `workspaces.find((w) => w.id === selectedWorkspaceId)?.sources || []`; changing workspace sets `selectedWorkspaceId` (`v || "all"`), resets `selectedSourceId` to `"all"`, and sets `isFirstLoad(true)`.
- `[DashboardPage.tsx:DashboardPage]` Resetting time adopts `{ start: timeBounds.min, end: timeBounds.max, label: "All Time" }` when `timeBounds` exists (else `{ start: "", end: "" }`), while chart zoom sets `{ start, end, label: "Zoomed Range" }`.
- `[DashboardPage.tsx:DashboardPage]` Viewport observers (`useInView` with `{ rootMargin: "200px", triggerOnce: true }`) gate mounting of `ErrorClustersSection`/`NoiseClustersSection` (`patternsInView`) and `SourceHeatmap` (`heatmapInView`), rendering skeleton pulse placeholders until observed.
- `[DashboardPage.tsx:DashboardPage]` Renders `AIObservationCard` only when `stats` is truthy; passes `loading={!stats}` and `"0"` fallbacks to the five `StatCard` tiles; sets Drift trend to `"up"` only when `stats?.new_patterns_count > 0` (`"stable"` otherwise).
- `[types.ts:DashboardStats]` Marks `latest_ai_insight` as `string | null` and `bucket_interval`/`time_bounds` as optional.

## Side Effects
- `[DashboardPage.tsx:DashboardCharts]` Lazily imports `@/components/organisms/DashboardCharts` via `React.lazy` inside `<Suspense>`.
- `[DashboardPage.tsx:DashboardPage]` Subscribes to `useWorkspaceStore` and executes `useInView` and `useDashboardData(workspaces, activeWorkspace)`.

## Verification
- Run: `bun test`
