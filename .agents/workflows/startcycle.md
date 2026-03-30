---
description: Start the Autonomous AI Developer Pipeline sequence (LogLensAi Edition)
---

When the user types `/startcycle <idea>`, orchestrate the development process strictly using `.agents/agents.md` and `.agents/skills/`.

### Execution Sequence:

1. **Vision & Roadmap (@pm)**:
   - Execute `write_specs.md` skill using the `<idea>`.
   - Update `docs/track/TODO.md` and initialize `docs/TODOC/` detail files.
   - **Pause**: "Do you approve of this tech stack and specification? (Check `docs/track/Technical_Specification.md` and `docs/track/TODO.md` / `docs/TODOC/`)"

2. **Architecture & Standards (@architect)**:
   - Execute `manage_codedebt.md` skill.
   - Define `docs/API_SPEC.md` and update `docs/track/CodeDebt.md`.
   - **Pause**: "Interface contract and architecture standards are set in `docs/API_SPEC.md`. Proceed to implementation?"

3. **Core Sidecar Engine Logic (@backend)**:
   - Execute `generate_backend_code.md` skill in `sidecar/src/`.
   - Ensure all backend code has docstrings and `// TODO(ID)`'s.

4. **Premium Interface implementation (@frontend)**:
   - Execute `generate_frontend_code.md` skill in `src/`.
   - Apply Atomic Design and theme tokens from `docs/design/theme.md`.

5. **Quality Assurance & Verification (@qa)**:
   - Execute `audit_code.md` skill across `sidecar/src/` and `src/`.
   - Fix all logic/dependency errors and verify against `SoftwareStandards.md`.

6. **Native Desktop Deployment (@devops)**:
   - Execute `deploy_app.md` skill for the Tauri v2 desktop application.
   - Run `bun tauri dev` and confirm sidecar orchestration.

7. **Memory & Lessons Learned (@scribe)**:
   - Execute `document_session.md` skill.
   - Update `docs/track/LessonsLearned.md` and internal documentation in `docs/`.
   - **Final Report**: "Cycle complete! You can review the Session Retrospective in `docs/track/Session_Retrospective.md`."
