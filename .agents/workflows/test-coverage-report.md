---
name: test-coverage-report
description: Run unit tests and coverage for this repository ([PKG_MANAGER] test, [PKG_MANAGER] run test:coverage) and write a summary report to reports/code_test_report.md. Use when the user asks to execute tests/coverage and produce or refresh the test report.
---

# Test Coverage Report

## Overview

Run the repo unit tests and coverage, then capture the results in `reports/code_test_report.md`.

## Workflow

### 1) Confirm execution intent
- If the user explicitly says not to run tests now, do not execute commands; explain the intended steps only.
- Otherwise, proceed with execution.

### 2) Run unit tests
- From repo root, run `[PKG_MANAGER] test`.
- Capture pass/fail summary and any notable warnings.

### 3) Run coverage
- From repo root, run `[PKG_MANAGER] run test:coverage`.
- **Optimization:** Ensure the `text-summary` reporter is used (if supported) to get a concise console output, or parse the `reports/coverage/index.html` if available.
- Capture coverage summaries for each workspace/package and any failures.
- Code Coverage acceptance criteria is > 80%

### 4) Write report
- Write a report to `reports/code_test_report.md` in the repo root.
- Keep the report concise, ASCII-only, and include:
  - Commands run
  - Unit test results by package/workspace
  - Coverage summary by package/workspace
  - Notable warnings or failures

Use this template:

```md
# Code Test Report

Commands run:
- `[PKG_MANAGER] test`
- `[PKG_MANAGER] run test:coverage`

Unit test results:
- <package/workspace>: <summary>

Coverage results:
- <package/workspace>: <statements/branches/functions/lines>

Notes:
- <warnings/failures or "None">
```
