---
description: "Code Linter & Formatter (Manual) - WikiFlow sub-agent workflow."
---
# Code Linter & Formatter (Manual) Workflow
<!-- MANUAL MODE: Ask user for confirmation before proceeding -->

## Objective
Execute the responsibilities of the Code Linter & Formatter with professional-grade context awareness.

## Execution Steps
1. **Context Discovery:** Read `docs/WikiFlow/handoff_resume.md` to understand the Master Objective and Actionable Artifacts. Before writing code or specs, you MUST read relevant project rules (e.g., `AGENTS.md`) and use `grep_search` or `view_file` to understand existing codebase patterns.
2. **Execute Task:** Perform the required Code Linter & Formatter duties. Document your localized reasoning in `docs/WikiFlow/lint/`.
3. **Write Resume:** Overwrite `docs/WikiFlow/handoff_resume.md`.
   - **Rejection Loop:** If you find errors, bugs, or failing tests, DO NOT fix them yourself. Change Status to `Failed`, paste the exact terminal output into the `Feedback & Error Trace`, and set Next Routing back to the responsible Coder.
   - Update the Status (`In Progress`, `Success`, or `Failed`).
   - Set the `Next Suggested Routing`.
4. **Return to Hub:** Invoke `/smith_orchestra_manual` to hand control back to the Orchestra.
