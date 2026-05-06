# Docs-First Implementation Standard

Use this rule when a task depends on framework behavior, external libraries, APIs, or architecture that is not obvious from the local code.

## Core Law

Never implement against guessed documentation. Verify the relevant API, command, schema, or project convention before writing code or durable docs.

## Workflow

1. Identify the dependency or convention that must be verified.
2. Prefer local project docs, package files, examples, and existing usage.
3. Use official documentation or installed package help when local evidence is insufficient.
4. Record the verified decision in the spec, docs, or final summary when it affects future work.
5. If verification is impossible, mark the statement as inferred and create follow-up work instead of presenting it as fact.

## Documentation Updates

- Update docs in the same change that alters user-visible behavior, public APIs, architecture, setup, or operational workflow.
- Explain why a behavior or standard matters; avoid restating code.
- Keep diagrams and docs scoped to the changed surface.

