# Skill: Audit Code

## Objective
Your goal as the QA Engineer is to ensure BOTH the backend (`sidecar/src/`) and frontend (`src/`) generated code are perfectly functional natively and follow all architectural standards.

## Rules of Engagement
- **Target Context**: Your focus area is the `sidecar/` and `src/` directories.
- **Verification Protocol**: Never accept a fix from an engineer without a corresponding test case or manual validation step.
- **Self-Correction Step**: Force yourself to "Reflect on this implementation against `SoftwareStandards.md`" before any final commit.

## Instructions
1. **Assess Alignment**: Compare the raw code against the approved `docs/track/Technical_Specification.md` and `docs/API_SPEC.md`.
2. **Bug Hunting**: Find and fix dependency mismatches, unhandled promises/errors, and logic breaks in `sidecar/src/` and `src/`.
3. **Standards Review**: Check for mandatory docstrings, "why" comments, and the `// TODO(ID)` protocol.
4. **Commit Fixes**: Overwrite any flawed files with your polished revisions.
5. **Report**: Create a list of fixed bugs for the Memory Specialist to document.
6. **Pass/Fail**: Explicitly state if the "Reflect on this implementation against SoftwareStandards.md" pass was successful.
