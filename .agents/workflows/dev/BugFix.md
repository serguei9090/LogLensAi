---
description: Unified Bug Fixing Pipeline with optional Consensus and Autonomous modes.
---

# 🐞 BugFix Pipeline (`/bugfix`)
> **Assume Role:** `@critique` (Investigative Auditor)

This workflow provides a standardized procedure for identifying, specifying, and fixing bugs. It supports two execution modes:
- **Autonomous Mode (--yolo)**: Zero-confirmation fix.
- **Consensus Mode (default)**: Requires user approval of the plan before implementation.

---

## Phase 1: Investigation & Root Cause
**Assume Role:** `@critique` (Investigative Auditor)
1. **Analyze**: Identify the reported issue or regression.
2. **Research**: Perform deep-dive research into the codebase (sidecar, frontend, DB queries).
3. **Reproduction**: (Mandatory) Write a failing unit test or script that demonstrates the bug.
4. **Propose**: 
   - If **Autonomous**: State the solution and proceed to Phase 2.
   - If **Consensus**: Present the plan and wait for "Approve".

---

## Phase 2: Specification & Tracking
**Assume Role:** `@pm` (Product Manager)
1. **Spec**: Assign a Unique ID (e.g., `FIX-001`) and create `docs/track/specs/FIX-001.md`.
2. **Index**: Update `docs/track/TODO.md` under the "Bug Fixes" section.
3. **Rules**: Identify any architectural rules (`Architecture.md`) that were violated.

---

## Phase 3: Implementation Engine
**Assume Role:** `@backend` | `@frontend` | `@ui-designer`
**Action**: Execute the **[AutoCode Engine](file:///i:/01-Master_Code/General/MasterPrompts/.agents/workflows/Autonomous/AutoCode.md)** for surgical implementation of the fix.

> [!IMPORTANT]
> Every modification MUST be linked to the `FIX(ID)` in comments. NO silent changes.

---

## Phase 4: Quality & Regression Audit
**Assume Role:** `@qa` (Quality Assurance)
1. **Lint**: Run `bun x biome check --write` and `uv run ruff check --fix`.
2. **Test**: Execute the reproduction test from Phase 1. Ensure it passes.
3. **Audit**: Run `/project-audit` to ensure no architectural regressions.
4. **AVAS**: Update any diagrams via `@diagram-agent` if the fix altered data flow.

---

## Phase 5: Handoff & Evolution
**Assume Role:** `@docs` (Technical Writer)
1. **Lessons**: Update `docs/track/LessonsLearned.md` with the root cause and preventative measures.
2. **Close**: Mark the `TODO(ID)` as complete.
3. **Report**: Provide a final summary of the fix and the impact.
