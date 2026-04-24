# 🛠️ Workflow Audit (April 2026)
**Location:** `docs/track/audits/WORKFLOW_AUDIT.md`
**Objective:** Clean up the `.agents/workflows/` directory to remove duplicates, fix naming conventions, and deprecate legacy scripts in favor of the new True Auto Orchestra monoliths.

---

## 🔴 1. Obsolete / Legacy (Target for Deletion)
These workflows have been entirely superseded by `smith_orchestra_auto.md` or are fragmented legacy pieces of the old auto-loop.
- `auto-cycle.md`
- `autocode.md`
- `autofeature.md`
- `autofix.md`
- `autolint.md`
- `autostartcycle.md`
- `fixcycle.md`
- `startcycle.md`
- `PlanningProtocol.md` (Redundant to `write_specs` skill or PM Smith logic)

## 🟡 2. Duplicated / Improperly Named (Target for Merge/Rename)
These workflows provide value but violate naming conventions (kebab-case) or overlap heavily with other commands.
- `ruleRev.md` ➡️ Rename to `rule-review.md`
- `testcov.md` ➡️ Merge with `test-coverage-report.md` (Duplicated purpose)
- `feature.md` ➡️ Keep, but ensure it delegates to the new `smith_orchestra_auto` instead of legacy scripts.
- `issue-writter.md` ➡️ Typo: rename to `issue-writer.md`.
- `DisasterRecoveryProtocol.md` ➡️ Rename to `disaster-recovery.md` (or merge with `rollback-protocol.md`).

## 🟢 3. Approved Core Ecosystem (Keep)
These workflows are structurally sound, well-named, and represent the core capabilities of the Antigravity Agent and LogLensAi team.

**The WikiFlow Smith Series:**
- `smith_orchestra_auto.md` (The Main True Auto Monolith)
- `smith_orchestra_manual.md`
- `wk_*_smith_manual.md` (All 8 manual persona orchestrators)

**The Jules CLI Interoperability Suite:**
- `jules-cycle.md`
- `jules-delegate.md`
- `jules-handoff.md`
- `jules-pull.md`
- `jules-push.md`

**Global Agent Operations:**
- `adapt-project.md`
- `auto-improve.md`
- `create-ci.md`
- `create-flow.md`
- `dependency-update.md`
- `design-sync.md`
- `gemini-delegate.md`
- `git-push.md`
- `git-save.md`
- `hotfix-protocol.md`
- `onboarding-setup.md`
- `project-report.md`
- `quality-report.md`
- `release-prepare.md`
- `rollback-protocol.md`
- `schema-migration.md`
- `security-audit.md`
- `self-evolve.md`
- `skill-writer.md`

---
### 📝 Proposed Action Plan
1. Delete the 9 scripts in the **🔴 Obsolete** category.
2. Rename/Merge the 5 scripts in the **🟡 Duplicated** category.
3. Update `.agents/rules/` if any of the deprecated workflows were explicitly referenced.
