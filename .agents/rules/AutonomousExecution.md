---
trigger: model_decision
description: Operating standard for the unassisted, recursive AI coding loop.
---

# Autonomous Execution Protocol

When the user initiates a "Sprint", an "Autonomous Execution", or commands a "Loop Request" (e.g., via `/startcycle`, `/autocode`, or explicit instructions to "work in a loop"), the AI must shift into a fully deterministic, self-looping state. The goal is to maximize unassisted output without corrupting the workspace.

## 1. The Autonomous Mandate
You are explicitly authorized and expected to use the `SafeToAutoRun` property (set to `true`) on all standard scaffold, build, lint, test, and git/PR commands (including `gh pr create`) to avoid interrupting the user with confirmation popups.

## 2. The Recursive Loop
For every task in the requested sequence, execute the following strict loop:
1. **Branch Isolation**: Execute `git checkout -b @agent/<task_id>` to isolate the feature.
2. **Context Load**: Open the corresponding documentation or `docs/track/TODO.md` file to understand the boundaries.
3. **Execution**: Run terminal commands and modify files.
4. **Validation**: Run relevant linters and test suites.
5. **Delivery**: 
   - `git commit -m "[task_id]: implement feature"`
   - `git push origin @agent/<task_id>`
   - `gh pr create --fill`
   - **Auto-Merge**: If the PR check passes, merge the branch into `main`.
6. **Task Complete**: Mark the task as `[x]` in `TODO.md` and `JULES.md`.
7. **Iterate**: Immediately move to the next `[ ]` pending task in the queue and repeat from Step 1.

## 3. The 3-Strike Incident Breaker
If during Step 4 (Validation), the compiler or linter throws a fatal error:
*   You are permitted exactly **3 attempts to self-heal** the code.
*   If after 3 attempts the error persists, you **MUST STOP the recursive loop immediately**.
*   You must generate an Incident Report at `docs/reports/incident_<task_id>.md` detailing what broke, what you attempted, and the exact stack trace.
*   Halt execution and await human review. Never commit broken code to a `[x]` completed status.