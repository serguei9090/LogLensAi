# src

## Overview
Rust source crate (`app_lib` / `app` binary) for the Tauri v2 desktop shell. Configures Tauri plugins, manages the Go backend sidecar process lifecycle over newline-delimited stdio, and exposes the `dispatch_sidecar` IPC command to the webview frontend.

## Interface
- `[main.rs:main]`: Binary entrypoint that invokes `app_lib::run()`.
- `[lib.rs:run]`: Public crate entrypoint (`#[cfg_attr(mobile, tauri::mobile_entry_point)] pub fn run()`) that initializes `tauri_plugin_shell`, `tauri_plugin_dialog`, and `tauri_plugin_mcp_bridge`, registers managed `SidecarManager` state, mounts the `bridge::dispatch_sidecar` invoke handler, runs setup, and starts the Tauri event loop.
- `[bridge.rs:dispatch_sidecar]`: Tauri IPC command (`#[tauri::command] pub async fn dispatch_sidecar(app: AppHandle, request: String) -> Result<String, String>`) exposed via `tauri::generate_handler![bridge::dispatch_sidecar]` inside private `mod bridge`; forwards requests to `SidecarManager::send_request`.
- `[sidecar.rs:SidecarManager]`: Process manager struct (`pub struct SidecarManager` inside private `mod sidecar`) wrapping `child: Arc<Mutex<Option<Child>>>`.
- `[sidecar.rs:SidecarManager::new]`: Constructor (`pub fn new() -> Self`) initializing `SidecarManager` with `child` set to `None`.
- `[sidecar.rs:SidecarManager::spawn]`: Lifecycle method (`pub fn spawn(&self, app: &AppHandle) -> Result<(), String>`) that starts the sidecar child process if none is currently stored.
- `[sidecar.rs:SidecarManager::send_request]`: Request/response method (`pub fn send_request(&self, app: &AppHandle, request: &str) -> Result<String, String>`) that ensures the sidecar is alive, sends `request`, and reads a single response line.

## Invariants
- `[main.rs:windows_subsystem]`: `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]` suppresses the Windows console window in release builds.
- `[lib.rs:run]`: Requires `manager.spawn(app.handle())?` to succeed during `.setup(...)`; panics via `.expect("error while running tauri application")` if `tauri::Builder::run` returns an error.
- `[sidecar.rs:SidecarManager]`: `self.child` (`Arc<Mutex<Option<Child>>>`) is locked via `.unwrap()` in both `spawn` and `send_request`, so a poisoned mutex panics.
- `[sidecar.rs:SidecarManager::spawn]`: Idempotent when `child_guard.is_some()`, returning `Ok(())` without spawning a second process.
- `[sidecar.rs:SidecarManager::spawn]`: Build-mode command selection: under `cfg!(debug_assertions)`, executes `go run ./cmd/sidecar --stdio --with-http --db ../loglens.duckdb` in working directory `../backend-go`; in release builds (`not(debug_assertions)`), resolves the bundled Tauri sidecar binary `"sidecar"` via `app.shell().sidecar("sidecar")`. Both paths pipe `stdin` and `stdout` and inherit `stderr`.
- `[sidecar.rs:SidecarManager::send_request]`: Treats the child as alive only when `child.try_wait()` returns `Ok(None)`; before calling `self.spawn(app)?` for initial respawn or post-error retry, resets `*child_guard = None` and explicitly calls `drop(child_guard)` to avoid re-locking deadlock in `spawn`.
- `[sidecar.rs:SidecarManager::send_request]`: Retries `write_and_read` at most once after respawning on I/O failure.
- `[sidecar.rs:SidecarManager::write_and_read]`: Uses a newline-delimited protocol over `stdin`/`stdout` (writes `request.as_bytes()`, `b"\n"`, flushes, and reads one line with `BufReader::read_line`), returning `Err("Empty response from sidecar (process likely exited)".into())` if `read_line` reads an empty string (EOF).

## Side Effects
- `[lib.rs:run]`: Initializes Tauri plugins (`tauri_plugin_shell`, `tauri_plugin_dialog`, `tauri_plugin_mcp_bridge`), spawns the sidecar during `.setup(...)`, looks up the `"main"` webview window (`app.get_webview_window("main")`) and calls `window.show()` and `window.set_focus()` (ignoring errors), and runs the desktop GUI event loop.
- `[sidecar.rs:SidecarManager::spawn]`: Spawns an external OS child process (`go` in `../backend-go` for debug, or bundled `"sidecar"` binary for release) with piped `stdin`/`stdout` and inherited `stderr`; reads `std::env::current_dir()` when formatting spawn error messages.
- `[bridge.rs:dispatch_sidecar]`: Delegates Tauri IPC calls to `SidecarManager::send_request`, which polls `child.try_wait()` and may spawn or respawn the OS sidecar process.
- `[sidecar.rs:SidecarManager::write_and_read]`: Performs blocking synchronous `stdin` writes/flush and blocking `stdout` `BufReader::read_line` reads while `SidecarManager::send_request` holds the `self.child` mutex (including when invoked from `async fn dispatch_sidecar`).

## Verification
- Run: `cargo test`
