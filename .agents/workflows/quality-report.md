---
name: quality-report
description: Run Code Quality Checks (BiomeLint) for this repository. Writes summary to reports/code_quality_report.md.
---

# Code Quality Report

## Overview

Run repo quality checks (Biome) and capture results in `reports/code_quality_report.md`.

## Workflow

### 1) Confirm execution intent
- If the user explicitly says not to run lint now, do not execute commands; explain the intended steps only.
- Otherwise, proceed with execution.

### 2) Run lint
- From the repo root, run `[PKG_MANAGER] run lint`.
- **Optimization:** If available, use `[EXECUTE_CMD] @biomejs/biome check --format json` to get a machine-readable output.
- Capture pass/fail summary and any notable warnings or failures.
- If lint runs per workspace (e.g., via Turbo), note each package/workspace result.

### 3) Write reports
- Write a concise summary to `reports/code_lint_report.md`.
- Write a detailed report to `reports/code_lint_detailed_report.md`.
- Keep both reports ASCII-only.
- Summary report must include:
  - Command run
  - Lint results by package/workspace
  - Notable warnings or failures
- Detailed report must include:
  - Command run
  - Lint results by package/workspace
  - Full warning/error list
  - A "Fixes Needed" section at the end, with one entry per warning/error:
    - File path
    - Rule name
    - Short description of the change needed

Use these templates:

```md
# Code Lint Report

Command run:
- `[PKG_MANAGER] run lint`

Lint results:
- <package/workspace>: <summary>

Notes:
- <warnings/failures or "None">
```

```md
# Code Lint Detailed Report

Command run:
- `[PKG_MANAGER] run lint`

Lint results:
- <package/workspace>: <summary>

Findings:
- <file>:<line>:<col> <rule> <message>

Fixes Needed:
- <file>: <rule> - <what to change>
```
