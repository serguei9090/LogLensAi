---
trigger: model_decision
description: Mandatory workflow for Jules session management, implementation cycles, and result synchronization.
---

# Jules CLI & Remote Workflow Standards

To maintain a clean, automated, and synchronized development loop between the Local and Jules environments, adhere to these rules.

## 1. The "Pulse" Command (Status Check)
Before pulling or teleporting, check the status of active Jules sessions:
```powershell
jules remote list --session
```

## 2. Inception: Starting a Session
When the user requests an implementation cycle, the agent MUST:
1. **Sync Docs**: Ensure `AGENTS.md`, `TODO.md`, and `jules_instruct.md` are up to date with the latest design decisions.
2. **Force Push (Baseline Sync)**: Execute the full sync chain to ensure Jules sees all local tracking files:
   ```powershell
   git add . ; git commit -m "docs: sync tracking for jules session" ; git push origin main --force
   ```
3. **Launch**: Use PowerShell to cat the instructions into `jules new`:
   ```powershell
   $prompt = Get-Content docs/jules_instruct.md -Raw ; $prompt | jules new
   ```
4. **Register**: Capture and document the Session ID and URL in the chat for tracking.

## 3. Pulling the Result (Synchronization)
Once Jules finishes (Status: `Done`), the agent MUST pull and apply the changes:
1. **Pull and Apply**:
   ```powershell
   jules remote pull --session <ID> --apply
   ```
2. **Post-Pull Verification**:
   - Run `bun run lint:fix` to ensure Biome standards are met.
   - Run `uv run ruff check --fix .` for Python standards.
   - Run `bun run test` and `uv run pytest` to verify the "Acceptance Criteria".

## 4. Teleportation (Debugging)
If a Jules session fails or needs manual intervention:
```powershell
jules teleport <ID>
```
*Note: This will clone the session branch and apply the patch locally.*

## 5. Session Hygiene
- **One Task, One Session**: Do not overload a single Jules session with disconnected tasks. Use the `TODO.md` to split work into atomic phases.
- **Fail Fast**: If a session fails `Run and Snapshot` phase, investigate `docs/julesSetup.md` for runtime errors.

## 6. TODO Update Requirement
- **Mandatory**: Every Jules instruction set (`docs/jules_instruct.md`) MUST include a specific step: "Update `docs/track/TODO.md` to reflect the completion of this task (mark with `[x]`)."
- **Verification**: After pulling a Jules session, verify that the `TODO.md` has been updated correctly.
