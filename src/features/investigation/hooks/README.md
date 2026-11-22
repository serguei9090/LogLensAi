# Investigation Hooks

## Overview
React hooks encapsulating log export workflows (native Tauri save dialog or browser CSV download) and keyboard/custom-event shortcuts for the Investigation workspace.

## Interface
- `[useInvestigationExport.ts:useInvestigationExport]` — Hook returning `{ handleExport: () => Promise<void> }` for exporting filtered/sorted workspace or fused logs.
- `[useInvestigationShortcuts.ts:useInvestigationShortcuts]` — Hook registering investigation keyboard shortcuts and `globalThis` refresh/clear event listeners.

## Invariants
- `[useInvestigationExport.ts:useInvestigationExport]` `handleExport` returns early without side effects if `activeWorkspaceId` is falsy; detects fusion sources by `type === "fusion"` (passing `activeSource.path` as `fusionId`).
- `[useInvestigationExport.ts:useInvestigationExport]` Selects Tauri native export only when `typeof globalThis.window !== "undefined" && "__TAURI_INTERNALS__" in globalThis.window` (aborting if `save()` returns falsy; resolving `"json"` only for `.json` extension, otherwise `"csv"`); otherwise runs Web fallback (`offset: 0`, `limit: 100000`, CSV headers `["id", "timestamp", "level", "message", "cluster_id", "facets"]`).
- `[useInvestigationExport.ts:useInvestigationExport]` Normalizes empty `query`, empty `filters`, and empty `start_time`/`end_time` to `undefined`; omits `sort_by`/`sort_order` in Tauri `export_logs` while including them in Web `get_fused_logs`/`get_logs`.
- `[useInvestigationShortcuts.ts:useInvestigationShortcuts]` Registers and symmetrically cleans up `"loglens:refresh-logs"` and `"loglens:clear-filters"` listeners; refresh triggers `fetchLogs({ forceFull: true })`, while clear resets `searchQuery` (`""`), `filters` (`[]`), and `highlights` (`[]`).

## Side Effects
- `[useInvestigationExport.ts:useInvestigationExport]` Dynamically imports `@tauri-apps/plugin-dialog` (`save()`) in Tauri mode; invokes sidecar RPCs `export_logs`, `get_fused_logs`, or `get_logs` via `callSidecar`; triggers temporary DOM `<a>` download + `URL.revokeObjectURL` in Web mode; emits `sonner` toasts under id `"export"` and logs errors via `console.error`.
- `[useInvestigationShortcuts.ts:useInvestigationShortcuts]` Attaches/removes `globalThis` custom event listeners, binds `Ctrl+f`, `r`, and `Escape` via `useKeyboardShortcuts`, focuses `searchRef.current`, calls `fetchLogs`/filter setters, and emits `toast.info("Filters cleared")` on `"loglens:clear-filters"`.

## Verification
- Run: `bun test`
