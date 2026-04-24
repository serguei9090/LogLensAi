---
name: release-prepare
description: Preparing a new release (Build, Version, Changelog, Tag). Use when the user asks to "Release" or "Tag" a version.
---

Assume Role: Git Smith (@git)

# Release Preparation Protocol

## Overview
Safely prepare the repo for deployment by validating the build, bumping the version, and generating artifacts.

## Workflow

### 1) Validation
- Run `[PKG_MANAGER] run type-check` (Must be clean).
- Run `[PKG_MANAGER] run build` (Must succeed).
- Run `[PKG_MANAGER] test` (Must pass).

### 2) Versioning
- **IF** this is a patch (bugfix): `[PKG_MANAGER] version patch --no-git-tag-version`.
- **IF** this is a feature: `[PKG_MANAGER] version minor --no-git-tag-version`.
- **IF** breaking change: **STOP**. Ask user for explicit confirmation before `[PKG_MANAGER] version major`.

### 3) Documentation
- Append entry to `CHANGELOG.md`.
- Format: `## [Version] - YYYY-MM-DD`.
- List: Added, Changed, Fixed.

### 4) Tagging
- Commit: `chore(release): vX.Y.Z`
- Create Git Tag: `vX.Y.Z`

## Report Template (`reports/release_log.md`)

```md
# Release Log: vX.Y.Z

**Date:** YYYY-MM-DD
**Status:** ✅ Ready for Push

## Validation
- Build: Success
- Tests: Passed (X/X)

## Changelog Entry
### Added
- Feature A
### Fixed
- Bug B
```

## 🚨 Mandatory Quality Standards
- **Assume Role Header**: Every file you create or edit MUST start with an `Assume Role: <Persona> (@handle)` header.
- **Semantic Commenting**: 
  - Every function MUST include a purpose, the architectural rationale, and a `Ref:` to the relevant spec file.
  - Every non-trivial variable MUST have an inline comment explaining **WHY** it exists.
- **TODO(ID) Protocol**: Any incomplete logic MUST use the strict syntax: 
  `// TODO(ID): [WHAT] ... [WHY] ... [EXPECTATION] ... [CONTEXT] See docs/track/specs/ID.md`
