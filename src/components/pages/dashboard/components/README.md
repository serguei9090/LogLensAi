# Dashboard Components

## Overview
Visual cards, filter toolbars, error/noise cluster breakdowns, and source-activity heatmaps composing the static and AI modes of the Dashboard page.

## Interface
- `[AIObservationCard.tsx:AIObservationCardProps]` - Exported interface `{ readonly stats: DashboardStats; readonly setMode: (mode: DashboardMode) => void }`.
- `[AIObservationCard.tsx:AIObservationCard]` - Exported React component rendering the latest AI insight summary card and Deep Dive mode-switch button.
- `[ClustersSections.tsx:ClustersSectionProps]` - Exported interface `{ readonly stats: DashboardStats | null; readonly selectedWorkspaceId: string }`.
- `[ClustersSections.tsx:ErrorClustersSection]` - Exported React component rendering top error clusters, loading skeletons, or empty state.
- `[ClustersSections.tsx:NoiseClustersSection]` - Exported React component rendering top noise clusters, loading skeletons, or empty state.
- `[DashboardFilters.tsx:DashboardFiltersProps]` - Exported interface for workspace/source/time-range filter props and refresh callbacks.
- `[DashboardFilters.tsx:DashboardFilters]` - Exported React component rendering workspace selector, log source selector, `TimeRangePicker`, conditional `"All Time"` reset, and refresh controls.
- `[DashboardHeader.tsx:DashboardHeaderProps]` - Exported interface `{ readonly mode: DashboardMode; readonly loading: boolean; readonly onRefresh: () => void; readonly onModeChange?: (mode: DashboardMode) => void }`.
- `[DashboardHeader.tsx:DashboardHeader]` - Exported React component rendering the dashboard mode title, subtitle, and optional `DashboardModeToggle`.
- `[SourceHeatmap.tsx:SourceHeatmapProps]` - Exported interface `{ readonly stats: DashboardStats | null }`.
- `[SourceHeatmap.tsx:SourceHeatmap]` - Exported React component rendering per-source 50-bucket temporal activity heatmaps, skeletons, or empty state.
- Child contract: [AIInsightsStudio](./AIInsightsStudio/README.md).

## Invariants
- `[AIObservationCard.tsx:AIObservationCard]` Returns `null` when `!stats.latest_ai_insight`; Deep Dive button calls `setMode("ai")`.
- `[ClustersSections.tsx:ErrorClustersSection]` Renders 3 `SKELETON_CLUSTERS` rows when `stats === null`, `"No Errors Detected"` when `stats.top_error_clusters.length === 0`, and otherwise renders `ClusterRow` (`type="error"`) keyed by `c.template`.
- `[ClustersSections.tsx:NoiseClustersSection]` Renders 3 `SKELETON_CLUSTERS` rows when `stats === null`, `"No Clusters"` when `stats.top_clusters.length === 0`, and otherwise renders `ClusterRow` (`type="noise"`) keyed by `c.template`.
- `[DashboardFilters.tsx:DashboardFilters]` Disables source `<Select>` when `selectedWorkspaceId === "all"`, always exposes `"all"` (`"Entire Workspace"`), forwards only truthy selector values to `onWorkspaceChange`/`onSourceChange`, and renders `"All Time"` reset only when `timeBounds` exists and `timeRange` differs from `[timeBounds.min, timeBounds.max]`.
- `[DashboardHeader.tsx:DashboardHeader]` Renders `"Dashboard"` copy for `mode === "static"`, `"AI Insights"` with `<Sparkles />` otherwise, and `<DashboardModeToggle>` only when `onModeChange` is passed; `loading` and `onRefresh` props are unused.
- `[SourceHeatmap.tsx:SourceHeatmap]` Renders 2x24 skeleton cells when `!stats` and `"Insufficient Source Data"` when `stats.source_heatmap.length === 0`; deduplicates `source_name` via `Set`, computes `maxCount` across all entries for a source before slicing the last 50 buckets (`sourceData.slice(-50)`), and guards ratio with `maxCount > 0 ? d.count / maxCount : 0`.

## Side Effects
- `None`

## Verification
- Run: `bun test`
