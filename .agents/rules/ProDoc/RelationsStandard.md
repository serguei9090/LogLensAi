# Architecture Relations Standard

Use this when documenting feature, service, data, or module relationships.

## Core Principles

- Every relationship must be verifiable by code, config, docs, or tests.
- Prefer concise dependency matrices and diagrams over long prose.
- Record risk where relationships touch money, auth, privacy, data loss, or deployment.

## Location

Store durable relationship maps in `docs/architecture/`:

- `docs/architecture/diagrams.md` for Mermaid diagrams.
- `docs/architecture/communication.md` for API/message flows.
- `docs/architecture/database.md` for data relationships.
- `docs/architecture/layers/` for layer-specific boundaries.

## Schema

| Surface | Depends on | Data/entities | Risk | Evidence |
| --- | --- | --- | --- | --- |
| Feature/module | Service/module/API | Tables/models/events | Low/Med/High | file, test, or command |

## Forbidden Patterns

- Inventing relationships.
- Listing vague entities such as `data` or `stuff`.
- Omitting evidence for high-risk dependencies.

