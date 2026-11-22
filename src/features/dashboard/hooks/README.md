# Dashboard Hooks

## Overview
Provides data-fetching and filter synchronization hooks for the Dashboard feature.

## Interface
- `[useDashboardData.ts:useDashboardData]` — Exported React hook `useDashboardData(workspaces, activeWorkspace)` returning `{ loading, stats, timeBounds, selectedWorkspaceId, setSelectedWorkspaceId, selectedSourceId, setSelectedSourceId, timeRange, setTimeRange, setIsFirstLoad, fetchStats }`.

## Invariants
- `[useDashboardData.ts:useDashboardData]` Initializes `selectedWorkspaceId` from `useWorkspaceStore.getState().activeWorkspaceId || "all"` and syncs it to `activeWorkspace?.id ?? workspaces[0]?.id ?? "all"` when `"all"` or absent from `workspaces`.
- `[useDashboardData.ts:useDashboardData]` Resets `selectedSourceId` (`"all"`), `timeRange` (`{ start: "", end: "" }`), `timeBounds` (`null`), and `isFirstLoad` (`true`) whenever `selectedWorkspaceId` changes to a truthy value.
- `[useDashboardData.ts:fetchStats]` Skips redundant fetches unless `force` is `true` when `lastFetchedParamsRef.current` matches `{ workspaceId: selectedWorkspaceId, sourceId: selectedSourceId, start, end }`; normalizes `"all"` and empty/first-load time bounds to `undefined` while always passing `active_workspace_ids`.
- `[useDashboardData.ts:syncTimeBounds]` On `isFirstLoad`, initializes `timeBounds` and `timeRange` (`"All Time"`) from `res.time_bounds` if present (otherwise `null` / `""`), pre-caches `lastFetchedParamsRef.current`, and flips `isFirstLoad` to `false`.

## Side Effects
- `[useDashboardData.ts:useDashboardData]` Reads Zustand state synchronously from `useWorkspaceStore.getState()`, runs `fetchStats()` on dependency changes, and registers/removes a `"loglens:refresh-logs"` listener on `globalThis` invoking `fetchStats(true)`.
- `[useDashboardData.ts:fetchStats]` Invokes sidecar RPC `"get_dashboard_stats"` (`silent: true`) via `callSidecar`, updates `lastFetchedParamsRef.current` via `syncTimeBounds`, and logs errors via `console.error`.

## Verification
- Run: `bun test`
