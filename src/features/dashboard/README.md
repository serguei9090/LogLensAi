# Dashboard

## Overview
Top-level dashboard feature package exposing the `DashboardStats` contract, barrel exports, the interactive ECharts stacked severity bar chart (`DashboardCharts`), and `DashboardPage` which switches between static telemetry analytics and `AIInsightsStudio`.

## Interface
- `[types.ts:DashboardStats]` — Interface defining backend dashboard metrics, severity counts, cluster lists, `time_series`, `source_heatmap`, `latest_ai_insight`, `bucket_interval`, and `time_bounds`.
- `[index.ts]` — Re-exports `DashboardPage` (named and default), `DashboardCharts`, `A2UIRenderer` and `type A2UIRendererProps`, all symbols from `./types` (`DashboardStats`), and all exports from `./hooks/useDashboardData` (`useDashboardData`).
- `[DashboardCharts.tsx:DashboardCharts]` — ECharts stacked `DEBUG`/`INFO`/`WARN`/`ERROR` histogram with legend totals, skeleton/empty states, and brush/click time-range zoom.
- `[DashboardPage.tsx:DashboardPage]` — Named and default page component assembling header, filters, `AIObservationCard`, 5 `StatCard` tiles, lazy `DashboardCharts`, viewport-deferred cluster sections and `SourceHeatmap`, and `AIInsightsStudio`.
- Subdirectories:
  - [a2ui](./a2ui/README.md) — A2UI schema, markup parser, recursive renderer, and live sidecar-backed card widgets.
  - [components](./components/README.md) — Static dashboard UI sections and the `AIInsightsStudio` interactive chat surface.
  - [hooks](./hooks/README.md) — `useDashboardData` state/RPC synchronization hook.

## Invariants
- `[DashboardCharts.tsx:DashboardCharts]` Folds lowercase severity keys (`debug`, `info`, `warn`, `error`) and aliases (`WARNING` -> `WARN`; `FATAL`/`CRITICAL` -> `ERROR`) into the four `DISPLAY_LEVELS` buckets; `parseDbDate` splits components into local `Date` instances and `formatToDbString` serializes `"YYYY-MM-DDTHH:mm:ss"`.
- `[DashboardCharts.tsx:addInterval]` Adds the mapped interval duration (defaulting to `3600000` ms) minus `1` ms for inclusive upper bounds; `isFiltered` is `false` when `timeRange` matches `timeBounds` (or is empty without bounds); `handleBrushSelected` orders reversed drag bounds so `start <= end`; x-axis labels omit seconds unless the interval unit starts with `"second"`.
- `[DashboardPage.tsx:DashboardPage]` Changing workspace resets `selectedSourceId` to `"all"` and sets `isFirstLoad` to `true`; resetting time restores `timeBounds` (`"All Time"`) or empty strings; `mode === "static"` renders filters, stats, charts, clusters, and heatmap while non-static mode renders `AIInsightsStudio`; `ErrorClustersSection`, `NoiseClustersSection`, and `SourceHeatmap` defer rendering behind `useInView` (`rootMargin: "200px"`, `triggerOnce: true`).

## Side Effects
- `[DashboardCharts.tsx:DashboardCharts]` Dispatches ECharts `"takeBrush"` (`lineX`, `single`) when `chartData` is non-empty and clears brush `"areas"` when `!isFiltered`.
- `[DashboardPage.tsx:DashboardPage]` Dynamically imports `./DashboardCharts` via `React.lazy`, reads `useWorkspaceStore`, runs `useDashboardData(workspaces, activeWorkspace)`, and attaches `useInView` intersection observers to `patternsRef` and `heatmapRef`.

## Verification
- Run: `bun test`
