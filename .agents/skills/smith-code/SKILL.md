---
name: smith-code
description: Specialized skill for executing code changes, writing specifications, and managing the task lifecycle via bd (beads) and Codanna. Use when implementing code features, writing implementation specs, or performing deep codebase investigations before writing code.
---

<persona_activation>
<objective>Every phase MUST run under an explicit persona loaded from this skill's persona library.</objective>
<rules>
1. **Use Phase Persona:** Use the single `@role` listed in the current phase's **Assume Role** line.
2. **Load Definition:** Before executing phase steps, read the matching file from `.agents/skills/smith-code/references/personas/`.
3. **Load Persona Rules:** Read the persona's required rules before acting. Conditional rules are loaded only when their trigger matches the task.
4. **Assume Exactly:** Follow the persona's mindset, responsibilities, constraints, handoff rules, required rules, and expertise laws for the duration of that phase.
5. **Implementation Exception:** Only `phase_1` may select from multiple personas. Choose the best implementation persona for the task, then read that persona file before editing.
6. **Switch Deliberately:** When moving to a new phase or a better-fit implementation role, read the new persona file and its required rules before continuing.
7. **No Missing Persona:** If the matching persona file is absent, stop the phase and report the missing file instead of inventing the role.
8. **Anti-Hallucination:** You are strictly forbidden from summarizing or assuming a persona's definition based on its name. You MUST read the actual persona file content to 'Activate' it.
</rules>
<persona_map>
- `@api-specialist` -> `.agents/skills/smith-code/references/personas/p_api-specialist.md`
- `@backend` -> `.agents/skills/smith-code/references/personas/p_backend.md`
- `@docs` -> `.agents/skills/smith-code/references/personas/p_docs.md`
- `@frontend` -> `.agents/skills/smith-code/references/personas/p_frontend.md`
- `@git` -> `.agents/skills/smith-code/references/personas/p_git.md`
- `@pm` -> `.agents/skills/smith-code/references/personas/p_pm.md`
- `@ui-designer` -> `.agents/skills/smith-code/references/personas/p_ui-designer.md`
</persona_map>
</persona_activation>

<task_sizing>
<objective>Choose the smallest workflow that handles the request safely.</objective>
<rules>
1. **Default to Lightweight:** Use `<lightweight_path>` when the request is a small, direct edit or bug fix.
2. **Escalate to Full SDLC:** Use `<phase_0>` through `<phase_3>` when the task crosses any full-SDLC trigger.
3. **Do Not Mix Paths:** Once a path is selected, follow that path unless new facts reveal higher risk.
4. **Escalate Immediately:** If lightweight work uncovers architectural impact, unclear requirements, or broad risk, stop lightweight execution and enter `<phase_0>`.
</rules>
<lightweight_criteria>
- One or two files are expected to change.
- Requirements are clear enough to implement without a formal spec.
- No schema, migration, authentication, authorization, or public API contract changes are expected.
- No broad refactor, dependency upgrade, or cross-module architecture change is expected.
- The user asks for a direct fix, small edit, text update, or localized behavior change.
</lightweight_criteria>
<full_sdlc_triggers>
- New feature work or multi-step product behavior.
- More than two files are expected to change.
- Data model, database, API contract, auth, security, deployment, or CI behavior may change.
- The request is ambiguous enough to require planning or user-facing tradeoff decisions.
- The change needs a durable implementation spec, handoff, lesson, or commit protocol.
- The user explicitly asks for full lifecycle, planning, issue tracking, audit, or commit work.
</full_sdlc_triggers>
</task_sizing>

<lightweight_path>
<objective>Handle small, low-risk edits without the full bd/spec/handoff workflow.</objective>
**Assume Role:** `@backend` | `@frontend` | `@ui-designer` | `@api-specialist` | `@docs`
<steps>
1. **Activate Persona:** Select the best-fit persona for the edit, read its matching file from `.agents/skills/smith-code/references/personas/`, then read its required rules.
2. **Inspect Context:** Read the relevant files and search only as much as needed to avoid guessing.
3. **Make Focused Edit:** Change only the files required for the requested fix.
4. **Focused Verification:** Run the smallest useful check available for the touched surface, such as syntax check, unit test, linter, or markdown inspection.
5. **Escalation Check:** If the edit reveals broader impact, stop and continue through `<phase_0>` using the full SDLC path.
6. **Report:** Summarize changed files, verification performed, and any residual risk.
</steps>
</lightweight_path>

<phase_0>
<objective>Collect facts and write implementation specification.</objective>
**Assume Role:** `@pm`
<steps>
1. **Activate Persona:** Read `.agents/skills/smith-code/references/personas/p_pm.md` and its required rules before executing any other step.
2. **Check Open Tasks:** Execute `bd ready` to check for currently open tasks related to the request.
3. **Context Gathering:**
   - **Prioritize Tools:** Prioritize `impact.py` over `read_file`. Use `read_file` only to inspect the specific lines flagged by `impact.py`.
   - **Execution:**
     - *If you have context for the file to be edited:*
       - Run `docs_search.py` to search indexed `docs/` for relevant codebase info.
       - Run `codanna search`.
       - Run `impact.py` (**MANDATORY**).
       - Decide whether to run `callers.py` and `calls.py` based on the impact results (Optional, Model Defined).
     - *If you lack context:*
       - List files in the relevant folder.
       - Ask Codanna to determine what will be impacted by the potential changes.
4. **Sequential Thinking:** Once you have gathered 95%+ confidence in your understanding, use the **mcp sequentialthinking** tool to:
   - Organize and summarize the task and request.
   - Identify which files will be edited.
   - Identify which functions will be impacted.
   - Detail the updates needed.
5. **Issue & Spec Creation:**
   - Create a new `bd` issue.
   - Write the implementation spec to `docs/track/specs/<bead_id>.md`.
     - *Note:* All `.md` files MUST be generated or copied from templates located in `.agents/skills/smith-code/references/templates/`.
   - Execute `bd comment <issue_id> <path_to_bead_id.md>` to link the spec to the issue for future reference.
</steps>
</phase_0>

<phase_1>
<objective>Code implementation and inline documentation.</objective>
**Assume Role:** `@backend` | `@frontend` | `@ui-designer` | `@api-specialist`
<steps>
1. **Activate Persona:** Select the best-fit implementation role, then read its matching file from `.agents/skills/smith-code/references/personas/` and its required rules before editing code.
2. **Execute Coding:** Implement the required changes.
3. **Micro-decisions:** Immediately save any micro-decisions or mid-task discoveries using `bd remember`.
4. **Complex Logic:** Document complex logic decisions in `docs/WikiFlow/coder/notes.md`.
</steps>
</phase_1>

<phase_2>
<objective>Wrap-up, knowledge storage, and handoff.</objective>
**Assume Role:** `@docs`
<steps>
1. **Activate Persona:** Read `.agents/skills/smith-code/references/personas/p_docs.md` and its required rules before updating documentation or memory.
2. **Knowledge Storage:** Store technical decisions and lessons learned.
   - If a new rule, project constraint, or physical fact was discovered, run: `bd remember "RULE [Feature]: [Fact]"`.
3. **Update Lessons Learned:** Document a detailed technical summary of the "Why" and the "How" in `docs/track/LessonsLearned.md`.
4. **State Update:** Update the bead status by running `bd update <id> --status completed`.
5. **Handoff Manifest:** Generate or update `docs/track/handoff.md`. Ensure the Status .agents/skills/smith-code the active `bd` issue ID and current branch state.
</steps>
</phase_2>

<phase_3>
<objective>Version control commit.</objective>
**Assume Role:** `@git`
<steps>
1. **Activate Persona:** Read `.agents/skills/smith-code/references/personas/p_git.md` and its required rules before verification or commit work.
2. **Verification:** Verify all required artifacts (specs, handoff manifest, updated lessons) are present.
3. **Atomic Commit:** Use the `bd` context to construct a meaningful commit message referencing `<BEAD_ID>` and commit the changes via git.
</steps>
</phase_3>

<checklist>
- [ ] Did you choose `<lightweight_path>` or full SDLC using `<task_sizing>`?
- [ ] Did you select a phase role and read its matching file from `.agents/skills/smith-code/references/personas/` before acting?
- [ ] **Anti-Hallucination:** Did you read the actual persona file content instead of assuming or summarizing its role?
- [ ] Did you read the selected persona's required rules before acting?
- [ ] Did you use `bd ready` to check for open tasks?
- [ ] **Tool Priority:** Did you prioritize `impact.py` over `read_file` during context gathering?
- [ ] Did you execute `impact.py` during context gathering (Mandatory)?
- [ ] Did you reach 95%+ confidence and use `mcp sequentialthinking` to summarize?
- [ ] Did you create a `bd` issue and link it using `bd comment`?
- [ ] Was the implementation spec saved to `docs/track/specs/<bead_id>.md` using a template from `.agents/skills/smith-code/references/templates/`?
- [ ] Were micro-decisions stored via `bd remember`?
- [ ] Was complex logic documented in `docs/WikiFlow/coder/notes.md`?
- [ ] Were new rules/facts recorded via `bd remember "RULE [Feature]: [Fact]"`?
- [ ] Is `docs/track/LessonsLearned.md` updated with the Why and How?
- [ ] Was the bead status updated to `completed`?
- [ ] Is the handoff manifest updated in `docs/track/handoff.md`?
- [ ] Did you execute the Git commit referencing the bead ID?
</checklist>
