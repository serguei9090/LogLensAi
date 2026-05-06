---
trigger: always_on
description: Session boot sequence for Beads-backed SDLC work.
---

# Boot Sequence

This rule defines the first actions for a new task or session.

## 1. Establish Task State

1. Run `bd ready` when Beads is initialized.
2. If Beads is not initialized, run `bd init --non-interactive` or report that task tracking is unavailable.
3. Read `docs/track/handoff.md` when it exists.
4. Identify whether the request is lightweight or full SDLC.

## 2. Verify Environment Only When Needed

Do not run broad environment checks by default. Verify tools only when the task needs them:

| Task needs | Check |
| --- | --- |
| Git operations | `git status --short` |
| Python work | `python --version`, `uv --version`, or project test command |
| JS/TS work | package manager/version and project scripts |
| Hooks | `lefthook version` and `lefthook install` if hooks are required |
| Codanna | `codanna --help` or wrapper script existence |

## 3. Tracking Rule

Use Beads for durable task tracking. Do not use a standalone markdown checklist as the source of truth.

- Create a bead for new full-SDLC work.
- Use `bd remember` for durable decisions or project facts.
- Use inline `TODO(<bead_id>)` only for code-level follow-ups that already have a bead.

## 4. Start Criteria

Before implementation, know:

- the active bead or reason lightweight mode does not need one,
- the files or modules likely affected,
- the standards/rules that apply,
- the smallest useful verification command.
