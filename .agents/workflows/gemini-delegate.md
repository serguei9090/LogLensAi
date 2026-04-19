---
description: The Surgical Route - PM plans, Gemini CLI executes massive local code generation.
---

// turbo-all
When the user types `/gemini-delegate <idea>`:

### Execution Sequence:
1. Shift context to the **Product Manager (@pm)** and execute `.agents/skills/write_specs.md` with `<idea>`.
   *(PAUSE strictly for user approval of `Technical_Specification.md` and `TODO.md` before continuing.)*
2. Shift context to the Orchestrator, dynamically executing the external Gemini CLI to handle coding in the console without bloating the chat: 
   `gemini -y -p "You are the @frontend-expert and @backend-expert. Read docs/architecture/Technical_Specification.md and execute generate_code.md skill."`
3. Antigravity monitors the output of the Gemini CLI run.
4. Shift context to **QA Engineer (@qa-tester)** to inspect the changes.
5. Act as **DevOps Master (@devops)** to install and start the system.
