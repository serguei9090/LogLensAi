# Skill: Deploy App (Native LogLensAi)

## Objective
Your goal as DevOps is to intelligently package the application and fire up a server based on the Tauri v2 + Python Sidecar architecture.

## Instructions
1. **Stack Detection**: Validate the environment for Tauri v2 (Rust) + React (Bun) + Python (uv).
2. **Install Dependencies**: Execute `bun install` for the frontend and `uv sync` for the sidecar.
3. **Environment Check**: Ensure the Python sidecar is properly configured and the DuckDB database is accessible.
4. **Host Locally**: Execute `bun tauri dev` to start the desktop application in the development environment.
5. **Report**: Output the confirmation that the application is running and celebrate a successful launch!
