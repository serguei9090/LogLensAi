# Frontend Library (`src/lib`)

## Overview
Shared frontend utilities for LogLensAi, including Tailwind class composition, drag-and-drop wrapper components, manual log line parsing, diagnostic console interception, and global window error handling. Groups custom React hooks/sidecar transport in `./hooks` and auto-generated API schema types in `./types`.

## Interface
- `initDebugInterceptor()` (`[debug-utils.ts:initDebugInterceptor]`): Wraps `console.{log,warn,error,debug}` and registers `error` / `unhandledrejection` listeners to forward runtime events to `useDebugStore` when `VITE_DEBUG_GUI === "true"`.
- `DraggableItem` & `DroppableArea` (`[dnd-wrappers.tsx:DraggableItem]`, `[dnd-wrappers.tsx:DroppableArea]`): React wrapper components around `@dnd-kit/core` `useDraggable` and `useDroppable` with drag transform styling (`zIndex: 100`) and hover highlighting.
- `initGlobalErrorHandlers()` (`[error-handler.ts:initGlobalErrorHandlers]`): Attaches global `window.onerror` and `window.onunhandledrejection` handlers that log failures and display `sonner` error toasts.
- `ManualLogEntry` & `parseManualLogs(raw)` (`[log-utils.ts:ManualLogEntry]`, `[log-utils.ts:parseManualLogs]`): Parses newline-separated text into `ManualLogEntry` objects with regex-extracted timestamps (`YYYY-MM-DD[T ]HH:MM:SS`) and log levels.
- `cn(...inputs)` (`[utils.ts:cn]`): Combines `clsx` and `tailwind-merge` for conflict-free CSS class resolution.
- Child packages:
  - [Hooks](./hooks/README.md) — `useDebounce`, `useHealthStatus`, `useIngestionStatus`, `useInView`, `useKeyboardShortcuts`, `useLogFetching`, `callSidecar`, `setBridgeInitialized`, `SIDECAR_BASE_URL`, `SIDECAR_URL`, and [Ingestion Hooks](./hooks/ingestion/README.md).
  - [Generated API Types](./types/README.md) — `LogLensAiAPISchema` and generated JSON-RPC 2.0 request/response interfaces.

## Invariants
- Debug interceptor gating: `initDebugInterceptor` returns immediately without modifying `console` or `globalThis` listeners unless `import.meta.env.VITE_DEBUG_GUI === "true"` (`[debug-utils.ts:initDebugInterceptor]`).
- Non-browser & duplicate-toast suppression: `initGlobalErrorHandlers` exits if `typeof window === "undefined"`, ignores `ResizeObserver loop` errors, and suppresses toasts for sidecar/bootstrap transport errors (`"Sidecar Error"`, `"Connection Error"`, `"Failed to fetch"`, `"NetworkError"`, `"Load failed"`) (`[error-handler.ts:initGlobalErrorHandlers]`).
- Manual log parsing defaults: `parseManualLogs` trims and skips empty lines, falls back to `new Date().toISOString()` when no timestamp prefix matches, uppercases matched levels (defaulting to `"INFO"`), and hardcodes `source_id: "manual"` (`[log-utils.ts:parseManualLogs]`).

## Side Effects
- Global console & listener overrides: `initDebugInterceptor` replaces `console.log`, `console.warn`, `console.error`, and `console.debug`, attaches `error` and `unhandledrejection` listeners on `globalThis`, and mutates `useDebugStore` via `addLog` (`[debug-utils.ts:initDebugInterceptor]`).
- Window error & toast reporting: `initGlobalErrorHandlers` assigns `window.onerror` and `window.onunhandledrejection`, calls `console.error`, and emits `sonner` `toast.error` notifications (`[error-handler.ts:initGlobalErrorHandlers]`).

## Verification
- Run: `bun test`
