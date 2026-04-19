---
trigger: always_on
---
# Context & Memory Management Protocol (v2.0)

To maintain high reasoning quality and minimize token friction, the Antigravity framework enforces a strict limit on active session memory.

## 1. The 50-Turn Threshold
Every 50 interactions (as tracked by `telemetry.csv`), Antigravity **MUST** initiate a **"Hard Context Sync"**:
1.  **State Snapshot**: Record the exact current status of the codebase, tasks, and architectural decisions.
2.  **History Archive**: Create a `docs/archive/sessions/session_[ID]_summary.md` detailing the lessons learned and rejected paths from the last 50 turns.
3.  **Context Truncation**: Instruct future handlers (or the user) to archive the current chat history if the platform allows it or to use the summary as the ONLY source of previous state.

## 2. Dynamic Memory Pruning
At the start of every session (or new significant task):
- **Prune High-Volume Logs**: If terminal history or linter output logs in `temp/` or `dist/` are large, they must be truncated or cleared before being read.
- **Archive Completed Tasks**: Move `[x]` tasks from `docs/track/TODO.md` to a separate `history_tasks.md` if the list grows beyond 50 entries.

## 3. Mnemonic Protocol (Token Compression)
Instead of re-explaining complex architectural patterns, use **Mnemonic Anchors**:
- **Anchor: "Surgical Strike"** -> Refers to the Gemini CLI local edit workflow with Biome/Ruff validation.
- **Anchor: "Deep Refactor"** -> Refers to the Jules CLI remote handoff manifest protocol.
- **Anchor: "Decay Protocol"** -> Refers to the rule pruning and archiving logic in `ContextDecay.md`.

## 4. Token Triage Law
Before calling high-context tools like `read_many_files`, Antigravity MUST:
- **Filter**: Only read files directly relevant to the current `TODO(ID)`.
- **Snippet Focus**: Use `view_file` with specific line ranges rather than reading entire files if they are >1000 lines.
