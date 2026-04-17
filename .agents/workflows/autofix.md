---
description: Autonomous Issue & Fix Pipeline (Zero Confirmation)
---

// turbo-all
This workflow is triggered by `/autofix <issue_description>`. Use this to fix bugs and regressions without waiting for manual plan approval.

### Execution Sequence:

1. **Investigative Critique (@critique)**:
   - Identify the reported issue or regression.
   - Perform deep-dive research into the codebase.
   - Propose the most optimal solution and proceed immediately to implementation.

2. **Impact Analysis & Spec (@architect)**:
   - Verify alignment with `Architecture.md`.
   - Assign a Unique ID (e.g., `FIX-UX-001`) and create `docs/TODOC/`.
   - Update `docs/track/TODO.md`.

3. **Surgical Implementation (@backend | @frontend)**:
   - **Backend**: Modify `sidecar/src/` with pydantic validation.
   - **Frontend**: Modify `src/` using Atomic Design.
   - Link all changes to the `FIX(ID)`.

4. **Quality Guardrail (@qa)**:
   - Execute `audit_code.md` skill on changed files.
   - Verify fix with reproduction steps and ensure no regressions.

5. **Legacy Documentation (@scribe)**:
   - Update `docs/track/LessonsLearned.md`.
   - Close the `TODO(ID)`.
   - **Final Report**: "Issue resolved autonomously! Fix ID: `<ID>` is now part of the codebase."
