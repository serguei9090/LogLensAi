# A2UI Components

## Overview
Leaf React UI card components for rendering AI-generated dashboard interfaces (A2UI) backed by live sidecar log queries.

## Interface
- `[A2UIChartArea.tsx:A2UIChartAreaProps]` — Props interface `{ readonly title: string; readonly query: string; readonly sourceIds?: string[] }`.
- `[A2UIChartArea.tsx:A2UIChartArea]` — Renders a `Card` containing a stacked ECharts log-level histogram (`ERROR`, `WARN`, `INFO`, `DEBUG`) with loading and empty states.
- `[A2UILogTable.tsx:A2UILogTableProps]` — Props interface `{ readonly title: string; readonly query: string; readonly sourceIds?: string[] }`.
- `[A2UILogTable.tsx:A2UILogTable]` — Renders a `Card` displaying up to 5 recent log entries (`timestamp`, `level`, `raw_text`).
- `[A2UIMetricCard.tsx:A2UIMetricCardProps]` — Props interface `{ readonly label: string; readonly query: string; readonly sourceIds?: string[]; readonly color?: string }`.
- `[A2UIMetricCard.tsx:A2UIMetricCard]` — Renders a `Card` displaying a formatted total log count metric (or `...` while loading).

## Invariants
- `[A2UIChartArea.tsx:A2UIChartArea]` Defaults `workspace_id` to `'default'` when `activeWorkspaceId` is falsy, omits `query` when falsy, omits `source_ids` unless `sourceIds` is non-empty, strips parenthesized bucket-resolution suffixes from `title`, and skips polling when `document.visibilityState === 'hidden'`.
- `[A2UILogTable.tsx:A2UILogTable]` Defaults `workspace_id` to `'default'`, omits `source_ids` unless `sourceIds` is non-empty, caps queries at `limit: 5`, guards async updates with an effect-scoped `active` flag, and skips polling when `document.visibilityState === 'hidden'`.
- `[A2UIMetricCard.tsx:A2UIMetricCard]` Defaults `workspace_id` to `'default'`, omits `source_ids` unless `sourceIds` is non-empty, queries with `limit: 1` reading `res.total`, guards async updates with an effect-scoped `active` flag, and skips polling when `document.visibilityState === 'hidden'`.
- `[A2UIMetricCard.tsx:getMetricColor]` Explicit recognized `color` values (`error`/`red`, `warn`/`warning`/`amber`, `info`/`green`, `debug`/`purple`) take precedence over uppercase keyword matching on `${label} ${query}`.

## Side Effects
- `[A2UIChartArea.tsx:A2UIChartArea]` Calls sidecar RPC `get_log_distribution` via `callSidecar` on mount, dependency changes, and every `10000` ms via `setInterval` (cleared on cleanup); logs failures via `console.error`.
- `[A2UILogTable.tsx:A2UILogTable]` Calls sidecar RPC `get_logs` (`limit: 5`) via `callSidecar` on mount, dependency changes, and every `5000` ms via `setInterval` (cleared on cleanup); logs failures via `console.error`.
- `[A2UIMetricCard.tsx:A2UIMetricCard]` Calls sidecar RPC `get_logs` (`limit: 1`) via `callSidecar` on mount, dependency changes, and every `5000` ms via `setInterval` (cleared on cleanup); logs failures via `console.error`.

## Verification
- Run: `bun test`
