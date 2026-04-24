# 🎭 Persona & Workflow Alignment Audit — v2.0
**Location:** `docs/track/audits/PERSONA_AUDIT.md`  
**Date:** April 2026  
**Updated:** Full re-scan post-reorganization. Supersedes v1.0.

**Defined Roles in `agents.md`:** `@pm`, `@architect`, `@critique`, `@backend`, `@frontend`, `@devops`, `@lint`, `@test`, `@docs`, `@git`, `@scribe`, `@theme`, `@qa` *(13 total)*

---

## ✅ Section 1: The Smith Monolith — Perfectly Aligned

**`smith/smith_orchestra_auto.md`** — The core pipeline correctly assumes 7 distinct roles in sequence:
`PM Smith` → `Coder Smith` → `Lint Smith` → `Test Smith` → `Docs Smith` → `Orchestra Hub` → `Git Smith`

**`smith/wk_*_manual.md` (10 files)** — All now standardized to exact `agents.md` registry names:
| File | Assumes | Maps To |
|---|---|---|
| `wk_pm_smith_manual.md` | `PM Smith (@pm)` | ✅ `@pm` |
| `wk_coder_back_smith_manual.md` | `Coder Smith (@backend)` | ✅ `@backend` |
| `wk_coder_front_smith_manual.md` | `Coder Smith (@frontend)` | ✅ `@frontend` |
| `wk_coder_script_smith_manual.md` | `Script Smith (@devops)` | ✅ `@devops` |
| `wk_docs_smith_manual.md` | `Docs Smith (@docs)` | ✅ `@docs` |
| `wk_git_smith_manual.md` | `Git Smith (@git)` | ✅ `@git` |
| `wk_lint_smith_manual.md` | `Lint Smith (@lint)` | ✅ `@lint` |
| `wk_test_smith_manual.md` | `Test Smith (@test)` | ✅ `@test` |
| `wk_review_smith_manual.md` | `Auditor Smith (@critique)` | ✅ `@critique` |
| `wk_brain_smith_manual.md` | `Review Smith (@architect)` | ✅ `@architect` |

---

## 🟡 Section 2: Workflows With Valid But Partial Persona Usage

These workflows mention personas but only for routing / context — they don't formally adopt a role via `Assume Role:`.

| Workflow | @Tags Used | Assessment |
|---|---|---|
| `dev/design-sync.md` | `@architect, @frontend, @pm, @qa, @theme` | ✅ All valid. But needs `Assume Role: Theme Smith (@theme)` header to activate full persona. |
| `dev/gemini-delegate.md` | `@backend, @devops, @frontend, @pm, @qa` | ✅ Valid tags, but `@qa` is registered yet `agents.md` doesn't define a standalone `@qa` block — it's shared between `@lint` and `@test`. Ambiguous. |
| `dev/feature.md` | *(none)* | 🔴 No persona at all. Should open as `@pm` to write the spec. |
| `jules/jules-delegate.md` | `@pm` | 🟡 Only uses `@pm` as a noun, not an active role assumption. |

---

## 🔴 Section 3: Workflows With NO Persona (21 files — Critical Gap)

These workflows execute complex tasks with zero persona context. A Flash model will behave as a generic assistant — no guardrails, no domain restriction.

### 3a. `agent-ops/` — Should Use `@scribe` / `@pm`
| Workflow | Recommended Role |
|---|---|
| `auto-improve.md` | `@scribe` — post-task reflection and rule updating |
| `onboarding-setup.md` | `@pm` — project initialization and scaffolding |
| `rule-review.md` | `@critique` — auditing rules for quality |
| `self-evolve.md` | `@scribe` — knowledge distillation and self-improvement |
| `skill-writer.md` | `@pm` or `@docs` — writing new skill documentation |
| `commander.md` | `@scribe` — routing orchestrator role |

### 3b. `dev/` — Should Use `@pm` / `@frontend`
| Workflow | Recommended Role |
|---|---|
| `feature.md` | `@pm` — spec writing and approval gate |
| `issue-writer.md` | `@pm` + `@critique` — audit and issue documentation |

### 3c. `jules/` — Should Use `@devops` / `@git`
| Workflow | Recommended Role |
|---|---|
| `jules-cycle.md` | `@devops` — CI orchestration |
| `jules-handoff.md` | `@git` + `@scribe` — state handoff |
| `jules-pull.md` | `@git` — branch management |
| `jules-push.md` | `@git` — commit and push |

### 3d. `ops/` — Should Use `@devops` / `@git`
| Workflow | Recommended Role |
|---|---|
| `dependency-update.md` | `@devops` — dependency management |
| `disaster-recovery.md` | `@devops` — infrastructure emergency |
| `git-save.md` | `@git` — snapshot |
| `hotfix-protocol.md` | `@git` + `@devops` — emergency release |
| `release-prepare.md` | `@git` — version tagging |
| `rollback-protocol.md` | `@devops` — reversal procedure |
| `schema-migration.md` | `@backend` — DB schema changes |

### 3e. `reports/` — Should Use `@critique` / `@docs`
| Workflow | Recommended Role |
|---|---|
| `security-audit.md` | `@critique` — security analysis |
| `test-coverage-report.md` | `@test` — coverage analysis |

---

## 🟡 Section 4: Missing Personas in `agents.md`

After reviewing all workflows, these roles are needed but **not yet defined** in `agents.md`:

| Missing Role | Why Needed | Status |
|---|---|---|
| `@theme-expert` | ✅ Now defined — Guardian of tokens. | Resolved |
| `@ui-designer` | ✅ Now defined — Component architect. | Resolved |
| `@api-specialist` | ✅ Now defined — Bridge architect. | Resolved |
| `@brain` | ✅ Now defined — Creative catalyst. | Resolved |
| `@qa` | ✅ Now defined — Guardian of stability. | Resolved |

---

| Priority | Action | Status |
|---|---|---|
| **P0** | Add `Assume Role:` header to `feature.md` → `@pm` | ✅ Done |
| **P0** | Add `Assume Role:` header to `disaster-recovery.md` and `hotfix-protocol.md` → `@devops` | ✅ Done |
| **P0** | Add `Assume Role:` header to `schema-migration.md` → `@backend` | ✅ Done |
| **P1** | Add `Assume Role:` to all `jules/` workflows → `@git` or `@devops` | ✅ Done |
| **P1** | Add `Assume Role:` to all `agent-ops/` workflows → `@scribe` or `@pm` | ✅ Done |
| **P1** | Add `Assume Role:` to all `reports/` workflows → `@critique` or `@test` | ✅ Done |
| **P2** | Decide: merge `@brain` into `@architect`, or give Brainstorm its own persona definition | ✅ Done |
| **P2** | Decide: create a unified `@qa` persona that formally owns the combined `@lint` + `@test` layer | ✅ Done |
