---
name: project-report
description: >
  Generates a comprehensive, dated project health report covering code quality,
  unit test coverage, DRY/SOLID compliance, gap analysis, tested-functionality
  inventory, and proposed next steps & new features. Output is saved to
  `docs/project-report-<DATE>.md`. Also updates related tracking documents
  (TODO.md, LessonsLearned.md, CodeDebt.md) in a single pass.
---

# `/project-report` — Comprehensive Project Health Report

## 🎯 Purpose

Produce a single, authoritative snapshot of project health that a senior developer
or product owner can read in under 10 minutes and act on immediately.  The report
is **data-driven** (backed by live linter/test runs) and **DRY** — each finding
appears **exactly once**, cross-linked from all relevant tracking files.

---

## 📋 Pre-flight: Resolve Context

Before running any commands:

1. Read `AGENTS.md` to confirm the active tech stack (bun/ruff/pytest versions).
2. Read `docs/track/TODO.md` — understand sprint status and open items.
3. Read `docs/track/CodeDebt.md` (if it exists) — carry forward unresolved debt.
4. Determine today's date (`YYYY-MM-DD`) for the output filename.
5. Set the output path: `docs/project-report-<DATE>.md`.

---

## 🔧 Step 1 — Code Quality Audit (Biome + Ruff)

> Activate the `audit` skill if deeper static analysis is needed.

// turbo
```powershell
bunx @biomejs/biome check src --max-diagnostics=200 ; uv run ruff check sidecar/src --output-format=json
```

**Capture and categorize findings:**

| Severity | Category | Tool |
|---|---|---|
| **P0 — Critical** | Parse errors, type errors | Biome / Ruff E-codes |
| **P1 — High** | Unused exports, security rules | Biome / Ruff W-codes |
| **P2 — Medium** | Import ordering, complexity | Ruff I/C-codes |
| **P3 — Low** | Style / formatting | Biome format |

For each finding, record:
- File path + line
- Rule ID (e.g., `lint/a11y/useSemanticElements`, `F841`)
- Short remediation note

---

## 🧪 Step 2 — Unit Test & Coverage Run

> Activate the `audit` skill's test-coverage section if needed.

// turbo
```powershell
bun run test:coverage ; uv run pytest sidecar/tests --cov=sidecar/src --cov-report=term-missing --cov-fail-under=80
```

**For each module/function, record:**

| Module | Functions | Covered | Coverage % | Status |
|---|---|---|---|---|
| `sidecar/src/api.py` | `method_*` | ? | ?% | ✅/⚠️/❌ |
| `sidecar/src/db.py` | `get_*`, `insert_*` | ? | ?% | ✅/⚠️/❌ |
| `src/store/*.ts` | Zustand actions | ? | ?% | ✅/⚠️/❌ |

- **Acceptance threshold**: ≥ 80% line coverage per module.
- Flag every **uncovered function** as a `TODO(coverage_NNN)` finding.
- Note any test that is skipped, mocked excessively, or tests implementation rather than behavior.

---

## 🔍 Step 3 — DRY / SOLID Compliance Scan

Scan for violations of the **Golden Rules** in `SoftwareStandards.md`:

### DRY Violations
- Search for duplicated logic blocks (≥ 5 identical lines in ≥ 2 files).

// turbo
```powershell
bunx jscpd src --min-lines 5 --reporters json --output reports/
```

- For Python: run `uv run ruff check sidecar --select SIM` (similarity rules).
- List each duplication: `<file-A>:<lines>` ↔ `<file-B>:<lines>`, proposed abstraction.

### SOLID Violations
Manually evaluate (or use the `critique` skill) for:
- **SRP**: Classes/modules with > 1 clear responsibility.
- **OCP**: Hardcoded `if provider == "ollama"` branches instead of strategy pattern.
- **DIP**: Direct instantiation of infrastructure classes inside domain logic.

### Dead-Code / Anti-Pattern Scan
- Find commented-out code blocks (violates `Ruthless Pruning` law).
- Find `console.log` / `print()` debugging statements left in production paths.

```powershell
bunx @biomejs/biome check src --rule lint/suspicious/noConsoleLog
uv run ruff check sidecar --select T20
```

---

## 📊 Step 4 — Gap Report

Cross-reference **implemented features** against the **API contract** (`docs/API_SPEC.md`)
and the **architecture docs** (`docs/architecture/`):

For each JSON-RPC method in `AGENTS.md`:

| RPC Method | Implemented | Tested | Documented | Pydantic Model | Gap |
|---|---|---|---|---|---|
| `get_logs` | ✅ | ✅ | ✅ | ✅ | — |
| `analyze_cluster` | ✅ | ⚠️ partial | ✅ | ✅ | Missing edge-case tests |

**Also check:**
- Every `TODO(ID)` in the codebase → is there a matching `docs/TODOC/<ID>.md`?
- Every `docs/TODOC/<ID>.md` → is the TODO still open in `docs/track/TODO.md`?
- Any `// TODO(ID)` without a TODOC file → create a stub and flag as **TODOC Debt**.

---

## ✅ Step 5 — Tested Functionality Inventory

Produce a clean checklist of **what is verified working** (backed by passing tests):

```md
## Tested Functionality

### Backend (sidecar)
- [x] Log ingestion via `ingest_logs` RPC (test_api_methods.py)
- [x] DuckDB cursor thread-safety (test_hierarchy.py)
- [x] Drain3 cluster parsing (test_ai_logic.py)
- [ ] SSH tail error recovery — NOT TESTED

### Frontend (React)
- [x] LogToolbar renders all action groups
- [x] Facet sidebar clears on folder navigation (manual + store unit test)
- [ ] Rename flow end-to-end — NOT TESTED
```

Only list items with a direct test reference. Do **not** assume functionality works because it compiles.

---

## 📝 Step 6 — Write the Report

Write the full report to `docs/project-report-<DATE>.md` using this template:

```md
# 📊 LogLensAi — Project Health Report
**Date:** <DATE>
**Sprint Ref:** <active sprint from TODO.md>
**Generated by:** Antigravity (project-report workflow)

---

## 1. Executive Summary

| Metric | Value | Status |
|---|---|---|
| Frontend Lint Errors | N | ✅/⚠️/❌ |
| Backend Lint Errors | N | ✅/⚠️/❌ |
| Overall Test Coverage | N% | ✅/⚠️/❌ |
| Uncovered Functions | N | ✅/⚠️/❌ |
| DRY Violations | N | ✅/⚠️/❌ |
| SOLID Violations | N | ✅/⚠️/❌ |
| Open TODOC Debt Items | N | ✅/⚠️/❌ |
| API Contract Gaps | N | ✅/⚠️/❌ |

> **Overall Health Score:** <X>/10

---

## 2. Code Quality Findings

### 2.1 Frontend (Biome)
<!-- P0–P3 table from Step 1 -->

### 2.2 Backend (Ruff)
<!-- P0–P3 table from Step 1 -->

---

## 3. Unit Test Coverage

### 3.1 Coverage by Module
<!-- Table from Step 2 -->

### 3.2 Uncovered Functions
<!-- List of uncovered functions + TODO(coverage_NNN) tags -->

---

## 4. DRY / SOLID Compliance

### 4.1 Duplication Hotspots
<!-- From Step 3 jscpd/ruff SIM -->

### 4.2 SOLID Violations
<!-- SRP/OCP/DIP findings -->

### 4.3 Dead Code & Anti-Patterns
<!-- console.log / print / commented-out code -->

---

## 5. Gap Analysis

### 5.1 API Contract Coverage
<!-- Table from Step 4 -->

### 5.2 TODOC Debt
<!-- Missing or orphaned TODOC files -->

---

## 6. Tested Functionality Inventory
<!-- Checklist from Step 5 -->

---

## 7. Proposed Next Steps

> Priority-ordered. Each item maps to an existing or new TODO(ID).

1. **[P0]** Fix all critical lint errors — assign TODO(lint_fix_001)
2. **[P1]** Raise test coverage for `<module>` to ≥ 80% — assign TODO(coverage_001)
3. **[P2]** Resolve top DRY violation in `<file>` — assign TODO(dry_001)
4. **[P2]** Complete TODOC stubs for all orphaned TODOs
5. **[P3]** Refactor `<component>` to fix SRP violation

---

## 8. Proposed New Features to Consider

> Derived from gap analysis, usage patterns, and architectural headroom.

| # | Feature | Rationale | Complexity |
|---|---|---|---|
| 1 | _Feature Name_ | _Why it fits the product vision_ | Low/Med/High |
| 2 | ... | ... | ... |

---

## 9. Tracking Cross-References

- TODO.md updated: `[link]`
- LessonsLearned.md updated: `[link]`
- CodeDebt.md updated: `[link]`
```

---

## 🔄 Step 7 — Update Tracking Documents (Atomic, No Duplication)

After writing the report, update **only the delta** in each tracking file.
Do NOT re-paste full findings — use a single cross-reference link to the report.

### `docs/track/TODO.md`
- Add new `TODO(ID)` items discovered in Steps 1–4.
- Mark any existing items resolved during the audit as `[x]`.
- Add a line at the top: `> 📊 Last audited: <DATE> — see [project-report-<DATE>.md]`

### `docs/track/LessonsLearned.md`
- Add a row for each **new pattern or anti-pattern** discovered (not already recorded).
- Format: `| <DATE> | <Finding> | <Root Cause> | <Recommendation> | @antigravity |`

### `docs/track/CodeDebt.md`
- Append new debt items from Steps 3 & 4.
- Close any items that have been resolved since the last report.
- Cross-link: `See full analysis in project-report-<DATE>.md § 4`.

### `docs/architecture/*.md` (if gaps found in Step 4)
- Update any architecture doc where the implementation now diverges from the spec.
- Only modify the minimal section needed; do not rewrite docs that are accurate.

---

## 🏁 Completion Checklist

Before closing this workflow, confirm:

- [ ] `docs/project-report-<DATE>.md` written and readable
- [ ] `docs/track/TODO.md` updated with new items (and no duplicates)
- [ ] `docs/track/LessonsLearned.md` updated with new rows only
- [ ] `docs/track/CodeDebt.md` updated with new debt + closed items
- [ ] Architecture docs updated only where gaps were found
- [ ] No finding appears in more than one place (DRY principle applied to docs)
- [ ] Report summary shared with user: "Report ready at `docs/project-report-<DATE>.md`"
