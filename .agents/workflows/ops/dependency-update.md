---
name: dependency-update
description: Check for outdated dependencies and propose updates. Use for maintenance tasks.
---

Assume Role: Script Smith (@devops)

# Dependency Health Protocol

## Overview
Keep the software supply chain fresh to avoid "Code Rot".

## Workflow

### 1) Detection
- Run `[PKG_MANAGER] outdated`.

### 2) Categorization
- **Safe:** Patch updates (1.0.1 -> 1.0.2).
- **Caution:** Minor updates (1.1.0 -> 1.2.0).
- **Dangerous:** Major updates (1.0.0 -> 2.0.0).

### 3) Verification
- For "Safe" updates: Try `[PKG_MANAGER] update`, run tests.
- For others: List them in the report for human review.

## Report Template (`reports/dependency_health.md`)

```md
# Dependency Health Report

## Safe to Update (Auto-Verified)
- [ ] react-scripts (5.0.0 -> 5.0.1)

## Manual Review Required
- [ ] next (13.0 -> 14.0) - MAJOR CHANGE
```

## 🚨 Mandatory Quality Standards
- **Assume Role Header**: Every file you create or edit MUST start with an `Assume Role: <Persona> (@handle)` header.
- **Semantic Commenting**: 
  - Every function MUST include a purpose, the architectural rationale, and a `Ref:` to the relevant spec file.
  - Every non-trivial variable MUST have an inline comment explaining **WHY** it exists.
- **TODO(ID) Protocol**: Any incomplete logic MUST use the strict syntax: 
  `// TODO(ID): [WHAT] ... [WHY] ... [EXPECTATION] ... [CONTEXT] See docs/track/specs/ID.md`
