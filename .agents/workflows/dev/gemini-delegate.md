---
description: The Surgical Route - PM plans, Gemini CLI executes massive local code generation.
---

Assume Role: PM Smith (@pm)

// turbo-all
When the user types `/gemini-delegate <idea>`:

### Execution Sequence:
1. Shift context to the **Product Manager (@pm)** and execute `.agents/skills/write_specs.md` with `<idea>`.
   *(PAUSE strictly for user approval of `Technical_Specification.md` and `TODO.md` before continuing.)*
2. Shift context to the Orchestrator, dynamically executing the external Gemini CLI to handle coding in the console without bloating the chat: 
   `gemini -y -p "You are the @frontend-expert and @backend-expert. Read docs/Documentation/architecture/Technical_Specification.md and execute generate_code.md skill."`
3. Antigravity monitors the output of the Gemini CLI run.
4. Shift context to **QA Engineer (@qa-tester)** to inspect the changes.
5. Act as **DevOps Master (@devops)** to install and start the system.

## 🚨 Mandatory Quality Standards
- **Assume Role Header**: Every file you create or edit MUST start with an `Assume Role: <Persona> (@handle)` header.
- **Semantic Commenting**: 
  - Every function MUST include a purpose, the architectural rationale, and a `Ref:` to the relevant spec file.
  - Every non-trivial variable MUST have an inline comment explaining **WHY** it exists.
- **TODO(ID) Protocol**: Any incomplete logic MUST use the strict syntax: 
  `// TODO(ID): [WHAT] ... [WHY] ... [EXPECTATION] ... [CONTEXT] See docs/track/specs/ID.md`
