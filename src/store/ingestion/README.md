# Ingestion Store (`src/store/ingestion`)

## Overview
Modular Zustand store (`useIngestionStore`) managing the import dialog form state, per-source ingestion transition flags, and background job polling across workspaces. Built from three slices (`importSlice.ts`, `trackingSlice.ts`, `pollingSlice.ts`) plus typed contracts (`types.ts`) and sidecar trace logging (`trace.ts`).

## Interface
- `useIngestionStore` (`[index.ts:useIngestionStore]`): Combined Zustand store composed of `createImportSlice`, `createTrackingSlice`, and `createPollingSlice`, re-exporting all modules in this package (`[index.ts]`).
- Contracts (`[types.ts:IngestionJob]`, `[types.ts:WorkspacePollSession]`, `[types.ts:ImportModalState]`, `[types.ts:ImportModalActions]`, `[types.ts:TrackingState]`, `[types.ts:TrackingActions]`, `[types.ts:PollingState]`, `[types.ts:PollingActions]`, `[types.ts:IngestionStore]`): Interfaces defining job payloads, poll sessions, and slice state/actions.
- `initialImportModalState` & `createImportSlice` (`[importSlice.ts:initialImportModalState]`, `[importSlice.ts:createImportSlice]`): Manages modal visibility, processing flag, active tab (`"local" | "ssh" | "manual" | "live"`), form fields, and `resetImportForm`.
- `initialTrackingState` & `createTrackingSlice` (`[trackingSlice.ts:initialTrackingState]`, `[trackingSlice.ts:createTrackingSlice]`): Manages `ingestingSourceIds`, `transitioningSourceIds`, `notifiedJobIds`, `handledJobIds`, and `retrievingSourceIds`.
- `initialPollingState` & `createPollingSlice` (`[pollingSlice.ts:initialPollingState]`, `[pollingSlice.ts:createPollingSlice]`): Provides `fetchJobs`, `startPolling`, `addLiveSource`, `removeLiveSource`, `addOrUpdateJob`, `clearCompletedState`, `clearState`, and `removeJobsForSource`.
- `traceIngestion(message)` (`[trace.ts:traceIngestion]`): Asynchronous trace logger forwarding diagnostic strings to sidecar `log_trace`.

## Invariants
- Module-scoped timer & session guard: Active workspace timers and incrementing `sessionId` tokens reside in module-level `pollSessions` (outside Zustand state), preventing re-renders from timer handles and aborting superseded poll loops when `currentSession.sessionId !== currentSessionId` (`[pollingSlice.ts:pollSessions]`, `[pollingSlice.ts:createPollingSlice]`).
- Adaptive poll interval & auto-termination: `startPolling` polls every `1_000` ms (`POLL_ACTIVE_MS`) while `activeJob` is `"processing"` or `"pending"`, every `3_000` ms (`POLL_LIVE_MS`) otherwise, and stops the workspace timer (setting `isPolling: false` if no workspace timers remain) when `!wsActiveJob && liveSourceCount === 0` (`[pollingSlice.ts:createPollingSlice]`).
- Active-job preservation: `fetchJobs` preserves other workspaces' jobs and active (`"queued"`, `"pending"`, `"processing"`) local jobs missing from the RPC response, while `clearState` drops completed/failed jobs and keeps active jobs and their `ingestingSourceIds` (`[pollingSlice.ts:createPollingSlice]`).
- Non-negative live counter & workspace guard: `removeLiveSource` floors `liveSourceCount` at `0`, and `fetchJobs` returns early on empty `workspaceId` (`[pollingSlice.ts:createPollingSlice]`).
- Deduplicated source & notification tracking: `startIngestion` deduplicates `sourceId` before appending to `ingestingSourceIds` (`[trackingSlice.ts:createTrackingSlice]`); `fetchJobs` and `addOrUpdateJob` track `notifiedJobIds` to fire terminal handling/toasts once per job transition (`[pollingSlice.ts:createPollingSlice]`).

## Side Effects
- Sidecar JSON-RPC calls: `fetchJobs` invokes `get_ingestion_jobs` (`[pollingSlice.ts:createPollingSlice]`) and `traceIngestion` invokes `log_trace` (`[trace.ts:traceIngestion]`).
- Global event wiring: Registers a `loglens:remove-source-jobs` listener on `globalThis` at module load to invoke `removeJobsForSource` (`[index.ts:useIngestionStore]`), and `fetchJobs` dispatches `CustomEvent("loglens:refresh-hierarchy")` and `CustomEvent("loglens:refresh-logs")` on job completion (`[pollingSlice.ts:createPollingSlice]`).
- Timers & cross-store triggers: `startPolling` schedules recursive `setTimeout` ticks and dynamically imports `../clusteringStore` to call `fetchStatus(workspaceId)` (`[pollingSlice.ts:createPollingSlice]`); `fetchJobs` schedules a 300 ms `setTimeout` before clearing `retrievingSourceIds` (`[pollingSlice.ts:createPollingSlice]`).
- Notifications & console logs: Emits `sonner` `toast.error` on failed jobs (`[pollingSlice.ts:createPollingSlice]`) and logs to `console.log`, `console.warn`, and `console.error` (`[pollingSlice.ts:createPollingSlice]`, `[trace.ts:traceIngestion]`).

## Verification
- Run: `bun test`
