# 🎭 Role-Workflow Alignment Audit (April 2026)

**Objective**: Ensure every workflow file has a designated persona from `agents.md` and that the "Assume Role" headers are correctly formatted for high-performance AI execution.

## 📊 Summary Table

| Category | Workflow | Persona Tag | Status | Action |
|---|---|---|---|---|
| **Orchestration** | `commander.md` | `@pm` | ✅ Done | |
| **Agent Ops** | `adapt-project.md` | `@scribe` | ✅ Done | |
| **Agent Ops** | `auto-improve.md` | `@scribe` | ✅ OK | |
| **Agent Ops** | `create-flow.md` | `@scribe` | ✅ Done | |
| **Agent Ops** | `onboarding-setup.md` | `@scribe` | ✅ OK | |
| **Agent Ops** | `rule-review.md` | `@scribe` | ✅ OK | |
| **Agent Ops** | `self-evolve.md` | `@scribe` | ✅ OK | |
| **Agent Ops** | `skill-writer.md` | `@scribe` | ✅ OK | |
| **Development** | `design-sync.md` | `@theme-expert` | ✅ Done | |
| **Development** | `feature.md` | `@pm` | ✅ OK | |
| **Development** | `gemini-delegate.md` | `@pm` | ✅ Done | |
| **Development** | `issue-writer.md` | `@pm` | ✅ OK | |
| **Jules CLI** | `jules-cycle.md` | `@git` | ✅ OK | |
| **Jules CLI** | `jules-delegate.md` | `@pm` | ✅ Done | |
| **Jules CLI** | `jules-handoff.md` | `@git` | ✅ OK | |
| **Jules CLI** | `jules-pull.md` | `@git` | ✅ OK | |
| **Jules CLI** | `jules-push.md` | `@git` | ✅ OK | |
| **Operations** | `create-ci.md` | `@devops` | ✅ Done | |
| **Operations** | `dependency-update.md` | `@devops` | ✅ OK | |
| **Operations** | `disaster-recovery.md` | `@devops` | ✅ OK | |
| **Operations** | `git-push.md` | `@git` | ✅ Done | |
| **Operations** | `git-save.md` | `@git` | ✅ OK | |
| **Operations** | `hotfix-protocol.md` | `@devops` | ✅ OK | |
| **Operations** | `release-prepare.md` | `@git` | ✅ OK | |
| **Operations** | `rollback-protocol.md` | `@devops" | ✅ OK | |
| **Operations** | `schema-migration.md` | `@backend` | ✅ OK | |
| **Reports** | `project-report.md` | `@scribe` | ✅ Done | |
| **Reports** | `quality-report.md` | `@qa` | ✅ OK | |
| **Reports** | `security-audit.md` | `@critique` | ✅ OK | |
| **Reports** | `test-coverage-report.md` | `@qa` | ✅ OK | |
| **WikiFlow** | `smith_orchestra_auto.md` | `@pm` | ✅ Done | |
| **WikiFlow** | `smith_orchestra_manual.md` | `@scribe` | ✅ Done | |
| **WikiFlow** | `wk_brain_smith_manual.md` | `@brain` | ✅ OK | |
| **WikiFlow** | `wk_coder_back_smith_manual.md` | `@backend` | ✅ OK | |
| **WikiFlow** | `wk_coder_front_smith_manual.md` | `@frontend` | ✅ OK | |
| **WikiFlow** | `wk_coder_script_smith_manual.md` | `@devops` | ✅ OK | |
| **WikiFlow** | `wk_docs_smith_manual.md` | `@docs` | ✅ OK | |
| **WikiFlow** | `wk_git_smith_manual.md` | `@git` | ✅ OK | |
| **WikiFlow** | `wk_lint_smith_manual.md` | `@lint` | ✅ OK | |
| **WikiFlow** | `wk_pm_smith_manual.md` | `@pm` | ✅ OK | |
| **WikiFlow** | `wk_review_smith_manual.md` | `@critique` | ✅ OK | |
| **WikiFlow** | `wk_test_smith_manual.md` | `@test` | ✅ OK | |

---

## 🔍 Detailed Critique

### 1. The Handoff Blind Spot
While roles are assigned, the **handoff files** are not always explicitly mentioned in the workflows. 
- **Recommendation**: Update `@pm` workflows to explicitly reference `docs/WikiFlow/pm/analysis.md` as the primary output.
- **Recommendation**: Update `@coder` workflows to check `docs/WikiFlow/coder/notes.md` before starting.

### 2. Typo in Design Sync
The `design-sync.md` uses `@theme-expert-expert`. This double suffix can cause token hallucination in strict parsers.
- **Action**: Standardize to `Theme Smith (@theme-expert)`.

### 3. Orphaned Ops Workflows
Workflows like `git-push.md` and `create-ci.md` are critical but currently "headless" (no assigned role). This leads to inconsistent output quality.
- **Action**: Force `@git` and `@devops` roles onto these respectively.

### 4. Project Report Responsibility
The `project-report.md` is an aggregate task. It should be owned by the **Orchestra Hub (@scribe)** as it pulls from all layers.

---

## 📋 Recommended Priority Fixes

| Priority | Action | Target Files |
|---|---|---|
| **P0** | Patch all 9 MISSING roles | `commander.md`, `adapt-project.md`, `create-flow.md`, `gemini-delegate.md`, `jules-delegate.md`, `create-ci.md`, `git-push.md`, `project-report.md`, `self-evolve.md` |
| **P1** | Standardize non-standard headers | `smith_orchestra_auto.md`, `smith_orchestra_manual.md`, `design-sync.md` |
| **P2** | Refine `wk_review_smith_manual.md` | Decide: `@architect` vs `@critique`. *Review Smith* suggests architecture, but the implementation is often audit-heavy. |

---

## 🛡️ Next Steps
1.  **Batch Patch**: Execute a script to inject the missing headers.
2.  **Verify**: Re-run the role extractor to confirm 100% compliance.
3.  **Final Report**: Update this audit file with the "Post-Patch" status.
