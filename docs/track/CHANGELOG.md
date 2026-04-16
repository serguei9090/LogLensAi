# Changelog

All notable changes to the LogLensAi project will be documented in this file.

## [Unreleased] - 2026-04-16

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
