---
trigger: model_decision
description: Optional remote-agent workflow. Use only when the user explicitly asks to use Jules or a remote implementation session.
---

# Remote Agent Workflow

Use this rule only for explicit Jules/remote-agent work. Local Codex work does not require this workflow.

## Before Launch

1. Ensure the task has an active bead.
2. Update `docs/track/handoff.md` with scope, acceptance criteria, known risks, and verification commands.
3. Commit or stash unrelated local changes before handing work to a remote session.
4. Push only through the repository's normal branch policy. Do not force-push unless the user explicitly authorizes it.

## Remote Instructions

Remote prompts must include:

- active bead ID,
- goal and non-goals,
- files or modules likely involved,
- acceptance criteria,
- required tests,
- documentation/handoff update requirement,
- instruction to update Beads status or report why it could not be updated.

## Pulling Results

1. Inspect the remote diff before applying or merging.
2. Run focused verification from the handoff.
3. Update `docs/track/handoff.md` with results.
4. Update or close the bead only after local verification passes.

