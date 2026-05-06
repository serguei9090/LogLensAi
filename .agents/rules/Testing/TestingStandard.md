# Testing Standard

## Core Principles

- Test behavior, not implementation details.
- Match test scope to risk.
- Keep tests deterministic.
- Prefer focused verification during development, then broaden before closing high-risk beads.

## Test Selection

| Change type | Preferred verification |
| --- | --- |
| Pure function or utility | unit test |
| API or data contract | contract/unit test plus serialization check |
| Database query | focused integration or repository-level test |
| React component | component test with user-visible queries |
| End-to-end user flow | browser/E2E test |
| Docs/setup command | run command help or dry-run when safe |

## Bugfix Rule

When practical, reproduce the bug with a failing test or minimal script before fixing it. If reproduction is too expensive, document the reason and run the closest focused verification.

## Mocking Rules

- Mock network and external services in unit tests.
- Do not mock the behavior being tested.
- Freeze time for date-sensitive tests.
- Avoid sleeps; use wait helpers or polling APIs from the test framework.

## Documentation Link

When a test defines or changes expected behavior, update the related spec, README, architecture doc, or handoff if future agents need that context.

