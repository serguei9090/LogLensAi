# Implementation Plan: Fix Hot-Reload Loop and AI API Spam

## Objective
Stabilize the development environment by resolving the Vite hot-reload loop, eliminating redundant and expensive Google Gemini API calls, and preventing the Tauri sidecar from crashing due to DuckDB lock contention during `dev:all`.

## Key Files & Context
- `vite.config.ts`: Manages Vite's dev server behavior.
- `sidecar/src/ai/ai_studio.py`: Handles Google AI Studio API communication.
- `src-tauri/src/sidecar.rs`: Spawns the Tauri sidecar process in development.

## Proposed Solution

1. **Fix Vite Reload Loop**
   - Modify `vite.config.ts` to add a `server.watch.ignored` array.
   - Ignore `**/*.log`, `**/*.duckdb`, and `**/*.wal` to prevent Vite from reloading the frontend every time the sidecar writes to its database or log file in the project root.

2. **Fix AI API Spam (Caching)**
   - Modify `sidecar/src/ai/ai_studio.py`'s `AIStudioProvider` to implement a simple class-level cache for the `list_models` method.
   - Store `self._cached_models` and `self._cache_timestamp`.
   - Before hitting the Google API, check if the cache is valid (e.g., less than 1 hour old). If valid, return the cached models.

3. **Fix Sidecar DB Lock Contention**
   - When running `dev:all`, an HTTP sidecar and a Tauri Stdio sidecar are spawned concurrently.
   - They both attempt to use `loglens.duckdb`, causing a file lock collision that crashes the Stdio sidecar and forces Tauri to aggressively restart it.
   - Modify `src-tauri/src/sidecar.rs` to pass `--db loglens_tauri.duckdb` to the `uv run` command in debug mode. This gives the Tauri dev sidecar its own isolated database, preventing the crash loop.

## Implementation Steps

1. Update `vite.config.ts` with the new watch ignores.
2. Update `sidecar/src/ai/ai_studio.py` with caching logic.
3. Update `src-tauri/src/sidecar.rs` to append `--db loglens_tauri.duckdb` to the command arguments.

## Verification & Testing
- Start `bun run dev:all`.
- Verify the Vite server does not constantly reload the frontend.
- Open the Settings panel and ensure the AI models load quickly (from cache on subsequent reloads).
- Check the console logs to ensure the Stdio sidecar is no longer crash-looping with DuckDB lock errors.