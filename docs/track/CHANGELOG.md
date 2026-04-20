# Changelog

All notable changes to the LogLensAi project will be documented in this file.

## [Phase 4.2] - Core Hardening & Complexity Reduction (2026-04-20)

### Refactored
- **Ollama Stream Processor**: Modularized the monolithic `_process_stream_line` and `chat_stream` functions in `sidecar/src/ai/ollama.py` to reduce cognitive complexity below the 15-point threshold.
- **Log Selection Refactor**: Moved the `onMouseUp` event listener in `CustomParserModal.tsx` to a hook-based `useEffect` assigned listener to satisfy JSX accessibility requirements.

### Fixed
- **JSON Parse Obsolescence**: Hardened exception handling in `WorkspaceEngineSettings.tsx` and `settingsStore.ts` by adding explicit debug logging to the standard parse attempt before falling back to legacy recovery.
- **QA Compliance**: Resolved all outstanding Biome and Ruff regressions, including statement block formatting and `handleMouseUp` hook dependency optimization.

## [Phase 4] - Ingestion Stabilization & Multi-Stream Routing (2026-04-19)

### Added
- **Multi-Stream Ingestion Routing**: Implemented path-based routing (`/ingest/{workspace_id}/{collection_name}`) for the HTTP API, allowing granular isolation of log streams within a single workspace.
- **Workspace-Aware Ingestion UI**: Updated the `ImportFeedModal` to dynamically generate and display correctly formatted ingestion URLs based on the active workspace and chosen collection label.
- **Dynamic Port Feedback**: Unified real-time port feedback across the UI (toasts and instructions) using standard settings store values.

### Fixed
- **Variable Masking Engine Hardening**: Resolved critical sidecar startup crashes and frontend `TypeError` mapping errors caused by malformed or double-encoded `drain_masks` settings.
- **Defensive Multi-Stage Parsing**: Implemented robust JSON-RPC settings decoding in the sidecar and store-level sanitization in React to handle serialization edge cases.
- **Quality Audit**: Performed a complete repository-wide lint and format pass (Biome + Ruff), resolving all remaining quality violations in the ingestion and settings components.

## [Phase 4.1] - Core Stability & Sidecar Restoration (2026-04-19, Partial)

### Fixed
- **Sidecar Lifecycle Restoration**: Restored `sidecar/main.py` entry point which was previously empty, preventing the backend from starting in development mode.
- **Connection Reliability**: Resolved "Failed to fetch" errors by ensuring the sidecar binds to port 5000 and correctly resolves the `src` package.
- **Stability Audit**: Completed the final verification for `FIX-STABILITY-001`, resolving type safety regressions and ensuring full JSON-RPC parity between React and Python.

## [Unreleased] - 2026-04-18

### Fixed
- **Workspace Engine Persistence**: Resolved a regression where engine configuration overrides failed to persist by implementing a forced sync-on-open in `WorkspaceEngineSettings.tsx`.
- **Sidecar Startup Stability**: Fixed a `ModuleNotFoundError` by correctly bootstrapping `sys.path` in `sidecar/main.py` to include the `src` directory, ensuring internal imports resolve correctly when run from the root.
- **UI/UX Padding**: Standardized `DialogFooter` padding in settings modals to ensure consistent and professional spacing for action buttons.
- **Redundant UI Pruning**: Removed redundant "Workspace Engine Settings" entry points from the AI Sidebar and LogToolbar, centralizing all engine-level overrides within the Orchestrator Hub.
- **Global Stability & Type Safety**: Hardened types for A2UI components, ensured all `FilterEntry` objects have mandatory unique IDs, optimized regex performance, and completed a project-wide Biome quality audit.

## [Unreleased] - 2026-04-17

### Added
- **A2UI v0.9 (Agent-to-User Interface) Integration**:
    - Integrated `@a2ui/react` and `google-adk` to enable generative UI widgets within the AI Sidebar.
    - Implemented `A2UIRenderer.tsx` with support for both JSON and token-efficient Markup formats.
    - Added decorative UI tag stripping in `AIInvestigationSidebar.tsx` for a clean conversational experience.
- **Port Resolution & Stability**:
    - Centralized sidecar URL resolution in `useSidecarBridge.ts` to enforce port 5000 and prevent 4001 ghost routing.
    - Implemented explicit debug logging for sidecar endpoint detection.

### Fixed
- **Module Shadowing Regression**: Deleted stale `ai.py` that was conflicting with the `src.ai` package and causing sidecar crashes (Code 255).
- **Code Debt**: Consolidated redundant `get_drain_parser` definitions and cleaned up unused imports in the test suite.

### Added
- **AI Copilot Skills & Memory**:
    - Implemented `/` slash command autocomplete system in the AI Sidebar for quick access to tools (`/search`, `/save`, `/query`, `/analyze`, `/anomalies`).
    - Added "Workspace Global Context" toggle in the Orchestrator Hub to enable AI context ingestion across the entire workspace.
    - Introduced "Skills & Memory" toggles in the Settings Panel to enable/disable specific AI tools (Log Search, Associative Memory).
- **Backend Memory Subsystem**:
    - Added `ai_memory` table to DuckDB schema for persistent storage of log patterns and resolutions.
    - Implemented `save_memory` and `search_memory` RPC methods and exposed them as MCP tools for autonomous AI agent invocation.
- **Enhanced Reasoning UI**:
    - Refactored `ThinkingBlock.tsx` with a refined vertical violet border design and streamlined typography to distinguish reasoning from output.

### Fixed
- Improved JSON-RPC serialisation consistency for memory-related data models.
- Resolved Biome linting issues in Orchestration and Chat components.
