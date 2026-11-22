# query

## Overview
LogLens Query Language (LLQL) lexer, recursive-descent parser, AST, and DuckDB SQL compiler. Translates user search queries containing boolean operators, field comparisons, inclusive/exclusive ranges, quoted phrases, and wildcards into parameterized SQL `WHERE` clauses.

## Interface
- `[ast.go:Node]`: AST node interface exposing `ToSQL() (string, []any)` for parameterized SQL generation against logs table alias `l`.
- `[ast.go:FieldNode]`: AST node for `field<op>value` predicates (`:`, `:=`, `:!=`, `:~`) supporting wildcard matching.
- `[ast.go:RangeNode]`: AST node for `field:[start TO end]` and `field:{start TO end}` bounds.
- `[ast.go:SearchNode]`: AST node for free-text or wildcard `ILIKE` searches against `l.raw_text`.
- `[ast.go:AndNode]`, `[ast.go:OrNode]`, `[ast.go:NotNode]`: Boolean combinator nodes (`AND`/implicit juxtaposition, `OR`, `NOT`/`-`).
- `[parser.go:ParseError]`: Syntax error type (`[parser.go:ParseError.Error]`) returned by `Parse`.
- `[parser.go:Parse]`: Lexes and parses an LLQL string into a `Node` AST (or `nil, nil` when empty).
- `[parser.go:ParseLLQL]`: Entrypoint returning `(sqlFragment, params)` for query execution, degrading gracefully on syntax errors.

## Invariants
- `[ast.go:fieldColumnMapping]`, `[ast.go:rangeColumnMapping]`, `[ast.go:facetExpr]`: Mapped fields resolve to `l.*` columns (`level`, `source`, `cluster`, `id`, `timestamp`, plus `content`/`message`/`raw` in `FieldNode` only); unmapped field names resolve to `json_extract_string(l.facets, '$."<field>"')`.
- `[ast.go:processValue]`, `[ast.go:SearchNode.ToSQL]`: Unescaped `*` and `?` convert to SQL `ILIKE` wildcards (`%` and `_`), while `\*` and `\?` preserve literal `*` and `?` characters.
- `[parser.go:tokenPattern]`, `[parser.go:parseOrExpr]`, `[parser.go:parseAndExpr]`, `[parser.go:parseNotExpr]`, `[parser.go:parsePrimary]`: Enforces operator precedence `NOT`/`-` > `AND` (explicit or implicit juxtaposition) > `OR`, strips surrounding quotes on field/range/string values, and treats unary `+` as a pass-through.
- `[parser.go:ParseLLQL]`: Never fails or propagates `ParseError`; empty/whitespace input returns `("", nil)`, and any parse failure falls back to `"(l.raw_text ILIKE ? OR l.raw_text ILIKE ?)"` with `["%query%", "%query%"]`.

## Side Effects
- None.

## Verification
- Run: `go test ./...`
