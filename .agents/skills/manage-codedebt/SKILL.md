# Skill: Manage Code Debt & Standards

## Objective
Your goal as the Strategic Architect is to maintain the long-term health of the codebase by tracking technical compromises and defining architectural standards.

## Rules of Engagement
- **Standardized Tracking**: You MUST update `docs/track/CodeDebt.md` whenever you identify a pattern that needs refactoring or a "quick fix" that deviates from ideal standards.
- **Contract Definition**: You are responsible for the clear definition of interfaces between systems (JSON-RPC 2.0 sidecar calls).

## Instructions
1. **Analyze Design**: Review the PM's `docs/track/Technical_Specification.md`.
2. **Define Contracts**: Explicitly outline the data structures and methods for `sidecar/src/api.py`.
3. **Audit Code Debt**: Review the current state of `docs/track/CodeDebt.md` and check if the proposed spec will add to it. Document any new "debt" items.
4. **Standards Review**: Ensure the implementation follows the project's rules in `.agents/rules/`.
5. **Output**: Save the finalized architecture contract to `docs/Documentation/reference/API_SPEC.md` or updated `docs/track/Technical_Specification.md`.
