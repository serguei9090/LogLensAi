# Retrofit Testing Protocol

Use this when changing legacy or poorly covered code where behavior must be preserved.

## Workflow

1. Read the current code and user-facing behavior.
2. Document the observed behavior in the active spec or handoff.
3. Add characterization coverage when practical.
4. Make the smallest safe refactor or fix.
5. Run the characterization test plus any focused tests for the changed behavior.
6. Update docs if the documented behavior intentionally changes.

## UI Retrofit

- Prefer user-visible queries over brittle selectors.
- Add `data-testid` only when accessible selectors are impractical.
- Do not change visual behavior while only trying to make a component testable.

## Forbidden Patterns

- Refactoring first and testing later.
- Updating tests to match accidental behavior without noting the decision.
- Mocking the code under test so heavily that the test no longer checks behavior.

