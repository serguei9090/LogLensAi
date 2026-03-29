# Jules Active Implementation Mission: [PHASE_NAME]

## 🎯 Primary Objective
[DESCRIPTION_OF_PHASE]

---

## 🏗️ Technical Roles & Architecture Protocols
- **Expert Personas**:
    - **@backend**: DuckDB, Python sidecar, API logic.
    - **@frontend**: React 19, Zustand stores, Atomic UI.
    - **@qa**: TDD enforcement and behavioral validation.
- **Contract-First Flow**: 
    1. Define `Pydantic` models for JSON-RPC.
    2. Write isolated TDD specs (Vitest/Pytest).
    3. Implement concrete logic.
    4. **MANDATORY**: Produce or update `docs/TODOC/` for every change.
- **Quality Mandates**:
    - **Unit Tests**: Every new feature MUST have corresponding unit tests.
    - **Coverage**: Maintain a code coverage of **80%+**.
    - **Code Review**: Perform a self-review of logic and style before finalizing.
    - **Linting**: Run `biome check --fix` and `ruff check --fix` on modified files.
- **Validation**:
    - Ensure the application starts correctly (`npm run dev` or equivalent) after implementation.
- **Design System**: Use `docs/design/theme.md` and `docs/design/ui-components.md`. NO hardcoded hex codes.

---

## 📋 Task List (Atomic Implementation — ONE BY ONE)

### 1. [TASK_NAME_01] (TASK_ID_01)
- **Ref**: `docs/TODOC/<ID>.md`
- **TDD**: Write failing unit tests first.
- **Implementation**: [DETAILED_STEPS]

---

## 🏁 Completion Protocol (Strict)
1. Address **one task at a time** only.
2. After EACH task completion:
    - Run linting and unit tests.
    - Update `docs/track/TODO.md` status (`[x]`).
    - Verify that the application still boots successfully.
3. Commit message format: `feat(<domain>): implemented <TASK_ID> with TDD and specs`.
4. Git stage, commit, and push before starting the next task.
