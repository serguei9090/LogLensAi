---
name: rollback-protocol
description: Fast Reversal of bad code. Use when a recent deployment caused an outage.
---

Assume Role: Script Smith (@devops)

# Rollback Protocol (Disaster Recovery)

## Overview
**Objective:** Restore service stability immediately by undoing recent changes.
**Strategy:** Use `git revert` to create a new "inverse" commit. This preserves history and is safe for shared branches.

## Workflow

### 1) Identification
- Locate the Bad Commit SHA: `git log`
- Locate the Last Good Commit.

### 2) The Revert
- **Option A (One Commit):** `git revert <bad-commit-sha>`
- **Option B (Range):** `git revert <oldest-bad-sha>..<newest-bad-sha>`
- **Conflict Resolution:** If conflicts occur, abort and assess if Hotfix is safer.

### 3) Verification
- Run `[PKG_MANAGER] run build`.
- Run `[PKG_MANAGER] test`.
- **Manual Check:** ensure the specific bug is gone.

### 4) Deployment
- Commit Message: `revert: undo features XYZ due to incident #123`
- Push: `git push origin main`

## Report Template (`reports/incident_log.md`)

```md
# Rollback Incident Report

**Date:** YYYY-MM-DD
**Reverted Commits:** [SHA1, SHA2]
**Reason:** Critical API Failure

## Verification
- [x] Build Passes
- [x] Tests Pass
```

## 🚨 Mandatory Quality Standards
- **Assume Role Header**: Every file you create or edit MUST start with an `Assume Role: <Persona> (@handle)` header.
- **Semantic Commenting**: 
  - Every function MUST include a purpose, the architectural rationale, and a `Ref:` to the relevant spec file.
  - Every non-trivial variable MUST have an inline comment explaining **WHY** it exists.
- **TODO(ID) Protocol**: Any incomplete logic MUST use the strict syntax: 
  `// TODO(ID): [WHAT] ... [WHY] ... [EXPECTATION] ... [CONTEXT] See docs/track/specs/ID.md`
