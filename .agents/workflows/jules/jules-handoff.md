---
description: jules-handoff - Triggers the jules CLI for asynchronous task processing and syncing results.
---

Assume Role: Git Smith (@git)

For detailed information on Jules CLI commands and usage guidelines, refer to the [Jules CLI Documentation & Rules](../../.agents/rules/JulesCLI.md).

1. **Verify Local State**: Ensure your local build artifacts are up-to-date if Jules needs them.
2. **Commit Current Work**:
// turbo
`git add . ; git commit -m "chore: Local changes before handoff"`
3. **Push Upstream**:
// turbo
`git push origin HEAD`
4. **Trigger the Session**:
```powershell
jules remote new --repo . --session "<Insert task description here>" --record
```
5. **Monitor Status**:
```powershell
jules remote list --session
```
6. **Inspect the Result**:
```powershell
jules remote pull --session <ID>
```
7. **Apply the Patch**:
// turbo
`jules remote pull --session <ID> --apply`
8. **Log State**: Update `docs/track/JULES.md` with the new State/Branch info.
9. **Verification**: Run relevant project verification steps.

## 🚨 Mandatory Quality Standards
- **Assume Role Header**: Every file you create or edit MUST start with an `Assume Role: <Persona> (@handle)` header.
- **Semantic Commenting**: 
  - Every function MUST include a purpose, the architectural rationale, and a `Ref:` to the relevant spec file.
  - Every non-trivial variable MUST have an inline comment explaining **WHY** it exists.
- **TODO(ID) Protocol**: Any incomplete logic MUST use the strict syntax: 
  `// TODO(ID): [WHAT] ... [WHY] ... [EXPECTATION] ... [CONTEXT] See docs/track/specs/ID.md`
