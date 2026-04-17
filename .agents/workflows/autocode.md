---
description: Project AutoCode - Evolutionary Surgical Edit Loop
---

// turbo-all
Triggered by `/autocode <task>`. This workflow executes a continuous self-improving loop to achieve 100% requirement fulfillment with minimalist code impact.

## Workflow: [AutoCode]
Execute the following loop for every task `<task>` until verified perfect.

### 1. [PLAN] - Range Discovery
- Scan `.agents/rules/` and `AGENTS.md`.
- Identify exact line ranges for change in the target files.
- Produce an implementation plan in `docs/TODOC/AUTOC-[TASK_ID].md`.

### 2. [CODE] - Surgical Move
- Apply minimalist edits using `replace_file_content` or `multi_replace_file_content`.
- **DRY Constraint**: If logic requires repetitive patterns, branch to `[EVOLVE]`.

### 3. [LINT] - Auto-Fix Standards
- **Frontend**: Run `bun x biome check --write <file>`.
- **Backend**: Run `uv run ruff check --fix <file>`.
- Failure = Return to `[PLAN]` to adjust logic for compliance.

### 4. [TEST] - Empirical Validation
- **Frontend**: Run `bun test`.
- **Backend**: Run `uv run pytest`.
- Failure = Capture logs, self-debug, and restart loop.

### 5. [UX/UI] - Visual Audit
- Audit frontend against `docs/design/theme.md` and `docs/design/ui-components.md`.
- Ensure strict adherence to Atomic Design and hover-state tokens.

### 6. [EVOLVE] - Capability Hardening
- If a task pattern is repetitive: Create or update a **Skill** in `.agents/skills/`.
- Update `docs/track/LessonsLearned.md` with technical insights gained.

### 7. [GIT] - Atomic Commit
- Run `git add .`.
- Commit using: `feat(autocode): [task] surgical update & validation`.

### 8. [VERIFY] - Requirement Check
- Auto-evaluate: "Does this meet 100% of the Documented UX requirements?"
- If No: Loop starts back at `[PLAN]`.
- If Yes: Final Report: "AutoCode Loop Finalized. Task <task> Verified."
