---
description: Read the current codebase and automatically adapt the personas, skills, and subagents to fit the project's tech stack.
---

// turbo-all
When the user types `/adapt-project`, you MUST invoke the **Project Adapter (@project-adapter)** persona.

### Execution Sequence:
1. **Stack Diagnostic**: Run the `bootstrap_project.md` skill. Scrutinize the file system to identify the project's "Technical DNA."
2. **Master Calibration**: Automatically rewrite `.agents/agents.md` to specialize the Engineering Tier (Frontend, Backend, API) for the detected stack.
3. **Subagent Sync**: Update the `.gemini/agents/` folder to reflect the new expertise (e.g., swapping "React" profiles for "Python/FastAPI" profiles as needed).
4. **Skill Optimization**: Update `.agents/skills/` so install and deploy commands match the local project (e.g. switching `bun` for `pip`).
5. **Protocol Verification**: Check for any missing project-level rules (e.g., missing `.env.example` or `lefthook` configs) and report them.
6. **Deployment**: Finalize the synchronization and present the newly localized "AI Team Roster" to the user.
