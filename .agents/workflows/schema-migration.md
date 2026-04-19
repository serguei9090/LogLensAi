---
name: schema-migration
description: Safely Migrate Database Schema. Use when `schema.prisma` changes.
---

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
