# FEAT-AI-TOOLS-001: Advanced AI Copilot Tools & Memory

## Context
See Feature Spec at `docs/features/FEAT-AI-TOOLS-001.md`. 
The objective is to implement a unified AI Copilot workflow in LogLensAi, introducing:
1. Tool mapping (Search, Memory).
2. UI support for triggering tools (slash commands).
3. Visual restructuring of the "Thinking" output block to match standard conversational agents.

## Implementation Plan

### Phase A: Architecture & Backend
1. **[X] Database Schema**: Add `ai_memory` table to `sidecar/src/db.py`.
2. **[X] Tools Definition**: Draft MCP tools in `mcp_server.py` (`save_memory`, `search_memory`, `query_logs`).
3. **[X] Prompt Injection**: Updated JSON-RPC methods to handle deep context and memory access natively.

### Phase B: Frontend Tooling
1. **[X] Settings**: Added specific toggles for "Enable Log Search Tool" and "Enable Associative Memory" in `SettingsPanel.tsx`, syncing with `SettingsStore`.
2. **[X] Orchestration Hub**: Added "Workspace Global Context" toggle in layout via `OrchestratorHub.tsx` bound to `InvestigationStore`.
3. **[X] Chat Input**: Introduced a lightweight autocomplete wrapper that activates on `/` within `AIInvestigationSidebar.tsx`.

### Phase C: UX Refinement
1. **[X] Show Thinking Breakdown**: Updated `ThinkingBlock.tsx` with a refined `border-l-2` expanded toggle view per layout requested previously.

## Lessons & Challenges
- Re-architected thinking block parsing to strip out the preview line entirely for a cleaner interface, allowing a single `border-l-2` boundary to distinguish logic.
- Adopted `FastMCP` native tools instead of static functions, enabling LogLens's LLM to dynamically trigger context searches and record issue signatures automatically into DuckDB via JSON-RPC.
