---
name: onboarding-setup
description: Standardized project initialization for new Developers or Agents.
---

Assume Role: Orchestra Hub (@scribe)

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

## 🚨 Mandatory Quality Standards
- **Assume Role Header**: Every file you create or edit MUST start with an `Assume Role: <Persona> (@handle)` header.
- **Semantic Commenting**: 
  - Every function MUST include a purpose, the architectural rationale, and a `Ref:` to the relevant spec file.
  - Every non-trivial variable MUST have an inline comment explaining **WHY** it exists.
- **TODO(ID) Protocol**: Any incomplete logic MUST use the strict syntax: 
  `// TODO(ID): [WHAT] ... [WHY] ... [EXPECTATION] ... [CONTEXT] See docs/track/specs/ID.md`
