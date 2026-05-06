---
name: smth-doc
description: Documentation synchronization skill for keeping repository docs current with recent code changes. Use when asked to update docs from last edited files, audit documentation after commits, compare docs against changes since the last documented commit, maintain docs/track/documentation-sync.md, or produce documentation handoff notes after implementation work.
---

# Smth Doc

Smth Doc updates `docs/` from real code changes. It works from either the current changed files or the commit range since the last documented commit.

## Required Load Order

1. Read one persona from `references/personas/`.
2. Read that persona's required rules from `references/rules/`.
3. Run `scripts/doc_delta.py --summary` unless the user provides a specific file list or commit range.

## Personas

| Persona | File | Use when |
| --- | --- | --- |
| Documentation Maintainer | `references/personas/p_doc-maintainer.md` | Updating docs from changed files or commits. |
| Documentation Auditor | `references/personas/p_doc-auditor.md` | Reviewing whether docs are stale, incomplete, or contradicted by code. |

## Documentation Marker

Track the last commit that has been reflected in documentation at:

`docs/track/documentation-sync.md`

The marker file must contain:

```markdown
# Documentation Sync

Last documented commit: <git-sha>
Last sync date: <YYYY-MM-DD>
Scope: <brief summary>
```

If the marker file is missing, create it after the first successful sync. Use the first commit in history, the latest release tag, or the user-provided baseline as the start point.

## Workflow

1. **Discover range:** Run `python .agents/skills/smth-doc/scripts/doc_delta.py --summary` from the repository root.
2. **Classify changes:** Group changed files by docs impact:
   - architecture/API/database/deployment/state/testing,
   - user setup or README,
   - design/UI,
   - operational workflow,
   - no docs needed.
3. **Verify facts:** Read changed code and existing docs before editing docs.
4. **Update docs:** Edit only the docs that correspond to verified changes.
5. **Audit docs:** Check for stale paths, commands, feature names, and architecture claims.
6. **Update marker:** After docs reflect the commit range, update `docs/track/documentation-sync.md` to the current `HEAD`.
7. **Report:** Summarize commit range, changed docs, unchanged docs, and any follow-up beads needed.

## Documentation Targets

| Change type | Primary docs |
| --- | --- |
| API/communication | `docs/architecture/communication.md`, relevant spec |
| Database/persistence | `docs/architecture/database.md` |
| Deployment/CI/hooks/setup | `docs/architecture/deployment.md`, `README.md` |
| Stack/dependencies | `docs/architecture/stack.md`, `README.md` |
| State management | `docs/architecture/state_management.md` |
| Testing strategy | `docs/architecture/testing_strategy.md`, `docs/track/unitestList.md` |
| System architecture | `docs/architecture/project_summary.md`, `docs/architecture/Technical_Specification.md`, `docs/architecture/diagrams.md` |
| Lessons/follow-up | `docs/track/LessonsLearned.md`, `docs/track/CodeDebt.md`, `bd remember` |

## Guardrails

- Do not document guessed behavior.
- Do not update the marker until docs are actually updated or audited as current.
- Do not rewrite unrelated docs for style.
- Create or update a bead for documentation gaps that cannot be resolved now.
- If no docs changes are needed, still update the marker only after explaining why the commit range has no documentation impact.
