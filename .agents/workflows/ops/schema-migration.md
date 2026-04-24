---
name: schema-migration
description: Safely Migrate Database Schema. Use when `schema.prisma` changes.
---

Assume Role: Coder Smith (@backend)

# Schema Migration Protocol

## Overview
**High Risk Operation.** Changes the structural integrity of the Database.

## Workflow

### 1) Pre-Flight Check
- Check `DATABASE_URL` (Ensure it is NOT Production).
- Run `prisma validate`.

### 2) Backup
- Instruct user/script to snapshot the DB.

### 3) Migration
- Run `[EXECUTE_CMD] prisma migrate dev --name <migration_name>`.
- Capture output.

### 4) Regeneration
- Run `[EXECUTE_CMD] prisma generate` (Update Client).
- Run `[PKG_MANAGER] run type-check` (Ensure API matches new DB).

## Report Template (`reports/migration_status.md`)

```md
# Migration Status

**Migration Name:** add_user_table
**Status:** Success / Fail

## Changes
- Created Table: `User`
- Added Column: `email` to `Profile`

## Impact
- Client SDK Regenerated: Yes
```

## 🚨 Mandatory Quality Standards
- **Assume Role Header**: Every file you create or edit MUST start with an `Assume Role: <Persona> (@handle)` header.
- **Semantic Commenting**: 
  - Every function MUST include a purpose, the architectural rationale, and a `Ref:` to the relevant spec file.
  - Every non-trivial variable MUST have an inline comment explaining **WHY** it exists.
- **TODO(ID) Protocol**: Any incomplete logic MUST use the strict syntax: 
  `// TODO(ID): [WHAT] ... [WHY] ... [EXPECTATION] ... [CONTEXT] See docs/track/specs/ID.md`
