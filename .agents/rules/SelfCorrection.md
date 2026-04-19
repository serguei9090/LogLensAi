---
trigger: model_decision
description: Mandates a post-task reflection and rule adaptation loop (Auto-improvement).
---

# Auto-Improvement & Self-Correction Protocol

To ensure the AI Agentic Workflow evolves and becomes more efficient over time, agents MUST implement a self-correction loop after every significant task or session.

## 1. Post-Task Reflection
Upon completing a task (especially if it required multiple attempts or self-heal cycles), the agent should evaluate the execution:
- **Success Criteria**: Was the task completed within the expected parameters?
- **Friction Points**: Were there any ambiguous instructions in `.agents/rules/` that led to confusion or errors?
- **Tooling Gaps**: Did the lack of a specific skill or workflow slow down the process?

## 2. Rule Adaptation (The Feedback Loop)
If a friction point is identified:
1.  **Analyze the Cause**: Identify which rule or workflow was insufficient.
2.  **Propose Update**: Formulate a change to the rule to prevent the same friction in the future.
3.  **Implement**: Use the `rule-creator` or direct edits to update `.agents/rules/`.

## 3. Jules Pull Reflection
After pulling a session from **Jules**, the **Antigravity** controller MUST evaluate the diff quality:
- If Jules generated fragile scripts (violating `JulesCLI.md`), the Antigravity controller should update the global Jules prompt configuration or provide a specific "Warning Rule" in the next session.

## 4. Documentation
Record significant auto-improvement actions in `workflow/improvement_log.md` (if applicable) to maintain a history of the framework's evolution.
