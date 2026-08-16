package query

import (
	"strings"
	"testing"
)

// containsParam reports whether params contains a value equal to want, for
// either its string form or (when want looks numeric) as a bare string —
// ports the Python tests' `100 in params or "100" in params` laxness.
func containsParam(t *testing.T, params []any, want string) bool {
	t.Helper()
	for _, p := range params {
		switch v := p.(type) {
		case string:
			if v == want {
				return true
			}
		default:
			// no non-string params in this implementation, but keep this
			// branch for safety/clarity
		}
	}
	return false
}

// --- Ported from sidecar/tests/test_llql.py ---

func TestLLQLSimpleSearch(t *testing.T) {
	sql, params := ParseLLQL("error")
	if !strings.Contains(sql, "ILIKE ?") {
		t.Fatalf("expected ILIKE ? in sql, got %q", sql)
	}
	if !containsParam(t, params, "%error%") {
		t.Fatalf("expected %%error%% in params, got %v", params)
	}
}

func TestLLQLFieldEquals(t *testing.T) {
	sql, params := ParseLLQL("level:ERROR")
	if !strings.Contains(sql, "l.level = ?") {
		t.Fatalf("expected 'l.level = ?' in sql, got %q", sql)
	}
	if !containsParam(t, params, "ERROR") {
		t.Fatalf("expected ERROR in params, got %v", params)
	}
}

func TestLLQLFieldNotEquals(t *testing.T) {
	sql, params := ParseLLQL("level:!=INFO")
	if !strings.Contains(sql, "l.level != ?") {
		t.Fatalf("expected 'l.level != ?' in sql, got %q", sql)
	}
	if !containsParam(t, params, "INFO") {
		t.Fatalf("expected INFO in params, got %v", params)
	}
}

func TestLLQLFieldLike(t *testing.T) {
	sql, params := ParseLLQL("level:~ERR")
	if !strings.Contains(sql, "l.level ILIKE ?") {
		t.Fatalf("expected 'l.level ILIKE ?' in sql, got %q", sql)
	}
	if !containsParam(t, params, "%ERR%") {
		t.Fatalf("expected %%ERR%% in params, got %v", params)
	}
}

func TestLLQLAndOr(t *testing.T) {
	sql, params := ParseLLQL("level:ERROR AND source:manual")
	if !strings.Contains(sql, "l.level = ?") {
		t.Fatalf("missing l.level = ? in %q", sql)
	}
	if !strings.Contains(sql, "l.source_id = ?") {
		t.Fatalf("missing l.source_id = ? in %q", sql)
	}
	if !strings.Contains(sql, "AND") {
		t.Fatalf("missing AND in %q", sql)
	}
	if !containsParam(t, params, "ERROR") || !containsParam(t, params, "manual") {
		t.Fatalf("expected ERROR and manual in params, got %v", params)
	}
}

func TestLLQLComplex(t *testing.T) {
	sql, _ := ParseLLQL("(level:ERROR OR level:CRITICAL) AND source:manual")
	if !strings.Contains(sql, "(l.level = ? OR l.level = ?)") {
		t.Fatalf("expected grouped OR clause in %q", sql)
	}
	if !strings.Contains(sql, "AND l.source_id = ?") {
		t.Fatalf("expected trailing AND source clause in %q", sql)
	}
}

func TestLLQLImplicitAnd(t *testing.T) {
	sql, params := ParseLLQL("error connection")
	if !strings.Contains(sql, "AND") {
		t.Fatalf("expected implicit AND in %q", sql)
	}
	if got := strings.Count(sql, "ILIKE ?"); got != 4 {
		t.Fatalf("expected 4 occurrences of 'ILIKE ?', got %d in %q", got, sql)
	}
	if !containsParam(t, params, "%error%") || !containsParam(t, params, "%connection%") {
		t.Fatalf("expected %%error%% and %%connection%% in params, got %v", params)
	}
}

func TestLLQLNotMinus(t *testing.T) {
	sql, params := ParseLLQL("-level:INFO")
	if !strings.Contains(sql, "(NOT l.level = ?)") {
		t.Fatalf("expected '(NOT l.level = ?)' in %q", sql)
	}
	if !containsParam(t, params, "INFO") {
		t.Fatalf("expected INFO in params, got %v", params)
	}
}

func TestLLQLNotKeyword(t *testing.T) {
	sql, params := ParseLLQL("NOT level:INFO")
	if !strings.Contains(sql, "(NOT l.level = ?)") {
		t.Fatalf("expected '(NOT l.level = ?)' in %q", sql)
	}
	if !containsParam(t, params, "INFO") {
		t.Fatalf("expected INFO in params, got %v", params)
	}
}

func TestLLQLComplexImplicit(t *testing.T) {
	sql, _ := ParseLLQL("level:ERROR Connection timeout")
	if !strings.Contains(sql, "l.level = ?") {
		t.Fatalf("missing l.level = ? in %q", sql)
	}
	if !strings.Contains(sql, "AND") {
		t.Fatalf("missing AND in %q", sql)
	}
	if !strings.Contains(sql, "(l.raw_text ILIKE ? OR l.raw_text ILIKE ?)") {
		t.Fatalf("missing search clause in %q", sql)
	}
}

func TestLLQLFieldMappings(t *testing.T) {
	s1, _ := ParseLLQL("level:ERROR")
	if !strings.Contains(s1, "l.level =") {
		t.Fatalf("level mapping failed: %q", s1)
	}

	s2, _ := ParseLLQL("source:manual")
	if !strings.Contains(s2, "l.source_id =") {
		t.Fatalf("source mapping failed: %q", s2)
	}

	s3, _ := ParseLLQL("cluster:123")
	if !strings.Contains(s3, "l.cluster_id =") {
		t.Fatalf("cluster mapping failed: %q", s3)
	}

	s4, _ := ParseLLQL("content:hello")
	if !strings.Contains(s4, "l.raw_text =") {
		t.Fatalf("content mapping failed: %q", s4)
	}

	s5, _ := ParseLLQL("raw:world")
	if !strings.Contains(s5, "l.raw_text =") {
		t.Fatalf("raw mapping failed: %q", s5)
	}
}

// --- Ported from sidecar/tests/test_llql_new.py ---

func TestLLQLWildcardsSearch(t *testing.T) {
	sql, params := ParseLLQL("conn*")
	if !strings.Contains(sql, "ILIKE ?") {
		t.Fatalf("expected ILIKE ? in %q", sql)
	}
	if !containsParam(t, params, "conn%") {
		t.Fatalf("expected 'conn%%' in params, got %v", params)
	}
	if containsParam(t, params, "%conn*%") {
		t.Fatalf("did not expect '%%conn*%%' in params, got %v", params)
	}
}

func TestLLQLWildcardsField(t *testing.T) {
	sql, params := ParseLLQL("source:auth*")
	if !strings.Contains(sql, "l.source_id ILIKE ?") {
		t.Fatalf("expected 'l.source_id ILIKE ?' in %q", sql)
	}
	if !containsParam(t, params, "auth%") {
		t.Fatalf("expected 'auth%%' in params, got %v", params)
	}
}

func TestLLQLRangeInclusive(t *testing.T) {
	sql, params := ParseLLQL("id:[100 TO 200]")
	if !strings.Contains(sql, "(l.id >= ? AND l.id <= ?)") {
		t.Fatalf("expected inclusive range clause in %q", sql)
	}
	if !containsParam(t, params, "100") || !containsParam(t, params, "200") {
		t.Fatalf("expected 100 and 200 in params, got %v", params)
	}
}

func TestLLQLRangeExclusive(t *testing.T) {
	sql, _ := ParseLLQL("id:{100 TO 200}")
	if !strings.Contains(sql, "(l.id > ? AND l.id < ?)") {
		t.Fatalf("expected exclusive range clause in %q", sql)
	}
}

func TestLLQLRangeMixed(t *testing.T) {
	sql, _ := ParseLLQL("level:ERROR AND id:[100 TO 200]")
	if !strings.Contains(sql, "l.level = ?") {
		t.Fatalf("missing l.level = ? in %q", sql)
	}
	if !strings.Contains(sql, "(l.id >= ? AND l.id <= ?)") {
		t.Fatalf("missing range clause in %q", sql)
	}
}

func TestLLQLPlusOperator(t *testing.T) {
	sql, _ := ParseLLQL("+level:ERROR")
	if !strings.Contains(sql, "l.level = ?") {
		t.Fatalf("expected 'l.level = ?' in %q", sql)
	}
}

func TestLLQLEscaping(t *testing.T) {
	sql, params := ParseLLQL(`source:auth\*`)
	if !strings.Contains(sql, "l.source_id = ?") {
		t.Fatalf("expected 'l.source_id = ?' in %q", sql)
	}
	if !containsParam(t, params, "auth*") {
		t.Fatalf("expected 'auth*' in params, got %v", params)
	}
	if strings.Contains(sql, "ILIKE") {
		t.Fatalf("did not expect ILIKE for an escaped wildcard, got %q", sql)
	}
}

func TestLLQLRangeFacet(t *testing.T) {
	sql, params := ParseLLQL("price:[10 TO 50]")
	if !strings.Contains(sql, `json_extract_string(l.facets, '$."price"') >= ?`) {
		t.Fatalf("expected facet range clause in %q", sql)
	}
	if !containsParam(t, params, "10") || !containsParam(t, params, "50") {
		t.Fatalf("expected 10 and 50 in params, got %v", params)
	}
}

// --- Additional edge cases exercising the never-error fallback path ---

func TestLLQLEmptyQuery(t *testing.T) {
	sql, params := ParseLLQL("")
	if sql != "" || params != nil {
		t.Fatalf("expected empty result for empty query, got sql=%q params=%v", sql, params)
	}
}

func TestLLQLUnbalancedParenFallsBack(t *testing.T) {
	sql, params := ParseLLQL("(level:ERROR")
	if !strings.Contains(sql, "l.raw_text ILIKE ?") {
		t.Fatalf("expected fallback raw_text search for malformed query, got %q", sql)
	}
	if !containsParam(t, params, "%(level:ERROR%") {
		t.Fatalf("expected raw fallback param, got %v", params)
	}
}

func TestLLQLParseReturnsErrorOnBadSyntax(t *testing.T) {
	_, err := Parse("(level:ERROR")
	if err == nil {
		t.Fatalf("expected Parse to return an error for unbalanced parens")
	}
}
