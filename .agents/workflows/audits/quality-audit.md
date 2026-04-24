---
name: quality-audit
description: Run Code Quality Checks (Biome/Ruff) for this repository. Writes summary to audits/code_quality_audit.md.
---
Assume Role: QA Smith (@qa)


# Code Quality Audit

## Overview

Run repo quality checks (Biome/Ruff) and capture results in `audits/code_quality_audit.md`.

## Workflow

### 1) Confirm execution intent
- If the user explicitly says not to run lint now, do not execute commands; explain the intended steps only.
- Otherwise, proceed with execution.

### 2) Run lint
- From the repo root, run `[PKG_MANAGER] run lint`.
- **Optimization:** If available, use `[EXECUTE_CMD] @biomejs/biome check --format json` to get a machine-readable output.
- Capture pass/fail summary and any notable warnings or failures.
- If lint runs per workspace (e.g., via Turbo), note each package/workspace result.

### 3) Write audits
- Write a concise summary to `audits/code_lint_audit.md`.
- Write a detailed audit to `audits/code_lint_detailed_audit.md`.
- Keep both reports ASCII-only.
- Summary audit must include:
  - Command run
  - Lint results by package/workspace
  - Notable warnings or failures
- Detailed audit must include:
  - Command run
  - Lint results by package/workspace
  - Full warning/error list
  - A "Fixes Needed" section at the end, with one entry per warning/error:
    - File path
    - Rule name
    - Short description of the change needed

Use these templates:

```md
# Code Lint Audit

Command run:
- `[PKG_MANAGER] run lint`

Lint results:
- <package/workspace>: <summary>

Notes:
- <warnings/failures or "None">
```

```md
# Code Lint Detailed Audit

Command run:
- `[PKG_MANAGER] run lint`

Lint results:
- <package/workspace>: <summary>

Findings:
- <file>:<line>:<col> <rule> <message>

Fixes Needed:
- <file>: <rule> - <what to change>
```

## 🚨 Mandatory Quality Standards
- **Assume Role Header**: Every file you create or edit MUST start with an `Assume Role: <Persona> (@handle)` header.
- **Semantic Commenting**: 
  - Every function MUST include a purpose, the architectural rationale, and a `Ref:` to the relevant spec file.
  - Every non-trivial variable MUST have an inline comment explaining **WHY** it exists.
- **TODO(ID) Protocol**: Any incomplete logic MUST use the strict syntax: 
  `// TODO(ID): [WHAT] ... [WHY] ... [EXPECTATION] ... [CONTEXT] See docs/track/specs/ID.md`
