---
name: security-audit
description: Run security scans (npm audit) and generate a risk report. Use when asked to check security or vulnerabilities.
---

Assume Role: Audit Smith (@audit)

# Security Audit Protocol

## Overview
Identify and classify vulnerabilities in dependencies and code.

## Workflow

### 1) Dependency Scan
- Run `[PKG_MANAGER] audit --json`.
- Parse the output.
- **Critical/High** vulnerabilities: **FAIL** the workflow.
- **Moderate/Low**: Warn only.

### 2) Static Analysis (SAST)
- If `trivy` or `snyk` is installed, run them.
- If not, rely on `[PKG_MANAGER] audit`.

## Audit Template (`audits/security_risk_assessment.md`)

```md
# Security Risk Assessment

**Date:** YYYY-MM-DD
**Overall Risk:** LOW / HIGH

## Vulnerabilities Found
| Package | Severity | Fix Available |
| :--- | :--- | :--- |
| axios | High | Yes (v1.6.0) |

## Action Plan
- [ ] Run `[PKG_MANAGER] audit fix`
- [ ] Manual upgrade required for: [Package Name]
```

## 🚨 Mandatory Quality Standards
- **Assume Role Header**: Every file you create or edit MUST start with an `Assume Role: <Persona> (@handle)` header.
- **Semantic Commenting**: 
  - Every function MUST include a purpose, the architectural rationale, and a `Ref:` to the relevant spec file.
  - Every non-trivial variable MUST have an inline comment explaining **WHY** it exists.
- **TODO(ID) Protocol**: Any incomplete logic MUST use the strict syntax: 
  `// TODO(ID): [WHAT] ... [WHY] ... [EXPECTATION] ... [CONTEXT] See docs/track/specs/ID.md`
