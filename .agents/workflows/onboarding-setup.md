---
name: onboarding-setup
description: Standardized project initialization for new Developers or Agents.
---

# Onboarding Protocol

## Overview
Get from "git clone" to "running app" in under 5 minutes.

## Workflow

### 1) Dependencies
- Run `[PKG_MANAGER] install` (Clean Install from lockfile).
- **If failure:** Verify lockfile integrity or delete node_modules and retry.

### 2) Environment
- Check if `.env` exists.
- If not: `cp .env.example .env`.
- **Action:** Ask user for any secret keys if strictly required.

### 3) Infrastructure (Optional)
- If `docker-compose.yml` exists: `docker-compose up -d`.
- If `schema.prisma` exists: `[EXECUTE_CMD] prisma generate`.

### 4) Verification
- Run `[PKG_MANAGER] test` (Sanity Check).
- Run `[PKG_MANAGER] run dev` (Start Server).

## Success Criteria
- [ ] Dependencies installed.
- [ ] Server starts on `localhost:3000`.
- [ ] Tests pass.
