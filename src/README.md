# Frontend Root (`src`)

## Overview
Root React 19 + TypeScript entry point and application shell bootstrapper for LogLensAi. Initializes global error/debug hooks, mounts the root `<App />` cockpit inside `SidecarStartupGateway`, lazy-loads top-level feature pages (`dashboard`, `investigation`, `settings`), and coordinates global workspaces, keyboard shortcuts, and Tauri debug log listeners.

## Interface
- `[main.tsx]`: Frontend DOM bootstrapper mounting `<StrictMode><App /></StrictMode>` onto `#root` after initializing debug and global error handlers.
- `[App.tsx:NavTab]`: Exported route/tab union type (`"investigation" | "settings" | "dashboard"`).
- `[App.tsx:default]` (`App`): Root React component composing `Toaster`, `SystemDiagnosticConsole`, `SidecarStartupGateway`, and `MainAppShell` (which lazy-loads `DashboardPage`, `InvestigationPage`, and `SettingsPage` inside `AppLayout`).
- `[vite-env.d.ts:ImportMetaEnv]`, `[vite-env.d.ts:ImportMeta]`: Vite `import.meta.env` type augmentations declaring `VITE_APP_MODE?: "web"` and `VITE_SIDECAR_URL?: string`.
- **Subdirectories**:
  - `components`: [./components/README.md](./components/README.md) — UI primitives, shared common components, and Atomic Design compatibility barrels (`atoms`, `common`, `molecules`, `organisms`, `pages`, `templates`, `ui`).
  - `features`: [./features/README.md](./features/README.md) — Domain feature packages (`dashboard`, `investigation`, `laya`, `orchestrator`, `settings`, `shell`).
  - `lib`: [./lib/README.md](./lib/README.md) — Shared utilities, sidecar RPC bridge/hooks (`./lib/hooks/README.md`), and generated API types (`./lib/types/README.md`).
  - `store`: [./store/README.md](./store/README.md) — Zustand state management stores and `./store/ingestion/README.md`.
  - `types`: [./types/README.md](./types/README.md) — Hand-authored domain TypeScript types (`LogEntry`, `LogLevel`, Laya types).

## Invariants
- `[main.tsx]`: Calls `initDebugInterceptor()` and `initGlobalErrorHandlers()` before calling `createRoot(rootElement).render(...)`, and guards mounting on `if (rootElement)`.
- `[App.tsx:App]`: Renders `MainAppShell` exclusively inside `<SidecarStartupGateway>` so sidecar health initialization gates shell hooks and hierarchy queries.
- `[App.tsx:MainAppShell]`: Uses `seededRef` to seed `{ id: "default-ws", name: "Default Workspace" }` at most once when `workspaces.length === 0` (StrictMode double-invocation safe).
- `[App.tsx:MainAppShell]`: Triggers `fetchHierarchy(activeWorkspaceId)` only when `activeWorkspaceId` is truthy, and renders `DashboardPage`, `InvestigationPage`, or `SettingsPage` exclusively according to `activeNav`.
- `[App.tsx:MainAppShell]`: Attaches the Tauri `"sidecar_log"` listener only when `import.meta.env.VITE_DEBUG_GUI === "true"` and cleans up listeners/timers on unmount.

## Side Effects
- `[main.tsx]`: Mutates global `console`/window handlers via `initDebugInterceptor()` and `initGlobalErrorHandlers()`, imports `./styles/globals.css`, and mounts React onto `#root`.
- `[App.tsx:MainAppShell]`: Starts global health polling (`useHealthStatus()`), fetches remote settings (`fetchSettings()`), mutates `useWorkspaceStore` (`addWorkspace`, `fetchHierarchy`), registers global `resize` and keyboard shortcut listeners, toggles `document.body.classList` (`"is-resizing"` with a `150`ms timer), and dynamically imports `@tauri-apps/api/event` to listen to `"sidecar_log"` into `useDebugStore`.

## Verification
- Run: `bun test`
