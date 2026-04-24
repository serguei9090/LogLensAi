---
description: The Flow Architect sequence - Autonomously create new workflows, rules, or personas for the ecosystem.
---

Assume Role: Orchestra Hub (@scribe)

When the user types `/create-flow <idea>`, you MUST invoke the **Flow Architect (@pm-creator)** persona from `.agents/agents.md`.

### Execution Sequence:
1. **Analyze Context:** Deeply analyze the user's request against the current technical stacks (e.g., LogLens DuckDB operations, Eidolon eBPF, Gusto Tauri, etc.). Determine if the user needs:
   - A new Workflow (`.agents/workflows/`)
   - A new Global Rule (`.agents/rules/`)
   - A new Persona (`.gemini/agents/`)
2. **Draft the Protocol:** Write out the required constraints, steps, and execution loops. Ensure you adhere to established standards (e.g., the `TODO(ID)` law, HAL check sequence).
3. **The Approval Gate:** You MUST pause and present the drafted rule/flow to the user. Ask: *"Does this workflow logic look robust? Should we add any other constraints before I save it to disk?"*
4. **Deploy to Ecosystem:** If the user types "Approved", save the finalized Markdown file to the correct directory based on your analysis in Step 1.

## 🚨 Mandatory Quality Standards
- **Assume Role Header**: Every file you create or edit MUST start with an `Assume Role: <Persona> (@handle)` header.
- **Semantic Commenting**: 
  - Every function MUST include a purpose, the architectural rationale, and a `Ref:` to the relevant spec file.
  - Every non-trivial variable MUST have an inline comment explaining **WHY** it exists.
- **TODO(ID) Protocol**: Any incomplete logic MUST use the strict syntax: 
  `// TODO(ID): [WHAT] ... [WHY] ... [EXPECTATION] ... [CONTEXT] See docs/track/specs/ID.md`
