---
command: /jules-loop
description: Automated Vibe-to-Code Cycle
---
// turbo-all
## Execution Logic
1. **Spec Extraction**: Read the active task in `docs/track/TODO.md` and its detailed spec in `docs/TODOC/<ID>.md`.
2. **TDD Specification**: Create Pure TDD tests with strict typing. AI is faster with pure code definitions than English abstraction parsing.
3. **Snapshot**: `git add . ; git commit -m "pre-jules: [task-id]"`
4. **Push Upstream**: `git push origin HEAD`
5. **Invocation & Record**: `jules remote new --repo . --session "Fulfill task [task-id]" --record`
6. **Autopass Loop**: After Session completion, run relevant test suites. If failures occur, iterate to achieve green status.
7. **Reporting & Merge**: Generate a report detailing changes. Finalize with `git commit -m "jules-complete: [task-id]"` and log success in `docs/track/JULES.md` and `telemetry.csv`.
