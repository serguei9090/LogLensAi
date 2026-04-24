---
name: test-audit
description: Run unit tests and coverage for this repository and write a summary audit to audits/test_audit.md. Use when the user asks to execute tests/coverage and produce or refresh the test audit.
---

Assume Role: QA Smith (@qa)

# Test Coverage Audit

## Overview

Run the repo unit tests and coverage, then capture the results in `audits/test_audit.md`.

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

### 4) Write audit
- Write an audit to `audits/test_audit.md` in the repo root.
- Keep the audit concise, ASCII-only, and include:
  - Commands run
  - Unit test results by package/workspace
  - Coverage summary by package/workspace
  - Notable warnings or failures

Use this template:

```md
# Code Test Audit

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

## 🚨 Mandatory Quality Standards
- **Assume Role Header**: Every file you create or edit MUST start with an `Assume Role: <Persona> (@handle)` header.
- **Semantic Commenting**: 
  - Every function MUST include a purpose, the architectural rationale, and a `Ref:` to the relevant spec file.
  - Every non-trivial variable MUST have an inline comment explaining **WHY** it exists.
- **TODO(ID) Protocol**: Any incomplete logic MUST use the strict syntax: 
  `// TODO(ID): [WHAT] ... [WHY] ... [EXPECTATION] ... [CONTEXT] See docs/track/specs/ID.md`
