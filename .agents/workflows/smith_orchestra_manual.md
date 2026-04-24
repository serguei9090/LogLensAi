---
description: "SmithOrchestra (Manual) - The master orchestrator for the WikiFlow software factory. Routes tasks and manages state."
---
# SmithOrchestra (Manual) Workflow
<!-- MANUAL MODE: Ask user for confirmation before proceeding -->

## Objective
Act as the central routing hub, state manager, and garbage collector for the WikiFlow cycle.

## Execution Steps
1. **Prompt Injection:** Read `docs/WikiFlow/handoff_resume.md`. If the status is `Idle`, capture the user's initial prompt, write it into the `Master Objective` section, change the status to `In Progress`, and set the route to `wk_pm_smith_manual` (or brainstorm if unclear).
2. **Garbage Collection:** Check the `Feedback & Error Trace` section. If it is massive (over 50 lines) and the status is now `In Progress` or `Success`, truncate/summarize it to prevent token bloat.
3. **Determine Next Route:** Evaluate the 'Next Suggested Routing' and 'Status'. 
   - *Rejection Loop:* If 'Status' is `Failed`, override forward routing and route BACK to the Coder (or whoever is responsible for the fix).
4. **Update History:** Log the routing decision to `docs/WikiFlow/orchestra/route_history.log`.
5. **Invoke Next Workflow:** Use the appropriate slash command to call the next sub-agent (e.g., `/wk_pm_smith_manual`). If the cycle is complete (`Status: Success` from Git), print a final summary and halt.
