---
description: Start the Autonomous Developer Pipeline entirely within the Antigravity chat shell.
---

// turbo-all
When the user types `/auto-cycle <idea>`, orchestrate the entire development process linearly using Antigravity personas. 

### Execution Sequence:
1. Shift context to the **Product Manager (@pm)** and execute `.agents/skills/write_specs.md` with `<idea>`.
   *(PAUSE strictly for user approval of `Technical_Specification.md` and `TODO.md` before continuing. Re-draft if asked.)*
2. Shift context to the **Engineering Tier (@frontend-expert / @backend-expert)** and execute `.agents/skills/generate_code.md`. Write the code directly using Antigravity's physical tools.
3. Shift context to the **QA Engineer (@qa-tester)** and execute `.agents/skills/audit_code.md`.
4. Shift context to the **DevOps Master (@devops)** and execute `.agents/skills/deploy_app.md` to run terminal dependencies.
