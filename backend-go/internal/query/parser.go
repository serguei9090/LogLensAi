package query

import (
	"fmt"
	"regexp"
	"strings"
)

// ParseError reports a syntax error while parsing an LLQL query. It is only
// ever returned by Parse; ParseLLQL swallows it and falls back to a plain
// text search, matching query_parser.py's parse_llql, which never raises.
type ParseError struct {
	msg string
}

func (e *ParseError) Error() string { return e.msg }

// tokenKind enumerates the token types from query_parser.py's token_spec,
// in the same priority order (earlier alternatives win ties, mirroring
// Python's ordered-alternation regex semantics that Go's RE2 also honors
// for leftmost-first submatching).
type tokenKind int

const (
	tokRange tokenKind = iota
	tokField
	tokSearch
	tokPlus
	tokString
	tokAnd
	tokOr
	tokNot
	tokLParen
	tokRParen
	tokWord
)

type token struct {
	kind tokenKind
	val  string
}

// tokenPattern combines every token_spec alternative from query_parser.py
// into one alternation, in the same order, using named capture groups so we
// can recover which alternative fired for a given match.
var tokenPattern = regexp.MustCompile(
	`(?P<RANGE>[a-zA-Z_][a-zA-Z0-9_.]*:(?:\[|\{).+?\s+TO\s+.+?(?:\]|\}))` +
		`|(?P<FIELD>[a-zA-Z_][a-zA-Z0-9_.]*:(?:=|!=|~)?(?:"[^"]*"|[^()\s]+))` +
		`|(?P<SEARCH>search\s+"[^"]*"|search\s+[^()\s]+)` +
		`|(?P<PLUS>\+)` +
		`|(?P<STRING>"[^"]*")` +
		`|(?P<AND>\bAND\b)` +
		`|(?P<OR>\bOR\b)` +
		`|(?P<NOT>\bNOT\b|-)` +
		`|(?P<LPAREN>\()` +
		`|(?P<RPAREN>\))` +
		`|(?P<WORD>[^()\s]+)` +
		`|(?P<WS>\s+)`,
)

var tokenNames = tokenPattern.SubexpNames()

func kindForName(name string) (tokenKind, bool) {
	switch name {
	case "RANGE":
		return tokRange, true
	case "FIELD":
		return tokField, true
	case "SEARCH":
		return tokSearch, true
	case "PLUS":
		return tokPlus, true
	case "STRING":
		return tokString, true
	case "AND":
		return tokAnd, true
	case "OR":
		return tokOr, true
	case "NOT":
		return tokNot, true
	case "LPAREN":
		return tokLParen, true
	case "RPAREN":
		return tokRParen, true
	case "WORD":
		return tokWord, true
	default: // "" or "WS"
		return 0, false
	}
}

// tokenize ports LLQLParser._tokenize: scan left-to-right, drop whitespace.
func tokenize(query string) []token {
	matches := tokenPattern.FindAllStringSubmatchIndex(query, -1)
	tokens := make([]token, 0, len(matches))
	for _, m := range matches {
		for gi := 1; gi < len(tokenNames); gi++ {
			s, e := m[2*gi], m[2*gi+1]
			if s == -1 {
				continue
			}
			kind, ok := kindForName(tokenNames[gi])
			if !ok {
				break // WS or unnamed group: skip this match entirely
			}
			tokens = append(tokens, token{kind: kind, val: query[s:e]})
			break
		}
	}
	return tokens
}

var (
	rangeRe = regexp.MustCompile(`^([a-zA-Z_][a-zA-Z0-9_.]*):([\[\{])(.+?)\s+TO\s+(.+?)([\]\}])$`)
	fieldRe = regexp.MustCompile(`^([a-zA-Z_][a-zA-Z0-9_.]*)(:!=|:=|:~|:)(.*)$`)
)

type parser struct {
	tokens []token
	pos    int
}

func (p *parser) peek() *token {
	if p.pos < len(p.tokens) {
		return &p.tokens[p.pos]
	}
	return nil
}

func (p *parser) consume() *token {
	t := p.peek()
	if t != nil {
		p.pos++
	}
	return t
}

// parse ports LLQLParser.parse.
func (p *parser) parse() (Node, error) {
	if len(p.tokens) == 0 {
		return nil, nil
	}
	node, err := p.parseOrExpr()
	if err != nil {
		return nil, err
	}
	if p.pos < len(p.tokens) {
		return nil, &ParseError{fmt.Sprintf("unexpected token %v at end of query", p.tokens[p.pos])}
	}
	return node, nil
}

func (p *parser) parseOrExpr() (Node, error) {
	node, err := p.parseAndExpr()
	if err != nil {
		return nil, err
	}
	for p.peek() != nil && p.peek().kind == tokOr {
		p.consume()
		right, err := p.parseAndExpr()
		if err != nil {
			return nil, err
		}
		node = &OrNode{Left: node, Right: right}
	}
	return node, nil
}

func (p *parser) parseAndExpr() (Node, error) {
	node, err := p.parseNotExpr()
	if err != nil {
		return nil, err
	}
	for {
		t := p.peek()
		if t == nil || t.kind == tokOr || t.kind == tokRParen {
			break
		}
		if t.kind == tokAnd {
			p.consume()
		} else if !(t.kind == tokLParen || t.kind == tokField || t.kind == tokRange ||
			t.kind == tokSearch || t.kind == tokString || t.kind == tokWord ||
			t.kind == tokNot || t.kind == tokPlus) {
			break
		}

		right, err := p.parseNotExpr()
		if err != nil {
			return nil, err
		}
		node = &AndNode{Left: node, Right: right}
	}
	return node, nil
}

func (p *parser) parseNotExpr() (Node, error) {
	t := p.peek()
	if t != nil && t.kind == tokNot {
		p.consume()
		operand, err := p.parsePrimary()
		if err != nil {
			return nil, err
		}
		return &NotNode{Operand: operand}, nil
	}
	return p.parsePrimary()
}

func (p *parser) parsePrimary() (Node, error) {
	t := p.peek()
	if t == nil {
		return nil, &ParseError{"unexpected end of query"}
	}

	switch t.kind {
	case tokPlus:
		p.consume()
		return p.parsePrimary()

	case tokLParen:
		p.consume()
		node, err := p.parseOrExpr()
		if err != nil {
			return nil, err
		}
		if p.peek() == nil || p.peek().kind != tokRParen {
			return nil, &ParseError{"expected ')'"}
		}
		p.consume()
		return node, nil

	case tokRange:
		p.consume()
		m := rangeRe.FindStringSubmatch(t.val)
		if m == nil {
			return nil, &ParseError{fmt.Sprintf("invalid range format: %s", t.val)}
		}
		field, lbracket, start, end, rbracket := m[1], m[2], m[3], m[4], m[5]
		return &RangeNode{
			Field:          field,
			Start:          strings.Trim(start, `"`),
			End:            strings.Trim(end, `"`),
			InclusiveStart: lbracket == "[",
			InclusiveEnd:   rbracket == "]",
		}, nil

	case tokField:
		p.consume()
		m := fieldRe.FindStringSubmatch(t.val)
		if m == nil {
			return nil, &ParseError{fmt.Sprintf("invalid field format: %s", t.val)}
		}
		field, op, valStr := m[1], m[2], m[3]
		valStr = unquote(valStr)
		return &FieldNode{Field: field, Operator: op, Value: valStr}, nil

	case tokSearch:
		p.consume()
		valStr := strings.TrimSpace(t.val[len("search"):])
		valStr = unquote(valStr)
		return &SearchNode{Term: valStr}, nil

	case tokString:
		p.consume()
		return &SearchNode{Term: t.val[1 : len(t.val)-1]}, nil

	case tokWord:
		p.consume()
		return &SearchNode{Term: t.val}, nil

	default:
		return nil, &ParseError{fmt.Sprintf("unexpected token: %s", t.val)}
	}
}

func unquote(s string) string {
	if len(s) >= 2 && strings.HasPrefix(s, `"`) && strings.HasSuffix(s, `"`) {
		return s[1 : len(s)-1]
	}
	return s
}

// Parse parses an LLQL query string into its AST, returning a *ParseError
// on any syntax problem. Most callers should use ParseLLQL instead, which
// never fails.
func Parse(query string) (Node, error) {
	tokens := tokenize(query)
	p := &parser{tokens: tokens}
	return p.parse()
}

// ParseLLQL ports query_parser.py:parse_llql. It parses query into a
// parameterized SQL WHERE fragment (and its ordered parameter values). An
// empty/whitespace-only query yields ("", nil). Any parse failure — this is
// user-typed search input, so it must never hard-error — degrades to a
// plain `raw_text ILIKE '%query%'` fallback, exactly like the Python
// implementation's `except Exception` branch.
func ParseLLQL(query string) (string, []any) {
	if strings.TrimSpace(query) == "" {
		return "", nil
	}

	node, err := Parse(query)
	if err != nil {
		return "(l.raw_text ILIKE ? OR l.raw_text ILIKE ?)", []any{
			"%" + query + "%",
			"%" + query + "%",
		}
	}
	if node == nil {
		return "", nil
	}
	return node.ToSQL()
}
