---
trigger: always_on
description: Global SDLC, task tracking, documentation, testing, and quality gates.
---

# SDLC And Operational Quality

## 1. Workflow Selection

Use the smallest workflow that safely handles the request.

| Path | Use when | Required outputs |
| --- | --- | --- |
| Lightweight | one or two files, clear request, low risk, no public contract or architecture change | focused edit, focused verification, concise summary |
| Full SDLC | new feature, ambiguous scope, multi-module change, API/data/auth/security/deployment impact, or user asks for lifecycle rigor | bead, spec, implementation, tests/verification, docs update, handoff |

Escalate from lightweight to full SDLC as soon as impact or uncertainty grows.

## 2. Full SDLC Cycle

1. **Boot:** run `bd ready`, read handoff/docs when relevant, classify scope.
2. **Discovery:** inspect code, use Codanna for shared symbols or unclear impact, verify external APIs with docs.
3. **Planning:** create or claim a bead; write the spec in `docs/track/specs/<bead_id>.md` for non-trivial work.
4. **Implementation:** make scoped changes following the active persona and relevant rules.
5. **Testing:** run the smallest meaningful test first, then broaden when risk requires it.
6. **Documentation:** update `docs/track`, `docs/architecture`, `README.md`, or `DESIGN.md` when behavior, architecture, setup, or UI contracts change.
7. **Handoff:** update `docs/track/handoff.md` with bead ID, branch state, changed surfaces, verification, and open risks.
8. **Close:** update the bead status only after verification and documentation are complete.

## 3. Beads Protocol

- `bd` is the task source of truth.
- `docs/track/*.md` files are supporting artifacts, not task state.
- Use `bd create` for new full-SDLC work.
- Use `bd update <id> --status completed` or `bd close <id>` only when the work is verified.
- Use `bd remember "RULE [context]: [fact]"` for durable project facts.
- Do not maintain a separate markdown-checklist workflow for task state.

## 4. Documentation Rules

- Update docs in the same change that alters architecture, public behavior, setup, or operational workflow.
- Specs live in `docs/track/specs/`.
- Lessons and recurring decisions live in `docs/track/LessonsLearned.md` or `bd remember`.
- Architecture docs live in `docs/architecture/`.
- Design system changes must update `DESIGN.md` before implementation.

## 5. Testing Rules

- Every non-trivial behavior change needs verification.
- Prefer focused tests that cover changed behavior over broad, slow suites.
- For bug fixes, reproduce or lock the failure when practical before fixing it.
- If tests cannot run, state the blocker and use the best available static or manual verification.

## 6. Quality Rules

- Keep edits scoped to the request.
- Read files before editing.
- Avoid placeholders. Create a bead for deferred work.
- Comments explain why, not what.
- Use Conventional Commits for commit messages when committing: `<type>(<scope>): <description>`.
