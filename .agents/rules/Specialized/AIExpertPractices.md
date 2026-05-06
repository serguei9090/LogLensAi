---
trigger: model_decision
description: Practical collaboration practices for AI-assisted engineering with Beads-backed traceability.
---

# AI Engineering Collaboration Practices

## 1. Keep Work Small

- Prefer scoped changes with clear verification.
- Split broad requests into beads before implementation.
- Avoid repo-wide refactors unless the bead explicitly calls for them.

## 2. Preserve Traceability

- Use `bd` for task state and durable decisions.
- Reference the active bead in specs, handoff notes, and commits when full SDLC is used.
- Use `bd remember` for reusable project facts instead of burying them in chat.

## 3. Verify Empirically

- Bug fixes should include reproduction or focused verification when practical.
- Documentation should be checked against code, command output, or official docs.
- Before closing work, compare the implementation against `System/SoftwareStandards.md` and the relevant domain rules.

## 4. Maintain Living Rules

- Treat `AGENTS.md`, `.agents/rules/`, and `.agents/skills/` as executable guidance.
- When an agent repeatedly misbehaves, improve the rule or skill instead of relying on memory.
- Remove obsolete rules quickly; stale rules are worse than missing rules.

