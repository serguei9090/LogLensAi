---
command: /auto-improve
description: Systematic review and adaptation of workflow rules based on recent performance.
---

# /auto-improve Workflow

This workflow is used to prune and sharpen the agentic rules after a session.

## Steps

1. **Review Recent History**
    - Examine the last 3-5 tasks in `docs/track/TODO.md` and `docs/track/JULES.md`.
    - Identify any tasks that required >2 attempts or had "Incident Reports".

2. **Friction & Decay Audit**
    - For identified tasks, use `grep_search` to find the rules that were in scope during execution.
    - Evaluate if the rules were "Low Signal," "High Token Cost," or "Stale."
    - Refer to `.agents/rules/ContextDecay.md` for pruning criteria.

3. **Rule Sharpness & Pruning**
    - **Step A: Sharpness Update**: Propose a single, high-density edit to the most problematic rule to improve token efficiency.
    - **Step B: Pruning**: Identify rules that are "Stale" (no reference in last 20 tasks) and flag them for archiving.
    - **Step C: Archiving**: Move stale rules to `docs/archive/rules/` to reduce active context.

4. **Verify, Apply & Visualize**
    - **Step A: Apply**: Apply the rule update using `replace_file_content`.
    - **Step B: Visualize**: If the change affects the framework structure (e.g., new folder or skill), trigger the `diagram-creator` skill.
    - **Step C: Document**: Update `docs/architecture/triad.md` with a new version of the diagram if necessary.
    - **Step D: Notify**: Notify the user of the framework improvement.
