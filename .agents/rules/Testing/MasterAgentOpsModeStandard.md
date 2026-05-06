# Testing And Documentation Modes

Select one mode before changing tests or documentation. The mode controls what must be proven.

| Mode | Use when | Required proof |
| --- | --- | --- |
| Construction | adding new behavior | test expected behavior, then implement or verify implementation |
| Bugfix | fixing broken behavior | reproduce or lock the failure when practical, then verify the fix |
| Retrofit | stabilizing legacy code | document current behavior, add characterization coverage, then refactor |
| Docs-only | updating docs without code change | verify docs against code, commands, or official sources |

## Beads Link

- Full SDLC testing work must reference an active bead.
- If a missing test is discovered but not addressed, create or update a bead for it.
- Do not use a standalone markdown checklist to track testing work.

## Mode Rules

1. Choose the mode based on the requested outcome, not personal preference.
2. Run the smallest meaningful test first.
3. Broaden verification when the changed surface is shared, user-facing, security-sensitive, or release-critical.
4. Record skipped or unavailable tests in the final summary or handoff.
