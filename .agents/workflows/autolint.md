---
description: Automated Lint & Format Loop (Biome + Ruff)
---

# 🔄 Auto-Fix Loop

This workflow enforces project-wide quality standards for both the React frontend and Python sidecar. It automatically attempts to fix all format and linting violations.

// turbo-all
1. **Frontend Pass (Biome)**:
   - Run `bun x @biomejs/biome check --write ./src`
   - *Note*: This applies both formatting and safe lint fixes.

2. **Backend Pass (Ruff)**:
   - Run `uv run ruff check --fix ./sidecar`
   - Run `uv run ruff format ./sidecar`

3. **Validation & Loop**:
   - Run `bun x @biomejs/biome check ./src`
   - Run `uv run ruff check ./sidecar`
   - If any errors remain, analyze the output and perform surgical manual fixes as described in `Quality.md`.
   - Repeat the loop until a "No issues found" status is achieved for both stacks.

4. **Self-Evolution**:
   - If a specific rule is repeatedly violated or causing friction, suggest an update to `.agents/rules/SoftwareStandards.md`.
