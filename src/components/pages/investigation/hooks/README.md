# Investigation Hooks

## Overview
Custom React hooks encapsulating log export workflows (native Tauri save dialog + backend export vs. browser CSV download fallback) and global keyboard/custom-event shortcuts on the Investigation page.

## Interface
- `[useInvestigationExport.ts:useInvestigationExport]` - Exported React hook accepting `UseInvestigationExportOptions` and returning `{ handleExport: () => Promise<void> }`.
- `[useInvestigationShortcuts.ts:useInvestigationShortcuts]` - Exported React hook binding global refresh/clear-filter events and keyboard shortcuts (`Ctrl+f`, `r`, `Escape`).

## Invariants
- `[useInvestigationExport.ts:handleExport]` Returns early without sidecar calls or toasts when `activeWorkspaceId` is falsy; detects fusion sources strictly via `sources.find((s) => s.id === activeSourceId)?.type === "fusion"`.
- `[useInvestigationExport.ts:handleExport]` Switches between Tauri native export (`"__TAURI_INTERNALS__" in globalThis.window`) and Web fallback download; Tauri aborts if save dialog returns falsy and chooses `"json"` only for `.json` paths (defaulting to `"csv"`).
- `[useInvestigationExport.ts:handleExport]` Normalizes empty `searchQuery`, `timeRange.start`, `timeRange.end`, and empty `filters` to `undefined`; Web fallback queries `"get_fused_logs"` or `"get_logs"` with `offset: 0, limit: 100000`, aborts if zero logs return, and formats CSV columns `["id", "timestamp", "level", "message", "cluster_id", "facets"]` with quote escaping (`replace(/"/g, '""')`).
- `[useInvestigationShortcuts.ts:useInvestigationShortcuts]` Subscribes/unsubscribes `"loglens:refresh-logs"` and `"loglens:clear-filters"` on `globalThis`, null-checks `searchRef.current?.focus()` on `Ctrl+f`, and shows `toast.info("Filters cleared")` only on `"loglens:clear-filters"` (not on `Escape`).

## Side Effects
- `[useInvestigationExport.ts:handleExport]` Dynamically imports `@tauri-apps/plugin-dialog` to open a native save dialog, calls `callSidecar` (`"export_logs"`, `"get_fused_logs"`, or `"get_logs"`), emits Sonner toasts (`id: "export"`), creates/revokes a `Blob` object URL and clicks a temporary `<a>` on `document.body` to download `loglens_export_${dateStr}.csv`, and logs failures via `console.error`.
- `[useInvestigationShortcuts.ts:useInvestigationShortcuts]` Registers/removes `globalThis` event listeners, registers shortcuts via `useKeyboardShortcuts`, focuses `searchRef.current`, calls `fetchLogs({ forceFull: true })`, clears query/filter/highlight states, and shows `toast.info("Filters cleared")`.

## Verification
- Run: `bun test`
