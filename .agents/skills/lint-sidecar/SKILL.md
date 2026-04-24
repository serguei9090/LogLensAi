# Skill: Lint Sidecar

## Objective
Your goal as the Backend Engineer or DevOps Master is to ensure the `sidecar/` directory maintains 100% compliance with `ruff` linting and formatting standards.

## Rules of Engagement
- **Target Context**: The `sidecar/src/` and `sidecar/tests/` directories.
- **Execution Tool**: Use `uv run ruff` for all operations.
- **Self-Correction Step**: Always run `ruff check --fix` before `ruff format` to ensure formatting is applied to the final, fixed code.

## Instructions
1.  **Environment Check**: Verify that `uv` is installed and the sidecar project is initialized (`uv sync`).
2.  **Lint & Fix**: Execute `uv run ruff check sidecar/src --fix` and `uv run ruff check sidecar/tests --fix`.
3.  **Format**: Execute `uv run ruff format sidecar/src` and `uv run ruff format sidecar/tests`.
4.  **Verification**: Run a final `uv run ruff check sidecar/src` (without `--fix`) to verify all issues are resolved.
5.  **Reporting**: List any unresolved lint errors or warnings for further manual correction.
