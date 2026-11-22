# src-tauri

## Overview
Tauri v2 desktop application package (`app` / `app_lib`) for LogLensAi. Configures the Cargo build script (`build.rs`), Rust crate dependencies (`Cargo.toml`), window/bundle settings (`tauri.conf.json`), and capability permissions (`capabilities/default.json`), wrapping the Rust entrypoint and sidecar bridge in `./src/README.md`.

## Interface
- `[Cargo.toml:package]`: Declares binary crate `app` (`version = "0.1.0"`, `edition = "2021"`, `rust-version = "1.77.2"`).
- `[Cargo.toml:lib]`: Declares library target `app_lib` with `crate-type = ["staticlib", "cdylib", "rlib"]`.
- `[build.rs:main]`: Cargo build script invoking `tauri_build::build()`.
- `[tauri.conf.json:productName]`: Desktop application `"LogLensAi"` (`[tauri.conf.json:identifier]` `"app.loglensai.desktop"`, `[tauri.conf.json:version]` `"0.1.0"`).
- `[tauri.conf.json:build]`: Frontend build/dev contract (`frontendDist = "../dist"`, `devUrl = "http://localhost:4000"`, `beforeDevCommand = "bun run dev"`, `beforeBuildCommand = "bun run build"`).
- `[tauri.conf.json:app.windows]`: Configures main window (`label = "main"`, `title = "LogLensAi"`, `width = 1280`, `height = 720`).
- `[tauri.conf.json:bundle]`: Distribution bundle settings (`active = true`, `targets = "all"`, 5 icon assets under `icons/`).
- `[capabilities/default.json:identifier]`: Capability `"default"` granting `[capabilities/default.json:permissions]` (`core:default`, `dialog:default`, `shell:default`, `mcp-bridge:default`) to `[capabilities/default.json:windows]` (`["main"]`).
- `src`: [./src/README.md](./src/README.md) - Rust crate sources (`main.rs`, `lib.rs`, `bridge.rs`, `sidecar.rs`) implementing `app_lib::run`, `bridge::dispatch_sidecar`, and `sidecar::SidecarManager`.

## Invariants
- `[Cargo.toml:package]`: Requires Rust `edition = "2021"` and MSRV `rust-version = "1.77.2"`, with crate version `"0.1.0"` matching `[tauri.conf.json:version]`.
- `[Cargo.toml:dependencies]`: Pins Tauri v2 (`tauri = "2.10.3"`, `[Cargo.toml:build-dependencies]` `tauri-build = "2.1.1"`) and plugins (`tauri-plugin-log = "2"`, `tauri-plugin-shell = "2.0.1"`, `tauri-plugin-dialog = "2.0.1"`, `tauri-plugin-mcp-bridge = "0.11"`), alongside `serde`/`serde_json = "1.0"`, `tokio = "1"` (`full`), `reqwest = "0.12"` (`json`), and `log = "0.4"`.
- `[tauri.conf.json:app.withGlobalTauri]`: Set to `true`, exposing global Tauri bindings inside the webview.
- `[tauri.conf.json:app.security.csp]`: Explicitly configured as `null`.
- `[tauri.conf.json:app.windows]`: Defines a single `"main"` window with `resizable = true`, `fullscreen = false`, `transparent = false`, `decorations = true`, and `visible = true`.
- `[capabilities/default.json:windows]`: Restricts `"default"` capability permissions to window `"main"`, matching `[tauri.conf.json:app.windows]`.
- `[src/lib.rs:run]`: Propagated child invariant — initializes plugins and `SidecarManager` state, requires `SidecarManager::spawn` to succeed in `.setup(...)`, and enforces newline-delimited stdio communication with retry-once semantics in `[src/sidecar.rs:SidecarManager::send_request]`.

## Side Effects
- `[build.rs:main]`: Runs `tauri_build::build()` at compile time, generating Tauri build metadata and capability schema artifacts.
- `[tauri.conf.json:build.beforeDevCommand]`: Executes `"bun run dev"` before `tauri dev` and expects the dev server at `http://localhost:4000`.
- `[tauri.conf.json:build.beforeBuildCommand]`: Executes `"bun run build"` before `tauri build` to populate `../dist`.
- `[tauri.conf.json:bundle]`: Produces platform installer/bundle outputs (`active = true`, `targets = "all"`) during release builds.
- `[capabilities/default.json:permissions]`: Grants the `"main"` webview runtime access to `core:default`, `dialog:default`, `shell:default`, and `mcp-bridge:default`.
- `[src/sidecar.rs:SidecarManager::spawn]`: Propagated child side effect — spawns the Go sidecar subprocess (`go run ./cmd/sidecar` in `../backend-go` for debug, or bundled `"sidecar"` in release) and performs blocking stdio I/O in `[src/sidecar.rs:SidecarManager::write_and_read]`.

## Verification
- Run: `cargo test`
