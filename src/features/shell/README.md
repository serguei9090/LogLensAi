# Shell

## Overview
Application shell feature providing the 3-column drag-and-drop workspace frame, collapsible workspace/hierarchy sidebar, searchable command palette, AI diagnostic drawer, sidecar startup health gateway, and debug console overlay.

## Interface
- `[index.ts]` — Re-exports `AppLayout`, `Sidebar`, `DiagnosticSidebar`, `CommandPalette`, `SidecarStartupGateway`, and `SystemDiagnosticConsole`.
- `[AppLayout.tsx:AppLayout]` — Renders the 3-column `@dnd-kit` layout (`Sidebar`, `<main>`, `DiagnosticSidebar`), handles source-to-folder drag-and-drop, and restores active ingestion jobs.
- `[CommandPalette.tsx:CommandPalette]` — Searchable command modal triggering navigation, UI panel toggles, workspace creation, and investigation custom events.
- `[DiagnosticSidebar.tsx:DiagnosticData]` — TypeScript interface for AI diagnostic payloads (`summary`, `root_cause`, `recommended_actions`, plus optional known-issue and match fields).
- `[DiagnosticSidebar.tsx:DiagnosticSidebar]` — Fixed right-side slide-over drawer displaying cluster diagnostics and known-issue resolutions.
- `[SidecarStartupGateway.tsx:SidecarStartupGateway]` — Startup gate polling sidecar `get_health` before mounting children (bypassed in test mode).
- `[Sidebar.tsx:Sidebar]` — Memoized navigation sidebar (`memo(SidebarImpl)`) providing workspace CRUD, `HierarchyTree` rendering, and route switching.
- `[SystemDiagnosticConsole.tsx:SystemDiagnosticConsole]` — Env-gated (`VITE_DEBUG_GUI === "true"`) bottom-right diagnostic log viewer and clipboard exporter.

## Invariants
- `[AppLayout.tsx:CustomPointerSensor]` Suppresses pointer drag activation when `onPointerDown` originates inside `BUTTON`, `INPUT`, `TEXTAREA`, `SELECT`, or `OPTION`.
- `[AppLayout.tsx:POINTER_SENSOR_OPTIONS]` Enforces `activationConstraint.distance` of `10` px; `[AppLayout.tsx:AppLayout]` applies `restrictToWindowEdges`, CSS `contain: "strict"` on `<main>`, skips restoration when `activeWorkspaceId` is falsy, restores only `"queued"`, `"pending"`, or `"processing"` jobs, and parses `sidebar-source-`/`explorer-source-`/`sidebar-folder-`/`explorer-folder-` DnD IDs (`"root"` / `"sidebar-folder-root"` -> `null`).
- `[CommandPalette.tsx:CommandPalette]` Filters commands by case-insensitive substring on `item.label`, executes `filteredGroups[0]?.items[0]` on `Enter`, and resets search on action/close.
- `[DiagnosticSidebar.tsx:DiagnosticSidebar]` Renders match score only when `data.match_score !== undefined && data.match_score > 0`, and memory resolution / matched signature sections only when `data.is_known_issue` is truthy.
- `[SidecarStartupGateway.tsx:SidecarStartupGateway]` Immediately grants readiness in test mode (`window.__LOGLENS_TEST_MODE__`, `localStorage.getItem("LOGLENS_TEST_MODE") === "1"`, or `window.location.search.includes("test=1")`); otherwise retries `get_health` sequentially up to `MAX_PROBES` (`5`) at `PROBE_DELAY_MS` (`1500` ms) intervals, capping `progressPercent` at `100` and requiring truthy `res?.status`.
- `[Sidebar.tsx:SidebarImpl]` Guards `onWorkspaceCreate` and `onWorkspaceRename` on non-empty `.trim()`; enables workspace deletion only when `!sidebarCollapsed && workspaces.length > 1` behind `ConfirmationDialog`; renders `HierarchyTree` only when `activeWorkspaceId === ws.id && !sidebarCollapsed && ws.hierarchy`.
- `[SystemDiagnosticConsole.tsx:SystemDiagnosticConsole]` Returns `null` whenever `import.meta.env.VITE_DEBUG_GUI !== "true"`.

## Side Effects
- `[AppLayout.tsx:AppLayout]` Calls sidecar RPC `"get_ingestion_jobs"` (`silent: true`), mutates `useIngestionStore` (`addOrUpdateJob`, `startIngestion`, `addTransitioningSource`, `removeTransitioningSource`, `startPolling`) and `useWorkspaceStore` (`moveSource`), and logs via `console.log`/`console.error`.
- `[CommandPalette.tsx:CommandPalette]` Mutates `useUIStore`, `useAiStore`, and `useWorkspaceStore` (`addWorkspace`), dispatches `CustomEvent("loglens:refresh-logs")` and `CustomEvent("loglens:clear-filters")` on `globalThis`, and calls `onNavSelect` / `onOpenChange`.
- `[DiagnosticSidebar.tsx:DiagnosticSidebar]` Sets `useAiStore.getState().setSidebarOpen(true)` and invokes `onClose`.
- `[SidecarStartupGateway.tsx:SidecarStartupGateway]` Reads `window.__LOGLENS_TEST_MODE__`, `localStorage`, and `window.location.search`; polls `"get_health"` via `callSidecar`, calls `setBridgeInitialized(true)`, and manages `probeTimerRef` timeouts.
- `[Sidebar.tsx:SidebarImpl]` Triggers `fetchHierarchy`, `setActiveFolder`, `toggleSidebar`, a `50` ms `setTimeout` input focus, and workspace/navigation callbacks.
- `[SystemDiagnosticConsole.tsx:SystemDiagnosticConsole]` Reads `import.meta.env.VITE_DEBUG_GUI`, mutates `useDebugStore` (`clearLogs`, `setOpen`), and copies JSON logs via `navigator.clipboard.writeText`.

## Verification
- Run: `bun test`
