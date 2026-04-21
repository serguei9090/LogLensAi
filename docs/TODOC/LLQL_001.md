# Task Spec: LLQL-001
**Title:** LogLens Query Language Parser
**Status:** Implemented (2026-04-20)

## The Contract (What)
Implement a Lucene-like query language (LLQL) that translates user-friendly queries into DuckDB `WHERE` clauses.
Example: `level:error AND "database timeout"` -> `(l.level = 'ERROR' AND (l.message ILIKE '%database timeout%' OR l.raw_text ILIKE '%database timeout%'))`

## Implementation Strategy
1. **Parser Engine**: Created `sidecar/src/query_parser.py` using a recursive descent pattern.
2. **Tokens**: Supports `level:`, `source:`, `cluster:`, `AND`, `OR`, `NOT`, and quoted strings.
3. **Integration**: Wired into `LogDatabase.query_logs` in `sidecar/src/db.py` and `sidecar/src/api.py`.

## Verification
- [x] Unit tests in `sidecar/tests/test_llql.py`.
- [x] Manual verification via JSON-RPC `get_logs` method.
