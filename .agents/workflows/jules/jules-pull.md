---
description: Pull, apply, sync, and validate a completed Jules session.
---

Assume Role: Git Smith (@git)
# 📥 /jules-pull: Pull and Apply Jules Session

This workflow automates the retrieval, application, and environment syncing of a finished Jules implementation cycle.

## 1. Remote Pull & Apply
// turbo
1. Execute the remote pull (replace `<ID>` with the session ID):
   ```powershell
   jules remote pull --session <ID> --apply
   ```

## 2. Environment Sync
// turbo
1. Sync Python and JS environments:
   ```powershell
   uv sync ; bun install
   ```

## 3. Post-Pull Validation
// turbo
1. Run automated linting:
   ```powershell
   bun run lint:fix
   ```
2. Update `docs/track/JULES.md` by moving the session ID from `🟢 ACTIVE SESSIONS` to `⏺️ COMPLETED SESSIONS`.

## 4. Notify
// turbo
1. Notify the user that the session has been successfully integrated and synchronized.

## 🚨 Mandatory Quality Standards
- **Assume Role Header**: Every file you create or edit MUST start with an `Assume Role: <Persona> (@handle)` header.
- **Semantic Commenting**: 
  - Every function MUST include a purpose, the architectural rationale, and a `Ref:` to the relevant spec file.
  - Every non-trivial variable MUST have an inline comment explaining **WHY** it exists.
- **TODO(ID) Protocol**: Any incomplete logic MUST use the strict syntax: 
  `// TODO(ID): [WHAT] ... [WHY] ... [EXPECTATION] ... [CONTEXT] See docs/track/specs/ID.md`
