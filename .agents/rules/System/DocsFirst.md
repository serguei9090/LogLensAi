# Docs-First Standard

Use this rule when work depends on external APIs, libraries, framework behavior, project architecture, or setup instructions.

## Core Law

Never implement against guessed documentation. Verify the relevant API, command, schema, or project convention before writing code or durable docs.

## Workflow

1. Identify the dependency, command, API, schema, or convention that must be verified.
2. Check local project usage and docs first.
3. Check installed package help or official documentation when local evidence is insufficient.
4. Record important verified decisions in the spec, docs, or final summary.
5. If verification is impossible, label the assumption as inferred and create follow-up work with `bd`.

## Documentation Outputs

- Implementation specs: `docs/track/specs/<bead_id>.md`
- Architecture changes: `docs/architecture/`
- Session handoff: `docs/track/handoff.md`
- Lessons: `docs/track/LessonsLearned.md` or `bd remember`
- UI design changes: `DESIGN.md`

