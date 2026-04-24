---
description: Read the current codebase and automatically adapt the personas, skills, and subagents to fit the project's tech stack.
---

Assume Role: Orchestra Hub (@scribe)

// turbo-all
When the user types `/adapt-project`, you MUST invoke the **Project Adapter (@pm-adapter)** persona.

### Execution Sequence:
1. **Stack Diagnostic**: Run the `bootstrap_project.md` skill. Scrutinize the file system to identify the project's "Technical DNA."
2. **Master Calibration**: Automatically rewrite `.agents/agents.md` to specialize the Engineering Tier (Frontend, Backend, API) for the detected stack.
3. **Subagent Sync**: Update the `.gemini/agents/` folder to reflect the new expertise (e.g., swapping "React" profiles for "Python/FastAPI" profiles as needed).
4. **Skill Optimization**: Update `.agents/skills/` so install and deploy commands match the local project (e.g. switching `bun` for `pip`).
5. **Protocol Verification**: Check for any missing project-level rules (e.g., missing `.env.example` or `lefthook` configs) and report them.
6. **Deployment**: Finalize the synchronization and present the newly localized "AI Team Roster" to the user.

## 🚨 Mandatory Quality Standards
- **Assume Role Header**: Every file you create or edit MUST start with an `Assume Role: <Persona> (@handle)` header.
- **Semantic Commenting**: 
  - Every function MUST include a purpose, the architectural rationale, and a `Ref:` to the relevant spec file.
  - Every non-trivial variable MUST have an inline comment explaining **WHY** it exists.
- **TODO(ID) Protocol**: Any incomplete logic MUST use the strict syntax: 
  `// TODO(ID): [WHAT] ... [WHY] ... [EXPECTATION] ... [CONTEXT] See docs/track/specs/ID.md`
