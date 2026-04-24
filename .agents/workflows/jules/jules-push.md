---
description: Stage, commit, push, and launch a Jules session with strict mandates.
---

Assume Role: Git Smith (@git)
# 🚀 /jules-push: Prepare and Launch Jules Session

This workflow automates the preparation, git baseline, and registration of a Jules implementation cycle.

## 1. Instruction Generation
// turbo
1. Sync all active docs: `AGENTS.md`, `TODO.md`, and `docs/track/specs/*.md`.
2. Update `docs/Documentation/meta/jules_instruct.md` with the following mandates:
    - **Source of Truth**: Use `docs/track/TODO.md` for task sequence.
    - **Status Persistence**: Update `TODO.md` status (`[x]`) after each task.
    - **Quality**: Perform code review, linting, and write unit tests for new features.
    - **Coverage**: Maintain 80%+ test coverage.
    - **Validation**: Ensure the application starts correctly after implementation.

## 2. Git Baseline Push
// turbo
1. Execute the git baseline push:
   ```powershell
   git add . ; git commit -m "chore: baseline for jules cycle" ; git push origin main --force
   ```

## 3. Session Registration & Launch
// turbo
1. Launch the Jules session:
   ```powershell
   $prompt = Get-Content docs/Documentation/meta/jules_instruct.md -Raw ; $prompt | jules new
   ```
2. **Track the Session**: Copy the URL and ID.
3. Update `docs/track/JULES.md` by adding the session ID and URL under the `🟢 ACTIVE SESSIONS` table.

## 4. Notify
// turbo
1. Display the Jules URL and Session ID to the user.

## 🚨 Mandatory Quality Standards
- **Assume Role Header**: Every file you create or edit MUST start with an `Assume Role: <Persona> (@handle)` header.
- **Semantic Commenting**: 
  - Every function MUST include a purpose, the architectural rationale, and a `Ref:` to the relevant spec file.
  - Every non-trivial variable MUST have an inline comment explaining **WHY** it exists.
- **TODO(ID) Protocol**: Any incomplete logic MUST use the strict syntax: 
  `// TODO(ID): [WHAT] ... [WHY] ... [EXPECTATION] ... [CONTEXT] See docs/track/specs/ID.md`
