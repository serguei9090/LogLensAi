---
description: Formal workflow for documentation, description, and implementation of new feature requests.
---
# /feature [request]

This workflow standardizes how new capabilities are added to LogLensAi.

## Phase 1: The Spec (Vibe → Research)
1. **Understand**: Antigravity (Chat) analyzes the raw request against `AGENTS.md` and `PRD.md`.
2. **Draft**: Create a specific feature spec in `docs/features/<feature_id>.md`.
3. **Standards**: Ensure the spec includes:
    - **Frontend**: Atomic components needed (Atoms -> Molecules).
    - **Backend**: Pydantic models for the RPC boundary.
    - **Acceptance Criteria**: Gherkin or TDD requirements.

## Phase 2: Approval (Review)
1. **Present**: Share the spec link with the user.
2. **Critique**: User provides feedback or "Approve."
3. **Finalize**: Update `AGENTS.md` if the core contract changes.

## Phase 3: The Plan (Ticketing)
1. **Index**: Add sub-tasks to `docs/track/TODO.md` with unique IDs (e.g., `FEAT-001`).
2. **Memory**: Create `docs/TODOC/<task_id>.md` for implementation details.

## Phase 4: Execution Choice
Select one of the two execution engines:

### Engine A: Antigravity (Interactive Chat)
// turbo
1. **Implement**: Perform the file changes directly in this chat session.
2. **Verify**: Run tests and linting in the background.

### Engine B: Jules (Direct CLI Cycle)
// turbo
1. **Instruct**: Antigravity constructs `docs/jules_instruct.md`.
2. **Launch**: Run the direct CLI command:
   ```powershell
   $prompt = Get-Content docs/jules_instruct.md -Raw ; $prompt | jules new
   ```
3. **Sync**: Once Jules finishes, Antigravity documents the session ID and pulls results via `jules pull`.

## Phase 5: Verification & Lessons Learned
1. **E2E Check**: Verify the feature works in the Tauri desktop environment.
2. **Retrospective**: Update `docs/track/Session_Retrospective.md`.
