---
trigger: always_on
---

# Project Documentation Standard

Repository documentation lives under `docs/`.

## Core Principles

- Documentation is part of the codebase and must change with the behavior it describes.
- Architecture docs must be verified against code.

## Canonical Locations

| Content | Location |
| --- | --- |
| Active specs | `docs/track/specs/` |
| Handoff | `docs/track/handoff.md` |
| Lessons | `docs/track/LessonsLearned.md` or `bd remember` |
| Architecture overview | `docs/architecture/` |
| Layer notes | `docs/architecture/layers/` |
| Design system | `DESIGN.md` |
| User setup | `README.md` |

## Update Triggers

- New feature or changed user behavior.
- API, database, architecture, deployment, or state-management change.
- New setup command or operational workflow.
- Test strategy or release process change.

## Forbidden Patterns

- Documenting features that do not exist.
- Leaving old paths or commands after moving files.
- Using external-only docs as the source of truth for repo architecture.
