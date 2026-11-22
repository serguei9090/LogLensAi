# Dashboard Hooks

## Overview
Data-fetching and synchronization hook for the Dashboard page, managing workspace/source/time-range filter state, initial time-bound discovery, fetch deduplication, and global refresh subscription.

## Interface
- `[useDashboardData.ts:useDashboardData]` - Exported React hook `(workspaces: any[], activeWorkspace: any) => { loading, stats, timeBounds, selectedWorkspaceId, setSelectedWorkspaceId, selectedSourceId, setSelectedSourceId, timeRange, setTimeRange, setIsFirstLoad, fetchStats }`.

## Invariants
- `[useDashboardData.ts:useDashboardData]` Initializes `loading = true`, `stats = null`, `timeBounds = null`, `isFirstLoad = true`, `selectedWorkspaceId = useWorkspaceStore.getState().activeWorkspaceId || "all"`, `selectedSourceId = "all"`, `timeRange = { start: "", end: "" }`, and `lastFetchedParamsRef.current = null`.
- `[useDashboardData.ts:useDashboardData]` Syncs `selectedWorkspaceId` to `activeWorkspace?.id ?? workspaces[0]?.id ?? "all"` whenever `selectedWorkspaceId === "all"` or it is absent from `workspaces`.
- `[useDashboardData.ts:useDashboardData]` Resets `selectedSourceId = "all"`, `timeRange = { start: "", end: "" }`, `timeBounds = null`, and `isFirstLoad = true` whenever a truthy `selectedWorkspaceId` changes.
- `[useDashboardData.ts:syncTimeBounds]` On first load (`isFirstLoad === true`), adopts `res.time_bounds` into `timeBounds` and `{ start: bounds.min, end: bounds.max, label: "All Time" }` when present, pre-caches `lastFetchedParamsRef.current` to prevent a redundant refetch, and sets `isFirstLoad = false`.
- `[useDashboardData.ts:fetchStats]` Skips duplicate `callSidecar` calls when `!force` and `lastFetchedParamsRef.current` matches `{ workspaceId, sourceId, start, end }`; normalizes `"all"` and empty values to `undefined`; always resets `loading = false` in `finally`.

## Side Effects
- `[useDashboardData.ts:useDashboardData]` Reads initial workspace state from `useWorkspaceStore.getState().activeWorkspaceId`.
- `[useDashboardData.ts:useDashboardData]` Executes `useEffect` state synchronization/resets and attaches/detaches a `"loglens:refresh-logs"` event listener on `globalThis` triggering `fetchStats(true)`.
- `[useDashboardData.ts:fetchStats]` Invokes `callSidecar<DashboardStats>({ method: "get_dashboard_stats", params, silent: true })`, mutates `stats`, `loading`, and `lastFetchedParamsRef.current`, and logs failures via `console.error`.

## Verification
- Run: `bun test`
