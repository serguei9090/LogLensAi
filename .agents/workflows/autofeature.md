---
description: Autonomous Feature Implementation (Zero Confirmation)
---

// turbo-all
Triggered by `/autofeature <request>`. Standardizes autonomous implementation of new capabilities.

## Phase 1: The Spec (Vibe → Research)
1. **Understand**: Analyze request against `AGENTS.md`.
2. **Draft**: Create feature spec in `docs/features/<feature_id>.md`.
3. **Index**: Add sub-tasks to `docs/track/TODO.md` and create `docs/TODOC/<task_id>.md`.

## Phase 2: Execution Engine
Perform the file changes directly in this chat session:
1. **Implement**: Perform the file changes directly.
2. **Verify**: Run tests and linting.
3. **Desktop Sync**: Run `bun tauri dev` if UI changed to verify desktop parity.

## Phase 3: Verification & Lessons Learned
1. **E2E Check**: Verify the feature works in the Tauri desktop environment.
2. **Retrospective**: Update `docs/track/LessonsLearned.md` and `docs/track/Session_Retrospective.md`.
3. **Final Report**: "Feature implemented autonomously! Review detailed docs in `docs/features/` and `docs/TODOC/`."
