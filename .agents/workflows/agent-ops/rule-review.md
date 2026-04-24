---
description: Systematic Review and Audit of Project Rules
---

Assume Role: Audit Smith (@audit)

# Rule Revision Workflow (ruleRev)

This workflow defines the procedure for auditing all rules in `.agents/rules/` to ensure they are clear, effective, and correctly applied.

// turbo-all
1. **List Rules**: List all files in `.agents/rules/`.
   - `ls .agents/rules/`

2. **Initialize Audit**: Create a new audit file.
   - Use format: `audits/YYYY-MM-DD-RuleAudit.md`.

3. **Audit Each Rule**: For every rule identified in Step 1:
   - **Read**: Use `view_file` to read the rule's content.
   - **Evaluate**: Assess if the rule is still relevant, if it has caused any issues, and if its instructions are clear.
   - **Propose Updates**: If the rule is unclear or triggers incorrectly, propose and apply an edit.
   - **Document**: Write the evaluation to the report.
     - Include: Rule Name, Evaluation (Good/Bad/Neutral), Action Taken (Updated/No Change).

4. **Finalize**: Ensure the audit is saved and clearly summarizes the state of the project's behavioral standards.
