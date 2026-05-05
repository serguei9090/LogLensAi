# Project TODO List

This file is maintained by the `doc-agent` to track ongoing documentation and parity tasks. It also serves as the "TODOC" file, directly referenced by the `doc-agent` for managing task progress.

## General Documentation Tasks

- [x] Document the `codanna-index` functionality and its integration via `scripts/hooks/post_commit.py`. (Integration documented in `docs/track/post_commit_hook.md`. Further dedicated documentation for Codanna functionality might be needed.)
- [x] Create a dedicated documentation page for `scripts/hooks/post_commit.py`, detailing its role in orchestrating post-commit actions, including `doc-agent` invocation and Codanna indexing. (See: `docs/track/post_commit_hook.md`)
- [ ] Monitor `doc-agent` performance and accuracy in updating `docs/track/` and `TODO.md`.
- [ ] Explore expanding `doc-agent`'s scope to automatically update other documentation areas (e.g., `README.md` sections, code comments).
- [ ] Review existing `docs/` content for areas that could benefit from `doc-agent` automation.

## API Contracts

- [ ] Ensure all API contracts are consistently documented and maintained by `doc-agent` (if applicable).

