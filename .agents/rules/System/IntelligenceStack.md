---
trigger: always_on
description: Evidence stack for Beads, Codanna, local repository inspection, documentation review, and synthesis.
---

# Intelligence Stack

Use the smallest evidence stack that makes the task safe. Full SDLC work requires stronger evidence than lightweight edits.

## Layers

| Layer | Purpose | Tools |
| --- | --- | --- |
| Task state | Understand active work and durable context | `bd ready`, `bd list`, `bd create`, `bd update`, `bd remember` |
| Physical code truth | Find symbols, callers, impact, and docs indexed by Codanna | `scripts/codanna/*.py`, `codanna search`, `codanna mcp` |
| Local repository context | Verify exact files, tests, package scripts, and existing patterns | file reads, `rg`, package/test config |
| External docs | Verify unstable or unfamiliar external APIs | official docs, package help, trusted primary docs |
| Synthesis | Convert evidence into plan, spec, focused edit, or handoff | concise reasoning, spec, checklist |

## Full SDLC Entry

1. Run `bd ready`.
2. Use Codanna or local search to identify affected files and symbols.
3. Read relevant rules and persona instructions.
4. Create or update the bead before implementation.
5. Use focused verification after implementation.

## Lightweight Entry

1. Inspect the target files directly.
2. Use Codanna only when the symbol is shared, impact is unclear, or the edit touches contracts.
3. Run the smallest useful verification.
4. Escalate to full SDLC when impact expands.

## Guardrails

- Do not claim a code relationship without verifying it.
- Do not require every layer for tiny edits.
- Do not use missing tools as a reason to guess silently.
- After structural changes, run Codanna indexing when available.

