---
name: hotfix-protocol
description: Emergency Release Protocol. Use ONLY when Production is broken.
---

# Hotfix Protocol (Emergency)

## Overview
**BREAK GLASS IN CASE OF EMERGENCY.** 
This workflow bypasses standard feature development cycles to ship a critical fix to Production immediately.

## Workflow

### 1) Preparation
- Checkout Main: `git checkout main`
- Pull: `git pull origin main`
- Branch: `git checkout -b hotfix/<issue-id-description>`

### 2) The Fix
- Implement the minimal necessary change.
- **Scope:** Do NOT include refactors or other features.

### 3) Verification
- Run `[PKG_MANAGER] test` (Focus on affected component).
- Run `[PKG_MANAGER] run build` (Ensure it compiles).

### 4) Deployment
- Bump Version: `[PKG_MANAGER] version patch`
- Commit: `fix(hotfix): <description>`
- Push: `git push origin hotfix/...`
- **Merge Strategy:**
    1.  Merge to `main` (Triggers Prod Deploy).
    2.  Merge to `develop` (Syncs fix for next release).

## Report Template (`reports/incident_log.md`)

```md
# Hotfix Incident Report

**Date:** YYYY-MM-DD
**Incident:** #123 (Login Down)
**Fix Version:** v1.0.1 

## Root Cause
- Describe why it broke.

## Resolution
- Describe the fix.
```
