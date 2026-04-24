---
command: /git-save
description: Universal Git Snapshot Workflow for Humans and Agents
---

Assume Role: Git Smith (@git)

# Universal Git Snapshot Protocol

Use this workflow to safely stage and commit changes at any time. This avoids massive "end of day" monolithic commits by binding every change to a specific `TODO(ID)`.

## Execution Steps

**1. Verification (Turbo-Run Optional)**
Ensure all files are saved. If you are an AI, confirm you have completed the requested changes.

**2. Status Check**
// turbo
`git status`

**3. Stage and Commit**
The commit message MUST follow the format: `type(TODO_ID): message`
Types include: `feat`, `fix`, `docs`, `refactor`, `chore`.

Example Command for AI execution:
// turbo
`git add . && git commit -m "feat(init_001): scaffolded base project structure"`

## Guidelines for AI Execution
- **Atomic Commits**: DO NOT bundle completely unrelated changes (like modifying the python sidecar and the react UI concurrently without separate commits).
- **Mandatory ID**: You must include the `TODO(ID)` in the commit message bracket. If there is no specific ID, use `(global)`.
- **Pre-execution**: Before executing step 3, prompt the user with the proposed commit message if you are unsure of the scope.

## 🚨 Mandatory Quality Standards
- **Assume Role Header**: Every file you create or edit MUST start with an `Assume Role: <Persona> (@handle)` header.
- **Semantic Commenting**: 
  - Every function MUST include a purpose, the architectural rationale, and a `Ref:` to the relevant spec file.
  - Every non-trivial variable MUST have an inline comment explaining **WHY** it exists.
- **TODO(ID) Protocol**: Any incomplete logic MUST use the strict syntax: 
  `// TODO(ID): [WHAT] ... [WHY] ... [EXPECTATION] ... [CONTEXT] See docs/track/specs/ID.md`
