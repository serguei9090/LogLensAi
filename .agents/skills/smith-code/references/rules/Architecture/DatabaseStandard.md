# Database Standards

## Core Principles

- **One access pattern:** Follow the repository's existing database wrapper/session pattern.
- **Cursor safety:** In DuckDB-backed code, use `self.db.get_cursor()` within the operation scope and do not share cursors across async or long-lived boundaries.
- **Schema as contract:** Treat migrations, table definitions, and Pydantic models as durable contracts.
- **Indexed queries:** Add or verify indexes for new foreign keys, joins, and high-cardinality filters.
- **Data preservation:** Review destructive schema or migration changes before execution.

## Workflow

1. Read the existing data access layer and nearby queries.
2. Identify whether the change is query-only, schema-affecting, or migration-affecting.
3. Keep query filters, count queries, and pagination aliases consistent.
4. Add focused tests for changed persistence behavior when test infrastructure exists.
5. Document migration or backfill requirements in the task/spec.

## Forbidden Patterns

- Opening ad hoc database connections when a project wrapper exists.
- Reusing cursors beyond their intended scope.
- Changing schema without updating models, docs, and tests.
- Loading entire tables when a filtered query is possible.
- Logging sensitive row data during debugging.

