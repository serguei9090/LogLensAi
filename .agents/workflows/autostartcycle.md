---
description: Fully Autonomous AI Developer Pipeline (No Confirmation)
---

// turbo-all
When the user types `/autostartcycle <idea>`, execute the entire development cycle without pausing for approval.

### Execution Sequence:

1. **Vision & Roadmap (@pm)**:
   - Execute `write_specs.md` skill using the `<idea>`.
   - Update `docs/track/TODO.md` and initialize `docs/TODOC/` detail files.
   - Proceed immediately to Step 2.

2. **Architecture & Standards (@architect)**:
   - Execute `manage_codedebt.md` skill.
   - Define `docs/API_SPEC.md` and update `docs/track/CodeDebt.md`.
   - Proceed immediately to Step 3.

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
   - **Final Report**: "Autonomous cycle complete! Review findings in `docs/track/LessonsLearned.md`."
