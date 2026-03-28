# Technical Specification: Stable Workspace Tabs & Sidecar Orchestration

## Executive Summary
This specification outlines the final stabilization and optimization of the **Workspace Tabs** feature in LogLensAi, along with robust **Sidecar Orchestration** to resolve connection errors observed in local development environments. The goal is to ensure a premium desktop-native experience whereas the application seamlessly manages its backend sidecar and provides a multi-source log analysis workflow without environmental friction.

## Requirements
### Functional
- **Multi-Source Isolation**: Users must be able to switch between discrete log sources in a workspace via a tabbed interface.
- **Aggregate View**: An "All" tab that merges logs from all workspace sources.
- **Dynamic Tab Management**: Ability to add/remove source tabs dynamically.
- **Sidecar Availability**: The application must ensure the Python sidecar is reachable, with automatic startup or clear error recovery.

### Non-Functional
- **Desktop Perfection**: Zero references to "Browser Mode" or web-sandboxing in the UI.
- **Low Latency**: RPC calls to the sidecar must be optimized (e.g., CORS configured, 127.0.0.1 binding).
- **Resilience**: Graceful handling of sidecar connection failures with informative feedback.

## Architecture & Tech Stack
- **Frontend**: React 19 + Vite (Tauri v2).
- **Backend Sidecar**: Python 3.12 (AIOHTTP + JSON-RPC 2.0).
- **Communication Bridge**: Tauri Rust command `dispatch_sidecar` acting as a proxy to the Python sidecar's HTTP port (5000).
- **State Management**: Zustand `workspaceStore` for tracking `LogSource[]` and `activeSourceId`.

## Implementation Details
### 1. Sidecar Stabilization (Fixing 404/Connection Errors)
- **CORS Support**: Add `aiohttp-cors` to the Python sidecar to allow cross-origin requests from the web-based dev server (Vite).
- **Explicit Binding**: Force the sidecar to listen on `127.0.0.1` and `port 5000` to avoid ambiguous `localhost` or IPv6 resolution issues on Windows.
- **Rust Bridge Optimization**: Ensure the Rust `dispatch_sidecar` command has a reasonable timeout and informative error messages when the sidecar is unreachable.

### 2. UI Refinement (Desktop Only)
- **Removal of Browser Fallbacks**: Strip all code related to "Browser Sandboxed Mode" and `isTauri` environment checks, as LogLensAi is a dedicated desktop application.
- **Native Dialogs**: Always prioritize `@tauri-apps/plugin-dialog` for file operations.

### 3. Workspace Tabs Integration
- **Filtering Logic**: Update the `get_logs` RPC parameters to include an optional `source_id` filter.
- **Tab Component**: Complete the `WorkspaceTabs` molecule integration into `LogToolbar`.
- **Store Sync**: Ensure `workspaceStore` persists tabs across app restarts via `persist` middleware.

## Data Flow
1. **User Interaction**: User adds a log file via `ImportFeedModal`.
2. **State Update**: `workspaceStore` is updated with a new `LogSource`.
3. **RPC Discovery**: The new source appears as a tab.
4. **Log Fetching**: Selecting a tab triggers a `get_logs` call with `source_id = <path>`.
5. **Rust Proxy**: Tauri Rust layer forwards the request to the Python HTTP server.
6. **Persistence**: DuckDB stores logs with a `source_id` column for indexed filtering.

## Roadmap (TODO Sync)
- [ ] Implement CORS and explicit 127.0.0.1 binding in sidecar `api.py`.
- [ ] Complete `WorkspaceTabs` component styling and integration.
- [ ] Update `InvestigationPage` to correctly filter by `activeSourceId`.
- [ ] Add sidecar status indicator to the UI.
