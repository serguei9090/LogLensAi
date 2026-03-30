---
trigger: model_decision
description: Mandatory standards for session boot sequence, progress tracking, and documentation management.
---

# Project Tracking & Session Boot Standards

Maintain a clear, professional, and transparent project roadmap and session continuity.

## 1. Mandatory Session "Boot Sequence"
At the start of every new session (detected via `model_decision` or the first user prompt), you MUST perform the following actions before writing a single line of code:
1.  **Read the Roadmap**: Open `docs/track/TODO.md`.
2.  **Read the Handoff**: Open `docs/track/handoff.md` to understand the last session's exit state and blockers.
3.  **Calibrate Internal Plan**: Update your internal "builtin plan task" to match the `TODO.md` exactly.
4.  **Confirm Readiness**: Briefly acknowledge the current state and the "Next Atomic Step" you are about to execute.

## 2. Tracking Files (Index vs. Detail)
- **`TODO.md` (The Index)**: High-level active roadmap. Tracks phases, status (`Backlog`, `In Progress`, `Done`), and high-level milestones. **Avoid massive walls of text here.**
- **`docs/TODOC/task-xxx.md` (The Brain)**: Each complex task in `TODO.md` must have a dedicated detail file. This is where the actual "memory" lives—technical specs, chosen libraries, logic snippets, and implementation constraints.
- **`FeaturesProposal.md`**: Deferred ideas and post-MVP enhancements.
- **`CodeDebt.md`**: Technical debt, refactoring needs, and known bugs.
- **`codegapreview.md`**: Architectural implementation gaps (Audit this using the `code-gap-reviewer` skill).

## 3. Dual-Roadmap Parity Law
- **Sync Requirement**: Your internal execution state MUST be kept in 100% parity with the project's `docs/track/TODO.md`.
- **Status Updates**: After completing any task, update both the internal state and `docs/track/TODO.md` by marking the item as `[x]`. 
- **External Agents (Jules)**: When delegating to external agents, the instruction set MUST explicitly command the agent to update `docs/track/TODO.md` upon completion.
- **Session Wrap-up**: At the end of a session, you MUST execute the `session-handover` skill to generate the next `handoff.md`.

## 3. Directory Integrity
- All tracking files MUST live in `docs/track/`.
- Redundant tracking files in the root or other generic `docs/` folders must be consolidated here and removed.

## 4. Atomic Execution Verifier (STRICT)
To prevent the "Announced but Not Executed" failure mode, the agent MUST adhere to this guardrail:
- **Command Confirmation**: You are FORBIDDEN from reporting a remote process (e.g., Jules, Docker, long-running scripts) as "Started" or "Active" until you have successfully executed the corresponding shell command AND verified its successful output/Session ID.
- **Result Registry**: Every started Jules session MUST have its Session ID and URL immediately registered in the chat and recorded in `docs/track/JULES.md`.
- **Pulse Check**: If a remote task is in progress, the agent MUST run a `jules remote list --session` or equivalent status check at the start of each turn to maintain session awareness.
