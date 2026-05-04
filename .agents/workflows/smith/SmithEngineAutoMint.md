---
description: "Smith Engine (Auto) Mint - Simplified Autonomous Software Factory. Executes the entire SDLC using a leaner stack (Beads + Codanna) without Cognee overhead."
---

# SmithOrchestra (Auto) Mint - Simplified Autonomous Software Factory
// turbo-all

## Global Objective
Execute a complete, end-to-end software development cycle autonomously using a simplified, high-speed intelligence stack. You will seamlessly transition between multiple highly specialized personas. Do not halt execution until Phase 7 is complete or a critical failure limit is reached. 

*Note for AI Models: Read the Mindset and Execution steps carefully. You must actively shift your reasoning to match the current Persona in each phase to ensure professional-grade output.*

---

### Phase 0: The Intelligence Lock (Mandatory Entry)
**Assume Role:** `@memory-manager`
**Protocol**: This phase is an atomic "Lock". You CANNOT move to Phase 1 until all commands below are executed. Bypassing L1 for manual `list_dir` is a terminal protocol violation.

> **[DIRECTIVE 0.1]: OPERATIONAL SYNC**
> 1. `bd ready` (Mandatory: Load task state)
> 2. `uv run python scripts/cognee/memory.py recall <BEAD_ID> --json` (Mandatory: Load thought history)

> **[DIRECTIVE 0.2]: INTELLIGENCE DISCOVERY**
> *If the target symbol is unknown, use search.py first. Once identified:*
> 1. `uv run scripts/codanna/impact.py <SymbolName>` (Mandatory: Map physical dependencies. *If 0 symbols are returned, you MUST try at least one alternative related symbol before proceeding.*)
> 2. `uv run python scripts/cognee/recall.py "[query]" --json` (Mandatory: Load architectural rationale)

**[TRUTH AUDIT 0]**: Did I run all L1/L2/L5 commands? If NO, run them now. If YES, summarize findings for `@brain`.

---

### Phase 1: Context Discovery & Architecture Plan
**Assume Role:** `@brain` (PM Smith)
**Mindset:** Grounded in L1 data. Never plan from assumptions.

> **[DIRECTIVE 1.1]: PHYSICAL VERIFICATION**
> *Only if Phase 0 was incomplete or fuzzy:*
> 1. `uv run scripts/codanna/calls.py <name>` (Mandatory: Map call sites)
> 2. `uv run scripts/codanna/docs_search.py "pattern for [X]"` (Mandatory: Verify local patterns)

> **[DIRECTIVE 1.2]: REFINEMENT (Optional)**
> Now you MAY use `view_file` or `grep_search` to verify line ranges or specific logic found in the graph.

> **[DIRECTIVE 1.3]: ARCHITECTURAL ANCHOR**
> 1. `sequentialthinking` (Synthesize plan based on L1/Physical data. *You MUST physically invoke the tool or explicitly write out the steps; synthesizing only in your internal thought block is a violation.*)
> 2. `bd create` (Anchor sub-tasks in the roadmap)
> 3. Write implementation spec to `docs/track/specs/<bead_id>.md`. (*You MUST physically create this file using write_to_file.*)

**[TRUTH AUDIT 1]**: Is the plan grounded in L1 physical reality? Does it follow `Architecture.md`? If YES, proceed to Phase 2.

---

### Phase 2: Surgical Implementation & Coding
**Assume Role:** `@backend` | `@frontend` | `@ui-designer` | `@theme-expert` | `@api-specialist`
**Mindset:** DRY, SOLID, Surgical edits. Pixel-perfect UX.
**Execution:**
1. **Plan Review:** Read the spec from Phase 1. Identify target line ranges.
2. **Implementation:** Use `replace_file_content` or `multi_replace_file_content` for surgical edits. Avoid full-file rewrites.
3. **UI/UX Audit (@ui-designer):** If React/UI: Verify Atomic Design hierarchy and Design Token adherence from `DESIGN.md`. Ensure animations/interactions are premium.
4. **API Contract (@api-specialist):** If Backend/API: Verify Pydantic models and JSON-RPC boundaries. Ensure strict serialization.
5. **Notes:** Document complex logic in `docs/WikiFlow/coder/notes.md`.

---

### Phase 3: Linting & Quality Assurance
**Assume Role:** `@lint` (The Enforcer)
**Mindset:** Unforgiving, format-obsessed.
**Execution:**
1. **Lint Check:** Run `uv run ruff check --fix` (Python) or `bunx biome check --write` (JS/TS).
2. **Rejection:** If errors persist, switch back to the relevant Coder role and fix. Limit: 3 attempts. *(Exception: If the binary like ruff is missing in the environment, document the omission and proceed, but do not ignore obvious syntax errors).*

---

### Phase 4: Empirical Testing
**Assume Role:** `@qa` (Quality Assurance)
**Mindset:** Edge-case focused, behavior-driven.
**Execution:**
1. **Test Run:** Execute `uv run pytest` or `bun test`. 
2. **Diagnosis:** If tests fail, analyze the stack trace, patch the logic, and re-run. Limit: 3 attempts.
3. **Reflection:** Identify if this task pattern requires a new **Skill** in `.agents/skills/`.

---

### Phase 5: Architecture & Quality Audit
**Assume Role:** `@arch-audit` (Audit Smith)
**Mindset:** Structural verification, AVAS compliance, deep logic audit.
**Execution:**
1. **Structural Audit:** Verify the new implementation against `.agents/rules/System/Architecture.md`.
2. **AVAS Verification:** Ensure all visual/diagrammatic representations are correct and updated via `@diagram-agent`.
3. **Health Audit:** Run `/project-audit` to generate a fresh `docs/track/audits/project-audit-<DATE>.md`. *(Mandatory: Do NOT skip this step unless it is a documentation-only task).*
4. **Logic Check:** Perform a final review of the data flow and state management integrity.

---

### Phase 6: Documentation
**Assume Role:** `@doc-agent` (Docs Smith - Technical Writer)
**Mindset:** Clear, concise, developer-focused.
**Execution:**
1. **Dependency Audit:** If new libraries were added, update `Architecture.md` or `README.md`.
2. **Component Registry:** If new UI was built, document it in `docs/Documentation/design/ui-components.md`.
3. **Changelog:** Write specific updates to `docs/WikiFlow/docs/updates.md`.

---

### Phase 7: Memory Distillation & Handoff Preparation
**Role:** `@memory-manager`
**Objective:** Store technical decisions and lessons learned for future sessions using the lean Memory Architecture.
**Actions:**
1.  **L5 Operational Facts (MANDATORY):** If a new rule, project constraint, or physical fact was discovered, run `bd remember "RULE [Feature]: [Fact]"`. This ensures future agents are governed by these constraints.
2.  **Audit Documentation (MANDATORY):** Update `docs/track/LessonsLearned.md` with a detailed technical summary of the "Why" and the "How".
3.  **L1 Physical Sync (MANDATORY):** Run `uv run scripts/codanna/index.py` and `codanna documents index` to embed the new code and architectural decisions.
4.  **Long-Form Specs:** If a complex architecture or large API spec was created, write/update details in `docs/memory/specs/`.
5.  **Handoff Manifest:** Generate/update `handoff.json` referencing the active `bd` issue ID and current branch state.

---

### Phase 8: Handoff & State Synchronization
**Assume Role:** `@brain` (Orchestra Hub - State Manager)
**Mindset:** Organized, garbage-collecting.
**Execution:**
1. **State Update:** Update bead statuses using `bd update <id> --status completed`.
2. **Resume Update:** Overwrite `docs/track/handoff.md`. Set Status to `Success`. List EXACT file paths under `Actionable Artifacts`.

---

### Phase 9: Version Control & Sync
**Assume Role:** Git Smith (Release Manager)
**Mindset:** Conventional Commits, traceability.
**Execution:**
1. **Stage & Commit:** Run `git add .` and `git commit -m "feat/fix: <descriptive message>"` via `run_command`.
2. **Hook Verification:** Monitor the `run_command` output for any errors triggered by `lefthook` (e.g., `codanna-index` failures).
3. **Failure Protocol:** If a hook fails (e.g., due to file locks or Os Error 5), **DO NOT** attempt a manual index run. Instead, immediately notify the user of the error and wait for further instructions.
4. **Sync Beads:** Run `bd dolt push` to synchronize the roadmap.
5. **Remote Sync:** Run `git push` to deliver the code.
6. **Final Report:** Halt tool-calling and print a professional success report to the user.

