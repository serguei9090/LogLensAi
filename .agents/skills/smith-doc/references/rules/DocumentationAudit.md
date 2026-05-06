# Documentation Audit

## Audit Checks

- Paths in docs exist or are intentionally illustrative.
- Commands in docs match current scripts and tools.
- Architecture claims match verified code relationships.
- Setup docs include new required tools, env vars, or generated files.
- Test docs match current test commands and test locations.
- Diagrams do not show removed modules or missing edges.

## Evidence Rules

Each material doc update should be grounded in at least one of:

- changed file content,
- commit diff,
- command output,
- existing project docs,
- official external documentation for third-party behavior.

## No-Change Decision

If no docs need updates, record why:

- changed files are internal-only,
- docs already describe the behavior,
- change is generated/artifact-only,
- change is test-only with no process impact.

