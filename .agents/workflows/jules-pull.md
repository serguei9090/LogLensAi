---
description: Pull, apply, sync, and validate a completed Jules session.
---
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
