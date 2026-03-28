# TODOC: FEAT-FUSION-001 (Fusion Orchestration Engine)

**Status**: Planning  
**Feature**: Fusion Mode  
**Implementation ID**: FUSION-SPRINT-01  

## 1. Problem Statement
The current "All" view is a simple database query that flattens everything. It lacks the control needed for complex forensic analysis where specific timing and sources must be synchronized.

## 2. Architecture Choice: Config-First Flow
Instead of making the log table handle complex filters, we introduce a **Gatekeeper View** (The Fusion Config).
- **Why**: Reduces cognitive load. One place for setup, one place for investigation.
- **Components**: `FusionConfigEngine.tsx` (Organism).

## 3. The Pattern Parser Strategy (Hard Tech)
The parser modal must handle the "Guess" vs "Define" states.
- **State Logic**: 
  - `Sample`: Fetch 5 raw lines from the sidecar via `read_file_head(path, lines=5)`.
  - `Selection`: React State tracks start/end indices of user selection on a line.
  - `Regex Generation`: The sidecar receives the sample line + the selected substring and returns a `datetime` format string (e.g., `%Y-%m-%d`).

## 4. UI/UX Tokens (Premium Design)
- **Status Indicators**: Use glowing dots for live state (`bg-primary/20` with `animate-pulse`).
- **Drag-to-Select**: The Parser Modal's sample line should support a "Highlight to Define" interaction (custom implementation using `window.getSelection()`).

## 5. Persistence
Save configurations in `.loglens/config.json` inside the workspace directory, or in the `Settings` table of the DuckDB. **Decision**: Use DuckDB for unified state recovery.

## 6. Development Checklist (Subagent Assignments)
- [ ] `@frontend`: Create `FusionConfigEngine` layout.
- [ ] `@backend`: Implement `get_fused_logs` with dynamic SQL `UNION` construction.
- [ ] `@architect`: Define the `CustomParserModal` interface with `onFormatDefine` callback.
