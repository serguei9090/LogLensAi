# TODOC: ANALYSIS-003 - Agentic MCP Server Bridge

## Overview
Expose LogLensAi logic as an MCP (Model Context Protocol) server. This allows external AI (Gemini CLI, Cursor, etc) to query logs across multiple workspaces and sources with guardrails against context overflow.

## Technical Strategy: Three-Tier Retrieval
1. **Tier 1: Global Stats**: Tools to list workspaces, sources, and cluster frequencies (Low token cost).
2. **Tier 2: Targeted Samples**: Tool to fetch N lines from a specific cluster or time range.
3. **Tier 3: Fusion Query**: Tool to run raw SQL/Filters across interleaved sources.

## Tools to Implement
- `ls_sources`: List all files/fusions in a workspace.
- `query_logs`: Fetch filtered log entries (with limit/offset).
- `analyze_drift`: Returns pattern change stats between two time windows.
- `get_log_context`: Fetch lines before/after a specific log ID.

## Security
- Read-only access to DuckDB.
- Scoped to the active project directory.
