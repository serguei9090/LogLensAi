// Package query implements LLQL (LogLens Query Language), a small
// hand-rolled search-query language: field specs (level:ERROR), ranges
// (id:[100 TO 200]), quoted/plain search terms, boolean AND/OR/NOT, and
// wildcards (* / ?). It ports sidecar/src/query_parser.py.
//
// The public entry point is ParseLLQL, which — like the Python
// implementation — never fails: on any parse error it degrades to a plain
// `raw_text ILIKE '%query%'` fallback, since LLQL queries are free-typed
// user search input and a syntax error should never break search.
package query

import (
	"fmt"
	"strings"
)

// Node is an LLQL AST node. Every node can render itself to a parameterized
// SQL fragment plus the ordered parameter values that fill its `?`
// placeholders (matching Python's Node.to_sql() contract).
type Node interface {
	ToSQL() (string, []any)
}

// fieldColumnMapping mirrors the field_mapping dicts in query_parser.py:
// named fields resolve to real columns on the `l` (logs) table; anything
// else is assumed to be a JSON facet key.
var fieldColumnMapping = map[string]string{
	"level":     "l.level",
	"source":    "l.source_id",
	"cluster":   "l.cluster_id",
	"content":   "l.raw_text",
	"message":   "l.raw_text",
	"raw":       "l.raw_text",
	"id":        "l.id",
	"timestamp": "l.timestamp",
}

// rangeColumnMapping mirrors RangeNode.to_sql's (smaller) field_mapping —
// note it deliberately excludes content/message/raw, matching Python.
var rangeColumnMapping = map[string]string{
	"level":     "l.level",
	"source":    "l.source_id",
	"cluster":   "l.cluster_id",
	"id":        "l.id",
	"timestamp": "l.timestamp",
}

func facetExpr(field string) string {
	return fmt.Sprintf(`json_extract_string(l.facets, '$."%s"')`, field)
}

// processValue ports FieldNode._process_value: escaped \* and \? are
// protected from the wildcard substitution, then bare * and ? become SQL
// wildcards % and _, then the protected sequences are restored to literal
// * and ? (the escaping backslash is consumed).
func processValue(val string) (hasWildcard bool, processed string) {
	const astPlaceholder = "___X_AST_X___"
	const qmPlaceholder = "___X_QM_X___"

	protected := replaceAll(val, `\*`, astPlaceholder)
	protected = replaceAll(protected, `\?`, qmPlaceholder)

	hasWildcard = containsAny(protected, "*", "?")

	out := replaceAll(protected, "*", "%")
	out = replaceAll(out, "?", "_")
	out = replaceAll(out, astPlaceholder, "*")
	out = replaceAll(out, qmPlaceholder, "?")
	return hasWildcard, out
}

// FieldNode is `field<op>value`, e.g. level:ERROR, source:!=manual,
// name:~partial, or a wildcarded value like source:auth*.
type FieldNode struct {
	Field    string
	Operator string // ":", ":=", ":!=", or ":~"
	Value    string
}

func (n *FieldNode) ToSQL() (string, []any) {
	dbField, mapped := fieldColumnMapping[n.Field]
	hasWildcard, processedVal := processValue(n.Value)

	target := dbField
	if !mapped {
		target = facetExpr(n.Field)
	}

	if hasWildcard {
		return target + " ILIKE ?", []any{processedVal}
	}

	switch n.Operator {
	case ":", ":=":
		return target + " = ?", []any{processedVal}
	case ":!=":
		return target + " != ?", []any{processedVal}
	case ":~":
		return target + " ILIKE ?", []any{"%" + processedVal + "%"}
	}

	// Unreachable given the tokenizer's operator set, but mirrors Python's
	// final fallback `return f"{self.field} = ?", [self.value]` just in case.
	return n.Field + " = ?", []any{n.Value}
}

// RangeNode is `field:[start TO end]` (inclusive) or `field:{start TO end}`
// (exclusive), independently per bound.
type RangeNode struct {
	Field          string
	Start          string
	End            string
	InclusiveStart bool
	InclusiveEnd   bool
}

func (n *RangeNode) ToSQL() (string, []any) {
	dbField, mapped := rangeColumnMapping[n.Field]
	if !mapped {
		dbField = facetExpr(n.Field)
	}

	opStart := ">"
	if n.InclusiveStart {
		opStart = ">="
	}
	opEnd := "<"
	if n.InclusiveEnd {
		opEnd = "<="
	}

	sql := fmt.Sprintf("(%s %s ? AND %s %s ?)", dbField, opStart, dbField, opEnd)
	return sql, []any{n.Start, n.End}
}

// SearchNode is a free-text term matched against l.raw_text.
type SearchNode struct {
	Term string
}

func (n *SearchNode) ToSQL() (string, []any) {
	const astPlaceholder = "___X_AST_X___"
	const qmPlaceholder = "___X_QM_X___"

	protected := replaceAll(n.Term, `\*`, astPlaceholder)
	protected = replaceAll(protected, `\?`, qmPlaceholder)

	if containsAny(protected, "*", "?") {
		processed := replaceAll(protected, "*", "%")
		processed = replaceAll(processed, "?", "_")
		processed = replaceAll(processed, astPlaceholder, "*")
		processed = replaceAll(processed, qmPlaceholder, "?")
		return "(l.raw_text ILIKE ? OR l.raw_text ILIKE ?)", []any{processed, processed}
	}

	finalTerm := replaceAll(n.Term, `\*`, "*")
	finalTerm = replaceAll(finalTerm, `\?`, "?")
	return "(l.raw_text ILIKE ? OR l.raw_text ILIKE ?)", []any{
		"%" + finalTerm + "%",
		"%" + finalTerm + "%",
	}
}

// AndNode is the conjunction of two nodes (explicit `AND` or implicit
// juxtaposition, e.g. "error connection").
type AndNode struct {
	Left, Right Node
}

func (n *AndNode) ToSQL() (string, []any) {
	lSQL, lParams := n.Left.ToSQL()
	rSQL, rParams := n.Right.ToSQL()
	return fmt.Sprintf("(%s AND %s)", lSQL, rSQL), append(append([]any{}, lParams...), rParams...)
}

// OrNode is the disjunction of two nodes.
type OrNode struct {
	Left, Right Node
}

func (n *OrNode) ToSQL() (string, []any) {
	lSQL, lParams := n.Left.ToSQL()
	rSQL, rParams := n.Right.ToSQL()
	return fmt.Sprintf("(%s OR %s)", lSQL, rSQL), append(append([]any{}, lParams...), rParams...)
}

// NotNode negates its operand (`NOT expr` or `-expr`).
type NotNode struct {
	Operand Node
}

func (n *NotNode) ToSQL() (string, []any) {
	sql, params := n.Operand.ToSQL()
	return fmt.Sprintf("(NOT %s)", sql), params
}

func replaceAll(s, old, new string) string {
	return strings.ReplaceAll(s, old, new)
}

func containsAny(s string, subs ...string) bool {
	for _, sub := range subs {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}
