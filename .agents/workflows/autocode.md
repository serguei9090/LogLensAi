---
description: Project AutoCode - Evolutionary Surgical Edit Loop
---

// turbo-all
Triggered by `/autocode <task>`. This workflow executes a continuous self-improving loop to achieve 100% requirement fulfillment with minimalist code impact.

## Workflow: [AutoCode]
Execute the following loop for every task `<task>` until verified perfect. **Mandatory: Minimum 3 Iterations.**

### Role Mapping for this Workflow:
- **Planner**: `@pm` (Planning & Verification)
- **Reviewer**: `@critique` (Plan & Final Critique)
- **Builder**: `@backend` | `@frontend` (Implementation)
- **Auditor**: `@qa` (Linting & Testing)
- **Architect**: `@architect` (Evolution & Skill Reflection)
- **Releaser**: `@devops` (Git & Commits)

---

### 1. [PLAN] - Range Discovery (@pm)
- **Role**: `@pm`
- Scan `.agents/rules/` and `AGENTS.md`.
- Identify exact line ranges for change in the target files.
- Produce an implementation plan in `docs/TODOC/AUTOC-[TASK_ID].md`.

### 2. [PLAN-REVIEW] - Critique & Skill Usage (@critique)
- **Role**: `@critique`
- **Plan Critique**: Detailed critique of the `[PLAN]` for logic-domain correctness and edge-case handling.
- **Skill Usage Consideration**: Evaluate if existing skills fit the task. Mandate usage of relevant skills (e.g., `shadcn`, `diagram-creator`).
- **Approval**: Required to proceed to `[CODE]`.

### 3. [CODE] - Surgical Move (@backend | @frontend)
- Apply minimalist edits using `replace_file_content` or `multi_replace_file_content`.
- **DRY Constraint**: If logic requires repetitive patterns or boilerplate, branch to `[EVOLVE]`.

### 4. [LINT] - Auto-Fix Standards (@qa)
- **Frontend**: Run `bun x biome check --write <file>`.
- **Backend**: Run `uv run ruff check --fix <file>`.
- Failure = Return to `[PLAN]` to adjust logic for compliance.

### 5. [TEST] - Empirical Validation (@qa)
- **Frontend**: Run `bun test`.
- **Backend**: Run `uv run pytest`.
- Failure = Capture logs, self-debug, and restart loop.

### 6. [UX/UI] - Visual Audit (@frontend)
- Audit frontend against `docs/design/theme.md` and `docs/design/ui-components.md`.
- Ensure strict adherence to Atomic Design and hover-state tokens.

### 7. [EVOLVE] - Capability Hardening (@architect)
- If a task pattern is repetitive: Create or update a **Skill** in `.agents/skills/`.
- **Post-Evolve Reflection**: Explicitly think: "Do I need to create a new Skill or context script for next time a similar topic/problem arises?" (e.g., when specific context and scripts are required).
- Update `docs/track/LessonsLearned.md` with technical insights gained.

### 8. [GIT] - Atomic Commit (@devops)
- Run `git add .`.
- Commit using: `feat(autocode): [task] surgical update & validation`.

### 9. [VERIFY] - Requirement Check (@pm)
- **3-Iteration Minimum**: The loop MUST execute at least 3 distinct engineering iterations before finalization.
- **Logic Self-Audit**: Explicitly verify if the current implementation matches the *logical domain requirements*.
- **Second Task Review (Post-Finalization)**: Once verified "Yes", perform a mandatory critique of each loop step. Assign proper roles (`@pm`, `@critique`, `@backend`, etc.) and judge their performance.
- Auto-evaluate: "Does this meet 100% of the Documented UX requirements?"
- If No (or Iteration < 3): Loop starts back at [PLAN].
- If Yes AND Iteration >= 3: Final Report: "AutoCode Loop Finalized. Task <task> Verified."

### 10. [SELF-IMPROVE] - Workflow Evolution (@architect)
- **Workflow Audit**: Decided if `autocode.md` needs to be improved with proper role updates or if a new specialized `autocode` flavor should be created for this topic.
