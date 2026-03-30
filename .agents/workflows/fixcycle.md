---
description: Issue & Fix Pipeline with Dialogue-First Consensus (LogLensAi Edition)
---

This workflow is triggered by `/fixcycle <issue_description>`. It prioritizes architectural consensus and critique before any code is modified.

### Execution Sequence:

1. **Investigative Critique (@critique)**:
   - Identify the reported issue or regression.
   - Perform deep-dive research into the codebase (sidecar, frontend state, DB queries).
   - Review any user-proposed solution.
   - **Critique Requirement**: Respond with:
     - **Confirmation**: If the solution is perfect.
     - **Fine-tuning**: If the solution needs minor adjustments (e.g., better naming, performance tweaks).
     - **Different Approach**: If the solution is logically flawed or architecturally unsound.
   - **MANDATORY**: Present a clear implementation plan before touching code.
   - **Pause**: "Critique complete. Do you agree with this approach? (Consent required to proceed to Step 2)"

2. **Impact Analysis & Spec (@architect)**:
   - Verify the solution aligns with `.agents/rules/Architecture.md` and `.agents/rules/SoftwareStandards.md`.
   - Assign a Unique ID (e.g., `FIX-UX-001`) and create a detail file in `docs/TODOC/`.
   - Update `docs/track/TODO.md` under the "Bug Fixes" section.
   - **Action**: Update `docs/track/Technical_Specification.md` if the fix alters core logic.

3. **Surgical Implementation (@backend | @frontend)**:
   - **Backend Fixes**: Modify `sidecar/src/` ensuring Pydantic validation and thread safety.
   - **Frontend Fixes**: Modify `src/` using Atomic Design and CSS tokens from `docs/design/theme.md`.
   - **Rule**: NO silent changes. Every modification must be linked to the `FIX(ID)`.

4. **Quality Guardrail (@qa)**:
   - Execute `audit_code.md` skill on the changed files.
   - If UI changed, follow `.agents/rules/UIReviewProtocol.md`.
   - Verify fix with reproduction steps and ensure no regressions in `docs/architecture/testing.md`.

5. **Legacy Documentation (@scribe)**:
   - Update `docs/track/LessonsLearned.md` with the root cause and "Preventative Measures" for the future.
   - Close the `TODO(ID)` in `docs/track/TODO.md`.
   - **Final Report**: "Issue resolved! Fix ID: `<ID>` is now part of the codebase. Review `docs/track/LessonsLearned.md` for details."
