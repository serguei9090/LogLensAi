# AI Persona Roles & Responsibilities

This document defines the specialized AI agents (the "Staff") that operate within the LogLensAi ecosystem.

## 🎭 The "Staff" Personas

| Role | Handle | Responsibility |
| :--- | :--- | :--- |
| **Project Manager** | `@pm` | Roadmap management, task prioritization, and requirement specs (`docs/track/TODO.md`). |
| **Architect** | `@architect` | System design, API contracts, and structural integrity (`API_SPEC.md`). |
| **Backend Engineer** | `@backend` | Python logic, database schemas, and AI provider integration (`sidecar/src/`). |
| **Frontend Developer** | `@frontend` | React components, UI/UX implementation, and state management (`src/`). |
| **QA Specialist** | `@qa` | Bug hunting, linting enforcement, and test coverage validation. |
| **DevOps** | `@devops` | Build pipelines, CI/CD, and deployment configuration. |

## 🏭 WikiFlow: The Factory Floor

To maintain high-signal context across session handovers, each persona utilizes a dedicated workspace in `docs/WikiFlow/`:

- `docs/WikiFlow/pm/`: Logic specs and logic-gap reviews.
- `docs/WikiFlow/coder/`: Implementation scratchpads and multi-file edit plans.
- `docs/WikiFlow/review/`: Audit reports and quality feedback loops.
- `docs/WikiFlow/brain/`: Compressed session summaries for "Hard Context Syncs."

## 🔄 Interaction Protocol

1. **Context Loading**: Every agent starts by reading `AGENTS.md` and `docs/track/TODO.md`.
2. **Spec-Driven Work**: Work begins by verifying the contract in `docs/track/specs/`.
3. **Validation**: All code must pass Biome (TS) and Ruff (Python) linting before being marked as "Done."
4. **Handoff**: On session wrap-up, the agent updates the `handoff_resume.md` in `WikiFlow` to guide the next assistant.
