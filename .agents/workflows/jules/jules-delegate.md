---
description: The Deep Refactor Route - PM plans, Jules CLI handles complex cross-file async engineering.
---

Assume Role: PM Smith (@pm)

// turbo-all
When the user types `/jules-delegate <idea>`:

### Execution Sequence:
1. Shift context to the **Product Manager (@pm)** and execute `.agents/skills/write_specs.md` with `<idea>`.
   *(PAUSE strictly for user approval of `Technical_Specification.md` and `TODO.md` before continuing.)*
2. Create a Jules Handoff Manifest containing the architecture and required `TODO(ID)`s.
3. Trigger the Jules CLI to begin massive asynchronous engineering (`/jules-cycle` sequence).
4. Prompt the user to sync Jules changes once completed using `pull_jules_sessions.ps1`.
5. Shift context back to **QA/DevOps** to audit, install, and run the deep refactor results locally.

## 🚨 Mandatory Quality Standards
- **Assume Role Header**: Every file you create or edit MUST start with an `Assume Role: <Persona> (@handle)` header.
- **Semantic Commenting**: 
  - Every function MUST include a purpose, the architectural rationale, and a `Ref:` to the relevant spec file.
  - Every non-trivial variable MUST have an inline comment explaining **WHY** it exists.
- **TODO(ID) Protocol**: Any incomplete logic MUST use the strict syntax: 
  `// TODO(ID): [WHAT] ... [WHY] ... [EXPECTATION] ... [CONTEXT] See docs/track/specs/ID.md`
