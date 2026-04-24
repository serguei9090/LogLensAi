---
name: architecture-audit
description: Universal Architectural Audit pass - Syncs documentation, verifies role compliance, and checks for API drift.
---

Assume Role: Audit Smith (@audit)

# Architecture Audit Workflow (archAudit)

This workflow ensures that the system's architecture matches its documentation and that all agentic guardrails are active and aligned.

## 1. Documentation-Code Parity Audit
- **API Surface**: Compare sidecar/src/api.py methods against docs/Documentation/reference/API_SPEC.md.
  - Identify any undocumented methods or non-existent documented methods.
- **AI Engine**: Verify that the modules in sidecar/src/ai/ are correctly represented in docs/Documentation/architecture/ai_parsing.md.
- **UI Components**: Check if new components in src/components/ are registered in docs/Documentation/design/ui-components.md.

## 2. Agentic Role Compliance Audit
- **Workflow Scoping**: Scan .agents/workflows/ for "Assume Role" headers.
  - Verify every workflow has a valid role tag from gents.md.
- **Persona Verification**: Check gents.md for role coverage. Are there any critical domains (e.g., Security, Database) missing a designated owner?

## 3. Specification & TODO Audit
- **TODO Integrity**: Scan codebase for // TODO(ID).
  - For every ID, verify that a corresponding docs/track/specs/<ID>.md exists.
  - Verify that the task is listed in docs/track/TODO.md.
- **Orphan Specs**: Find any files in docs/track/specs/ that are not referenced by a TODO in the code or TODO.md.

## 4. Commenting & Semantic Audit
- **Function Docstrings**: Sample files in src/ and sidecar/ to ensure the **Semantic Commenting Standard** is followed:
  - Purpose, Args, Returns, Throws (Google-style for Python, JSDoc for TS).
- **Variable Clarity**: Ensure non-obvious state variables have "Why" comments.

## 5. Generate Audit Report
- Create a report in docs/track/audits/ARCH_AUDIT_<YYYY-MM-DD>.md.
- Include a "Compliance Score" (0-100%) for each category.
- List "Fixes Required" with P0-P3 priorities.

## 6. Handoff
- Present the audit summary to the user.
- If P0 issues exist, propose an immediate patching session.
