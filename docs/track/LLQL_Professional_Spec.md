# PRD: Professional LogLens Query Language (LLQL)

## Overview
Elevate the LLQL parser to support advanced Lucene-like syntax, enabling professional log searching capabilities including wildcards, range queries, and strict operator handling.

## Requirements
1. **Wildcard Support**: 
   - `*` translates to SQL `%`.
   - `?` translates to SQL `_`.
   - Example: `source:auth*` -> `l.source_id ILIKE 'auth%'`.
2. **Range Queries**:
   - Syntax: `field:[START TO END]` (inclusive) or `field:{START TO END}` (exclusive).
   - Support for `timestamp`, `id`, and numeric facets.
3. **Explicit Operators**:
   - `+` prefix for mandatory terms.
   - `-` prefix for prohibited terms (already basic support, needs verification).
4. **Improved Search Node**:
   - If a search term contains wildcards, do not wrap it in `%...%`.
   - If no wildcards, continue wrapping in `%...%` for convenience (standard behavior).
5. **FTS Integration (Optional/Future)**:
   - Investigate DuckDB FTS extension for large-scale message searching.

## Validation Criteria (Definition of Done)
1. `query_parser.py` handles `*` and `?` correctly in values.
2. `query_parser.py` parses `field:[A TO B]` into `field >= A AND field <= B`.
3. Unit tests in `test_llql.py` cover:
   - Wildcards in search terms and fields.
   - Range queries for various fields.
   - Mixed complex queries with parentheses and nested ranges.
4. `db.py` integration remains stable and passes existing tests.
