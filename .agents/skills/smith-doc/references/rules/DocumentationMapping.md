# Documentation Mapping

Map code changes to the smallest relevant docs.

| Changed surface | Documentation target |
| --- | --- |
| Public API, RPC, bridge, events | `docs/architecture/communication.md` |
| Database schema, query model, migrations | `docs/architecture/database.md` |
| Deployment, CI, hooks, scripts, install flow | `docs/architecture/deployment.md`, `README.md` |
| Dependencies, runtime, package manager | `docs/architecture/stack.md`, `README.md` |
| State ownership, stores, caching | `docs/architecture/state_management.md` |
| Tests, coverage, QA process | `docs/architecture/testing_strategy.md`, `docs/track/unitestList.md` |
| Architecture boundaries or major flow | `docs/architecture/project_summary.md`, `docs/architecture/Technical_Specification.md`, `docs/architecture/diagrams.md` |
| UI design tokens or product visual rules | `DESIGN.md` |
| Lessons or recurring project facts | `docs/track/LessonsLearned.md`, `bd remember` |
| Deferred docs debt | `docs/track/CodeDebt.md` or a bead |

Do not update every possible target. Update the docs that a future engineer would reasonably consult for the changed behavior.

