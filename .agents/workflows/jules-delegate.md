---
description: The Deep Refactor Route - PM plans, Jules CLI handles complex cross-file async engineering.
---

// turbo-all
When the user types `/jules-delegate <idea>`:

### Execution Sequence:
1. Shift context to the **Product Manager (@pm)** and execute `.agents/skills/write_specs.md` with `<idea>`.
   *(PAUSE strictly for user approval of `Technical_Specification.md` and `TODO.md` before continuing.)*
2. Create a Jules Handoff Manifest containing the architecture and required `TODO(ID)`s.
3. Trigger the Jules CLI to begin massive asynchronous engineering (`/jules-cycle` sequence).
4. Prompt the user to sync Jules changes once completed using `pull_jules_sessions.ps1`.
5. Shift context back to **QA/DevOps** to audit, install, and run the deep refactor results locally.
