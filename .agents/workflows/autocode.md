---
description: Project AutoCode - Evolutionary Surgical Edit Loop
---

// turbo-all
Triggered by `/autocode <task>`. This workflow executes a continuous self-improving loop to achieve 100% requirement fulfillment with minimalist code impact.

## Workflow: [AutoCode]
Execute the following loop for every task `<task>` until verified perfect. **Mandatory: Minimum 3 Iterations.**

### Role Mapping for this Workflow:
- **Planner**: `@pm` (Planning & Requirement Check)
- **Reviewer**: `@critique` (Plan & Final Task Critique)
- **Builder**: `@backend` | `@frontend` (Implementation & UX Audit)
- **Auditor**: `@qa` (Linting & Testing Validation)
- **Architect**: `@architect` (System Evolution & Standards)
- **Releaser**: `@devops` (Git & Atomic Commits)
- **Historian**: `@scribe` (Lessons Learned & Skill Discovery)

---

### 1. [PLAN] - Range Discovery (@pm)
- **Role**: `@pm`
- Scan `.agents/rules/` and `AGENTS.md` for context.
- Identify exact line ranges for change in the target files.
- Propose necessary skills or tools for the task.
- Produce an implementation plan in `docs/TODOC/AUTOC-[TASK_ID].md`.

### 2. [PLAN-REVIEW] - Critique & Skill Check (@critique)
- **Role**: `@critique`
- **Plan Critique**: Detailed critique of the `[PLAN]` for logic-domain correctness and edge-case handling.
- **Skill Usage Validation**: Evaluate if the proposed skills (or missing ones) fit the task. Mandate usage of relevant skills (e.g., `shadcn`, `mcp-builder`).
- **Approval**: Required to proceed to `[CODE]`.

### 3. [CODE] - Surgical Move (@backend | @frontend)
- **Role**: `@backend` | `@frontend`
- Apply minimalist edits using `replace_file_content` or `multi_replace_file_content`.
- **DRY Constraint**: If logic requires repetitive patterns, flag for `[EVOLVE]`.

### 4. [LINT] - Auto-Fix Standards (@qa)
- **Role**: `@qa`
- **Frontend**: Run `bun x biome check --write <file>`.
- **Backend**: Run `uv run ruff check --fix <file>`.
- Failure = Return to `[PLAN]` to adjust logic for compliance.

### 5. [TEST] - Empirical Validation (@qa)
- **Role**: `@qa`
- **Frontend**: Run `bun test`.
- **Backend**: Run `uv run pytest`.
- Failure = Capture logs, self-debug, and restart loop.

### 6. [UX/UI] - Visual Audit (@frontend)
- **Role**: `@frontend`
- Audit frontend against `docs/design/theme.md` and `docs/design/ui-components.md`.
- Ensure strict adherence to Atomic Design hierarchy and design tokens.

### 7. [EVOLVE] - Capability Hardening (@architect)
- **Role**: `@architect`
- If a task pattern is repetitive: Identify target for a new **Skill** in `.agents/skills/`.
- Verify architectural alignment with `Architecture.md`.

### 8. [REFLECT] - Knowledge Distillation (@scribe)
- **Role**: `@scribe`
- **Skill Creation Thinking**: Decide if a new Skill or context script should be created for next time a similar topic/problem arises (context/script reuse).
- **Lessons Learned**: Update `docs/track/LessonsLearned.md` with technical insights gained during this iteration.

### 9. [GIT] - Atomic Commit (@devops)
- **Role**: `@devops`
- Run `git add .`.
- Commit using: `feat(autocode): [task] surgical update & validation`.

### 10. [CRITIQUE-FINAL] - Task Double-Check (@critique)
- **Role**: `@critique`
- **Step Critique**: Detailed critique of each loop step (1-9) to identify friction or logic gaps.
- **Role Verification**: Verify if each persona properly executed their responsibilities.

### 11. [VERIFY] - Requirement Check (@pm)
- **Role**: `@pm`
- **3-Iteration Minimum**: The loop MUST execute at least 3 engineering iterations before finalization.
- **Auto-evaluate**: "Does this implementation meet 100% of the Documented LUX/Code requirements?"
- If No (or Iteration < 3): Loop starts back at [PLAN].
- If Yes AND Iteration >= 3: Final Report: "AutoCode Loop Finalized. Task <task> Verified."

### 12. [SELF-IMPROVE] - Workflow Evolution (@architect)
- **Role**: `@architect`
- **Workflow Audit**: Decide if `autocode.md` needs role refinement, new steps, or if a specialized version is required for this specific task domain.
