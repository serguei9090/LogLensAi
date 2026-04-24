# Task Memory: ACCEL-001 - Implement `lint-sidecar` Skill

## 🎯 Objective
Create a specialized agent skill to run Ruff linting and auto-fix on the sidecar backend to ensure high code quality with zero manual overhead.

## 🏗️ Technical Specification

### 1. Skill Definition
- **Name**: `lint-sidecar`
- **Location**: `.agents/skills/lint-sidecar.md`
- **Trigger**: Manual or via `/autostartcycle`.

### 2. Execution Logic
The skill should perform the following steps:
1.  **Environment Check**: Verify `uv` is available.
2.  **Lint Pass**: Run `uv run ruff check sidecar/src --fix`.
3.  **Format Pass**: Run `uv run ruff format sidecar/src`.
4.  **Reporting**: Summarize any fixed issues or remaining violations.

### 3. Integration
- The `autostartcycle.md` workflow should be updated to call this skill after the Backend Engineer phase.

## ✅ Definition of Done
- [x] `.agents/skills/lint-sidecar.md` created with clear instructions.
- [x] Skill verified by running it on the current `sidecar/src` directory.
- [x] Workflow `.agents/workflows/autostartcycle.md` updated to include the skill.
