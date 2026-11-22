# Dashboard Components

## Overview
Stateless presentational React widgets for the Dashboard overview (AI observation card, top error/noise cluster sections, workspace/source/time filters, header/mode toggle, and per-source activity heatmap), alongside the `AIInsightsStudio` interactive workspace.

## Interface
- `[AIObservationCard.tsx:AIObservationCardProps]` — Props `{ readonly stats: DashboardStats; readonly setMode: (mode: DashboardMode) => void }`.
- `[AIObservationCard.tsx:AIObservationCard]` — Renders the latest AI insight summary with a Deep Dive switch button.
- `[ClustersSections.tsx:ClustersSectionProps]` — Props `{ readonly stats: DashboardStats | null; readonly selectedWorkspaceId: string }`.
- `[ClustersSections.tsx:ErrorClustersSection]` — Renders Top Error Clusters via `ClusterRow` with skeleton and empty states.
- `[ClustersSections.tsx:NoiseClustersSection]` — Renders Top Noise Generators via `ClusterRow` with skeleton and empty states.
- `[DashboardFilters.tsx:DashboardFiltersProps]` — Props interface for workspace, source, time-range, reset, and refresh callbacks.
- `[DashboardFilters.tsx:DashboardFilters]` — Renders workspace/source `Select` controls, `TimeRangePicker`, All Time reset, and manual refresh button.
- `[DashboardHeader.tsx:DashboardHeaderProps]` — Props `{ readonly mode: DashboardMode; readonly loading: boolean; readonly onRefresh: () => void; readonly onModeChange?: (mode: DashboardMode) => void }`.
- `[DashboardHeader.tsx:DashboardHeader]` — Renders dashboard heading and optional `DashboardModeToggle`.
- `[SourceHeatmap.tsx:SourceHeatmapProps]` — Props `{ readonly stats: DashboardStats | null }`.
- `[SourceHeatmap.tsx:SourceHeatmap]` — Renders a 50-column per-source activity heatmap with skeleton and empty states.
- Subdirectories:
  - [AIInsightsStudio](./AIInsightsStudio/README.md) — Interactive AI Insights Studio chat, scope autocomplete, and A2UI renderer surface.

## Invariants
- `[AIObservationCard.tsx:AIObservationCard]` Returns `null` when `!stats.latest_ai_insight`; Deep Dive always triggers `setMode("ai")`.
- `[ClustersSections.tsx:ErrorClustersSection]` & `[ClustersSections.tsx:NoiseClustersSection]` Render 3 `SKELETON_CLUSTERS` rows while `stats === null`, display empty copy (`"No Errors Detected"` / `"No Clusters"`) when empty, and key `ClusterRow` by `c.template`.
- `[DashboardFilters.tsx:DashboardFilters]` Disables source selector when `selectedWorkspaceId === "all"`, propagates `onWorkspaceChange`/`onSourceChange` only for truthy values, and reveals All Time reset only when `timeBounds` exists and `timeRange` differs from `timeBounds`.
- `[DashboardHeader.tsx:DashboardHeader]` Renders `DashboardModeToggle` only when `onModeChange` is truthy (`loading` and `onRefresh` props are unused in the render body).
- `[SourceHeatmap.tsx:SourceHeatmap]` Renders 2x24 skeleton cells when `!stats` and `"Insufficient Source Data"` when empty; slices `sourceData.slice(-50)` per source row, computes intensity as `maxCount > 0 ? d.count / maxCount : 0`, and keys cells by `${d.source_name}-${d.timestamp}`.

## Side Effects
- None

## Verification
- Run: `bun test`
