# Intelligence Stack Protocol

Use the smallest evidence stack that makes the task safe. Full SDLC work requires stronger evidence than lightweight edits.

## Layers

| Layer | Purpose | Tools |
| --- | --- | --- |
| Task state | Understand active work and durable context | `bd ready`, `bd list`, `bd create`, `bd update`, `bd remember` |
| Physical code truth | Find symbols, callers, impact, and docs indexed by Codanna | `scripts/codanna/*.py`, `codanna search`, `codanna mcp` |
| Local repository context | Verify exact files, tests, package scripts, and existing patterns | file reads, `rg`, package/test config |
| External docs | Verify unstable or unfamiliar external APIs | official docs, package help, trusted primary docs |
| Synthesis | Convert evidence into plan, spec, or focused edit | concise reasoning, spec, checklist |

## Full SDLC Entry

1. Run `bd ready`.
2. Use Codanna or local search to identify affected files and symbols.
3. Read the relevant persona and persona-required rules.
4. Create or update the bead before implementation.
5. Use focused verification after implementation.

## Lightweight Entry

1. Read the selected persona and mandatory rules.
2. Inspect the target files directly.
3. Use Codanna only when the symbol is shared, impact is unclear, or the edit touches contracts.
4. Run the smallest useful verification.

## Guardrails

- Do not claim a code relationship without verifying it.
- Do not require every layer for tiny edits.
- Escalate from lightweight to full SDLC when impact expands.
- After structural changes, run Codanna indexing when available.

