# Changelog

All notable changes to the LogLensAi project will be documented in this file.

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
