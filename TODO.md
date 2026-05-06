# Project TODO List

This file is maintained by the `doc-agent` to track ongoing documentation and parity tasks. It also serves as the "TODOC" file, directly referenced by the `doc-agent` for managing task progress.

## General Documentation Tasks

- [x] Document the `codanna-index` functionality and its integration via `scripts/hooks/post_commit.py`. (Superseded by `docs/track/automated_dev_workflow.md`. Old `post_commit.py` script was not found.)
- [x] Create a dedicated documentation page for `scripts/hooks/post_commit.py`, detailing its role in orchestrating post-commit actions, including `doc-agent` invocation and Codanna indexing. (Superseded by `docs/track/automated_dev_workflow.md`. Old `post_commit.py` script was not found.)
- [x] Investigate and either remove or relocate `docs/pytest.py` as it appears to be an irrelevant or placeholder file in the documentation directory. (Deleted 2026-05-06)
- [x] Run repository quality checks (Biome + Ruff) and resolve any regressions. (Done 2026-05-06)
- [ ] Monitor `doc-agent` performance and accuracy in updating `docs/track/` and `TODO.md`.
- [ ] Explore expanding `doc-agent`'s scope to automatically update other documentation areas (e.g., `README.md` sections, code comments).
- [ ] Review existing `docs/` content for areas that could benefit from `doc-agent` automation.

## API Contracts

- [ ] Ensure all API contracts are consistently documented and maintained by `doc-agent` (if applicable).
- [ ] Document the workflow for `api_schema.json`, noting it is a generated artifact and excluded from version control, and how this impacts the "Living Spec" for API contracts.
