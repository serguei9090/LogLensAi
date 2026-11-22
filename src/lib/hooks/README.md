# Hooks (`src/lib/hooks`)

## Overview
Custom React hooks and the JSON-RPC 2.0 sidecar transport bridge for the LogLensAi frontend. Encapsulates debouncing, intersection observation, global keyboard shortcuts, system health polling, read-only ingestion status selection, paginated log/facet/anomaly fetching, and Tauri/HTTP sidecar communication. Multi-source ingestion workflows live in the child `./ingestion` package.

## Interface
- `useDebounce<T>(value, delay)` (`[useDebounce.ts:useDebounce]`): Generic React hook returning a value debounced by `delay` milliseconds.
- `useHealthStatus()` (`[useHealthStatus.ts:useHealthStatus]`): Root-level heartbeat hook polling `useHealthStore.fetchHealth` every 30,000 ms (`POLLING_INTERVAL`).
- `useIngestionStatus(workspaceId)` & `IngestionJob` (`[useIngestionStatus.ts:useIngestionStatus]`, `[useIngestionStatus.ts:IngestionJob]`): Read-only selector hook returning `{ activeJob, lastJob, jobs }` for `workspaceId` from `useIngestionStore`.
- `useInView<T>(options?)` (`[useInView.ts:useInView]`): Hook wrapping `IntersectionObserver` and returning `[ref, inView]` with optional `root`, `rootMargin`, `threshold`, and `triggerOnce` (default `true`).
- `useKeyboardShortcuts(shortcuts)` (`[useKeyboardShortcuts.ts:useKeyboardShortcuts]`): Hook binding global `keydown` handlers with modifier matching (`ctrl`, `meta`, `alt`, `shift`).
- `useLogFetching(workspaceId, activeSourceId)` (`[useLogFetching.ts:useLogFetching]`): Hook managing debounced search queries (250 ms), initial source loading (`get_time_boundaries`, `get_anomalies`, `get_logs`/`get_fused_logs`, `get_metadata_facets`), incremental log refreshes, and 1,000-entry pagination (`fetchMoreLogs`).
- `callSidecar<T>(methodOrRequest, params?)`, `setBridgeInitialized(initialized)`, `SIDECAR_BASE_URL`, `SIDECAR_URL`, `SidecarRequest`, `SidecarResponse<T>` (`[useSidecarBridge.ts:callSidecar]`, `[useSidecarBridge.ts:setBridgeInitialized]`, `[useSidecarBridge.ts:SIDECAR_BASE_URL]`, `[useSidecarBridge.ts:SIDECAR_URL]`, `[useSidecarBridge.ts:SidecarRequest]`, `[useSidecarBridge.ts:SidecarResponse]`): JSON-RPC 2.0 transport client dispatching to Tauri `dispatch_sidecar` or HTTP `SIDECAR_URL`.
- Child package: [Ingestion Hooks](./ingestion/README.md) — `useLogIngestion`, `LogIngestionHookResult`, `duplicateLogSource`, `importLiveStream`, `importLocalFile`, `stopTail`, `ingestManualLogs`, and `importSshStream`.

## Invariants
- Read-only ingestion observation: `useIngestionStatus` never initiates polling; polling is started exclusively by explicit ingestion actions (`[useIngestionStatus.ts:useIngestionStatus]`).
- Input-field shortcut protection: `useKeyboardShortcuts` skips single-character shortcuts without `ctrl`, `meta`, or `alt` when focus is inside `INPUT`, `TEXTAREA`, or `contenteditable="true"` elements (`[useKeyboardShortcuts.ts:useKeyboardShortcuts]`).
- macOS modifier mapping: On macOS platforms, `shortcut.ctrl` matches `e.ctrlKey || e.metaKey`, and `shortcut.meta` requires `e.ctrlKey && e.metaKey` (`[useKeyboardShortcuts.ts:useKeyboardShortcuts]`).
- Stale-response & ghost-data prevention: `useLogFetching` clears logs and facets immediately when `workspaceId_activeSourceId` changes, skips duplicate parameter fetches unless tailing/ingesting/`forceFull`/empty, and discards async results when `currentSourceRef !== activeSourceId` (`[useLogFetching.ts:useLogFetching]`).
- Ingestion state ownership: `useLogFetching` intentionally never calls `stopIngestion()` so the page layer controls loading-overlay teardown (`[useLogFetching.ts:useLogFetching]`).
- Pagination guard: `fetchMoreLogs` exits early when `isFetching` is true or `currentLogs.length >= totalLogs` (`[useLogFetching.ts:useLogFetching]`).
- Fusion vs. single-source routing: `useLogFetching` calls `get_fused_logs` with `fusion_id: activeSrc.path` when `activeSrc.type === "fusion"` and `get_logs` with a `source_id` filter otherwise (`[useLogFetching.ts:useLogFetching]`).
- Transport & cold-boot toast gating: `callSidecar` selects HTTP `fetch` when `VITE_APP_MODE === "web"` or `"__TAURI_INTERNALS__" in globalThis` is absent, suppresses connection-error toasts while `silent` or `!isBridgeInitialized`, and sets `isBridgeInitialized = true` upon the first non-error response (`[useSidecarBridge.ts:callSidecar]`, `[useSidecarBridge.ts:isTauriRuntime]`).

## Side Effects
- Timers & polling: `useDebounce` manages `setTimeout` (`[useDebounce.ts:useDebounce]`); `useHealthStatus` triggers an initial `fetchHealth()` and a 30,000 ms `setInterval` (`[useHealthStatus.ts:useHealthStatus]`); `useLogFetching` schedules a 250 ms debounce `setTimeout` (`[useLogFetching.ts:useLogFetching]`).
- Browser observers & listeners: `useInView` registers an `IntersectionObserver` (`[useInView.ts:useInView]`); `useKeyboardShortcuts` attaches and removes a `keydown` listener on `globalThis` (`[useKeyboardShortcuts.ts:useKeyboardShortcuts]`).
- RPC / network / IPC calls: `callSidecar` dynamically imports `@tauri-apps/api/core` to invoke `"dispatch_sidecar"` in Tauri mode or issues HTTP `POST` requests to `SIDECAR_URL` (`[useSidecarBridge.ts:callSidecar]`); `useLogFetching` dispatches `get_logs`, `get_fused_logs`, `get_time_boundaries`, `get_anomalies`, and `get_metadata_facets` (`[useLogFetching.ts:useLogFetching]`).
- Store & module state mutations: `useHealthStatus` updates `useHealthStore` polling state (`[useHealthStatus.ts:useHealthStatus]`); `useLogFetching` updates `useInvestigationStore` (`setLogs`, `setAvailableFacets`, `setTimeRangeBounds`, `setTimeRange`) (`[useLogFetching.ts:useLogFetching]`); `callSidecar` writes debug/error logs to `useDebugStore` and mutates module-level `isBridgeInitialized` (`[useSidecarBridge.ts:callSidecar]`, `[useSidecarBridge.ts:setBridgeInitialized]`).
- UI notifications: `callSidecar` emits `sonner` `toast.error` notifications for non-silent JSON-RPC errors and post-init transport failures (`[useSidecarBridge.ts:callSidecar]`).

## Verification
- Run: `bun test`
