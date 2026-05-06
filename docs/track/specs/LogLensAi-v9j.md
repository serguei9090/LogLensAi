# Implementation Plan: Integrate Tauri MCP Bridge (LogLensAi-v9j)

This plan outlines the steps to integrate the `tauri-plugin-mcp-bridge` into LogLensAi, enabling AI assistants (like Antigravity) to perform visual debugging, DOM inspection, and UI automation.

## 1. Goal
Enable "Vision" and "Interaction" capabilities for AI agents by bridging the Tauri runtime with the Model Context Protocol (MCP).

## 2. Steps

### Phase 1: Backend Integration (Rust)
- [ ] **Add Dependency**: Add `tauri-plugin-mcp-bridge` to `src-tauri/Cargo.toml`.
- [ ] **Register Plugin**: Initialize `.plugin(tauri_plugin_mcp_bridge::init())` in `src-tauri/src/lib.rs`.
- [ ] **Configuration**: (Optional) Configure allowed tools or security scopes if required by the plugin.

### Phase 2: Frontend Verification
- [ ] **Check Logs**: Verify that the MCP bridge starts successfully and listens for connections.
- [ ] **Capability Check**: Verify that the app can now provide DOM snapshots and screenshots to a connected MCP server.

### Phase 3: Local MCP Server Installation (User Action)
- [ ] **Install Server**: User runs `npx -y install-mcp @hypothesi/tauri-mcp-server --client <your-ai-client>`.

## 3. Impact Assessment
- **File Changes**:
    - `src-tauri/Cargo.toml`: Addition of the plugin crate.
    - `src-tauri/src/lib.rs`: Plugin registration in the Tauri builder.
- **Security**: The bridge opens a local WebSocket (port 9223 by default) for the MCP server to communicate with the app. This is only active during development/testing.
- **Performance**: Negligible overhead during normal operation; captures (screenshots/DOM) only occur when requested by the AI.

## 4. Verification Plan
- Run `cargo check` in `src-tauri` to ensure the plugin is correctly linked.
- Launch the app in dev mode (`npm run dev`) and check the console for MCP bridge logs.
