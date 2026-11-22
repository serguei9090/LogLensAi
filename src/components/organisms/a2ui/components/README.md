# A2UI Components

## Overview
Domain-specific leaf widgets rendered by the A2UI surface renderer, querying live backend log distributions, recent log rows, and aggregate counts from the Go sidecar over RPC.

## Interface
- `[A2UIChartArea.tsx:A2UIChartAreaProps]` - Exported interface `{ readonly title: string; readonly query: string; readonly sourceIds?: string[] }`.
- `[A2UIChartArea.tsx:A2UIChartArea]` - Exported React component rendering a stacked ECharts log distribution bar chart for `ERROR`, `WARN`, `INFO`, and `DEBUG` buckets.
- `[A2UILogTable.tsx:A2UILogTableProps]` - Exported interface `{ readonly title: string; readonly query: string; readonly sourceIds?: string[] }`.
- `[A2UILogTable.tsx:A2UILogTable]` - Exported React component rendering a compact table of up to 5 recent matching log entries.
- `[A2UIMetricCard.tsx:A2UIMetricCardProps]` - Exported interface `{ readonly label: string; readonly query: string; readonly sourceIds?: string[]; readonly color?: string }`.
- `[A2UIMetricCard.tsx:A2UIMetricCard]` - Exported React component rendering a single live numeric count metric card with severity-aware styling.

## Invariants
- `[A2UIChartArea.tsx:A2UIChartArea]` Async mount guard (`active` flag) prevents `setDistribution`, `setBucketInterval`, and `setLoading` updates after effect cleanup.
- `[A2UIChartArea.tsx:A2UIChartArea]` Normalizes RPC params so `workspace_id` defaults to `"default"` when `activeWorkspaceId` is falsy, `query` becomes `undefined` when falsy, and `source_ids` becomes `undefined` unless `sourceIds` is non-empty; preserves `"auto"` `bucketInterval` unless `res.bucket_interval` is truthy.
- `[A2UIChartArea.tsx:A2UIChartArea]` Strips bucket-duration parentheticals from `title`, fixes stacked series to `ERROR`/`WARN`/`INFO`/`DEBUG` (defaulting counts via `|| 0`), and returns `""` from tooltip `formatter` if `params` is not a non-empty array.
- `[A2UIChartArea.tsx:A2UIChartArea]` Interval polling skips `fetchTimeline` when `document.visibilityState === "hidden"`.
- `[A2UILogTable.tsx:A2UILogTable]` Async mount guard (`active` flag) prevents `setLogs` updates after cleanup; normalizes `workspace_id` (`"default"` fallback) and `source_ids`, fixes `limit: 5`, skips polling when `document.visibilityState === "hidden"`, and renders rows keyed by `log.id` with `log.timestamp.split(" ")[1]` and `--${log.level.toLowerCase()}` styling.
- `[A2UIMetricCard.tsx:A2UIMetricCard]` Async mount guard (`active` flag) prevents `setTotal` updates after cleanup; normalizes `workspace_id` (`"default"` fallback) and `source_ids`, fixes `limit: 1`, skips polling when `document.visibilityState === "hidden"`, and renders `"..."` while `total === null` or `total.toLocaleString()` thereafter.
- `[A2UIMetricCard.tsx:getMetricColor]` Resolves metric text color by checking explicit color tokens (`error`/`red`, `warn`/`warning`/`amber`, `info`/`green`, `debug`/`purple`) before keyword matching `${label} ${query}` (`ERROR`/`FATAL`/`CRITICAL`, `WARN`, `DEBUG`/`TRACE`), defaulting to `"text-primary"`.

## Side Effects
- `[A2UIChartArea.tsx:A2UIChartArea]` Subscribes to `useWorkspaceStore` (`activeWorkspaceId`), calls `callSidecar("get_log_distribution", ...)` on dependency changes and every `10000` ms via `setInterval` (cleared on cleanup), reads `document.visibilityState`, mutates local React state, logs errors with `console.error`, and mounts `<ReactECharts>`.
- `[A2UILogTable.tsx:A2UILogTable]` Subscribes to `useWorkspaceStore` (`activeWorkspaceId`), calls `callSidecar("get_logs", ...)` on dependency changes and every `5000` ms via `setInterval` (cleared on cleanup), reads `document.visibilityState`, mutates `logs` state, and logs errors with `console.error`.
- `[A2UIMetricCard.tsx:A2UIMetricCard]` Subscribes to `useWorkspaceStore` (`activeWorkspaceId`), calls `callSidecar("get_logs", ...)` on dependency changes and every `5000` ms via `setInterval` (cleared on cleanup), reads `document.visibilityState`, mutates `total` state, and logs errors with `console.error`.

## Verification
- Run: `bun test`
