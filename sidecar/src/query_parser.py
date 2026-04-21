import logging
import re

logger = logging.getLogger(__name__)


class ParseError(Exception):
    pass


class Node:
    def to_sql(self):
        raise NotImplementedError()


class FieldNode(Node):
    def __init__(self, field, operator, value):
        self.field = field
        self.operator = operator
        self.value = value

    def _process_value(self, val):
        # Use placeholders that don't contain * or ?
        protected = val.replace("\\*", "___X_AST_X___").replace("\\?", "___X_QM_X___")
        has_wildcard = "*" in protected or "?" in protected
        processed = protected.replace("*", "%").replace("?", "_")
        final = processed.replace("___X_AST_X___", "*").replace("___X_QM_X___", "?")
        return has_wildcard, final

    def to_sql(self):
        field_mapping = {
            "level": "l.level",
            "source": "l.source_id",
            "cluster": "l.cluster_id",
            "content": "l.message",
            "message": "l.message",
            "raw": "l.raw_text",
            "id": "l.id",
            "timestamp": "l.timestamp",
        }

        db_field = field_mapping.get(self.field)
        has_wildcard, processed_val = self._process_value(self.value)

        if db_field:
            if has_wildcard:
                return f"{db_field} ILIKE ?", [processed_val]
            if self.operator in (":", ":="):
                return f"{db_field} = ?", [processed_val]
            elif self.operator == ":!=":
                return f"{db_field} != ?", [processed_val]
            elif self.operator == ":~":
                return f"{db_field} ILIKE ?", [f"%{processed_val}%"]
        else:
            # Fallback to facets
            if has_wildcard:
                return f"json_extract_string(l.facets, '$.\"{self.field}\"') ILIKE ?", [
                    processed_val
                ]
            if self.operator in (":", ":="):
                return f"json_extract_string(l.facets, '$.\"{self.field}\"') = ?", [processed_val]
            elif self.operator == ":!=":
                return f"json_extract_string(l.facets, '$.\"{self.field}\"') != ?", [processed_val]
            elif self.operator == ":~":
                return f"json_extract_string(l.facets, '$.\"{self.field}\"') ILIKE ?", [
                    f"%{processed_val}%"
                ]

        return f"{self.field} = ?", [self.value]


class RangeNode(Node):
    def __init__(self, field, start, end, inclusive_start=True, inclusive_end=True):
        self.field = field
        self.start = start
        self.end = end
        self.inclusive_start = inclusive_start
        self.inclusive_end = inclusive_end

    def to_sql(self):
        field_mapping = {
            "level": "l.level",
            "source": "l.source_id",
            "cluster": "l.cluster_id",
            "id": "l.id",
            "timestamp": "l.timestamp",
        }
        db_field = field_mapping.get(self.field)
        if not db_field:
            db_field = f"json_extract_string(l.facets, '$.\"{self.field}\"')"

        op_start = ">=" if self.inclusive_start else ">"
        op_end = "<=" if self.inclusive_end else "<"

        return f"({db_field} {op_start} ? AND {db_field} {op_end} ?)", [self.start, self.end]


class SearchNode(Node):
    def __init__(self, term):
        self.term = term

    def to_sql(self):
        protected = self.term.replace("\\*", "___X_AST_X___").replace("\\?", "___X_QM_X___")
        if "*" in protected or "?" in protected:
            processed = (
                protected.replace("*", "%")
                .replace("?", "_")
                .replace("___X_AST_X___", "*")
                .replace("___X_QM_X___", "?")
            )
            return "(l.message ILIKE ? OR l.raw_text ILIKE ?)", [processed, processed]

        final_term = self.term.replace("\\*", "*").replace("\\?", "?")
        return "(l.message ILIKE ? OR l.raw_text ILIKE ?)", [
            f"%{final_term}%",
            f"%{final_term}%",
        ]


class AndNode(Node):
    def __init__(self, left, right):
        self.left = left
        self.right = right

    def to_sql(self):
        l_sql, l_params = self.left.to_sql()
        r_sql, r_params = self.right.to_sql()
        return f"({l_sql} AND {r_sql})", l_params + r_params


class OrNode(Node):
    def __init__(self, left, right):
        self.left = left
        self.right = right

    def to_sql(self):
        l_sql, l_params = self.left.to_sql()
        r_sql, r_params = self.right.to_sql()
        return f"({l_sql} OR {r_sql})", l_params + r_params


class NotNode(Node):
    def __init__(self, operand):
        self.operand = operand

    def to_sql(self):
        sql, params = self.operand.to_sql()
        return f"(NOT {sql})", params


class LLQLParser:
    def __init__(self, query):
        self.tokens = self._tokenize(query)
        self.pos = 0

    def _tokenize(self, query):
        token_spec = [
            ("RANGE", r"[a-zA-Z_][a-zA-Z0-9_\.]*:([\[\{].+?\s+TO\s+.+?[\]\}])"),
            ("FIELD", r'[a-zA-Z_][a-zA-Z0-9_\.]*:(?:=|!=|~)?(?:"[^"]*"|[^()\s]+)'),
            ("SEARCH", r'search\s+"[^"]*"|search\s+[^()\s]+'),
            ("PLUS", r"\+"),
            ("STRING", r'"[^"]*"'),
            ("AND", r"\bAND\b"),
            ("OR", r"\bOR\b"),
            ("NOT", r"\bNOT\b|-"),
            ("LPAREN", r"\("),
            ("RPAREN", r"\)"),
            ("WORD", r"[^()\s]+"),
            ("WS", r"\s+"),
        ]
        tok_regex = "|".join(f"(?P<{pair[0]}>{pair[1]})" for pair in token_spec)
        tokens = []
        for mo in re.finditer(tok_regex, query):
            kind = mo.lastgroup
            value = mo.group()
            if kind == "WS":
                continue
            logger.debug("Token: %s: %s", kind, value)
            tokens.append((kind, value))
        return tokens

    def peek(self):
        if self.pos < len(self.tokens):
            return self.tokens[self.pos]
        return None

    def consume(self):
        tok = self.peek()
        if tok:
            self.pos += 1
        return tok

    def parse(self):
        if not self.tokens:
            return None
        node = self.parse_or_expr()
        if self.pos < len(self.tokens):
            raise ParseError(f"Unexpected token {self.peek()} at end of query")
        return node

    def parse_or_expr(self):
        node = self.parse_and_expr()
        while self.peek() and self.peek()[0] == "OR":
            self.consume()
            right = self.parse_and_expr()
            node = OrNode(node, right)
        return node

    def parse_and_expr(self):
        node = self.parse_not_expr()
        while self.peek() and self.peek()[0] not in ("OR", "RPAREN"):
            if self.peek()[0] == "AND":
                self.consume()
            elif self.peek()[0] not in (
                "LPAREN",
                "FIELD",
                "RANGE",
                "SEARCH",
                "STRING",
                "WORD",
                "NOT",
                "PLUS",
            ):
                break

            right = self.parse_not_expr()
            node = AndNode(node, right)
        return node

    def parse_not_expr(self):
        tok = self.peek()
        if tok and (tok[0] == "NOT"):
            self.consume()
            return NotNode(self.parse_primary())
        return self.parse_primary()

    def parse_primary(self):
        tok = self.peek()
        if not tok:
            raise ParseError("Unexpected end of query")

        kind, val = tok
        if kind == "PLUS":
            self.consume()
            return self.parse_primary()
        elif kind == "LPAREN":
            self.consume()
            node = self.parse_or_expr()
            if not self.peek() or self.peek()[0] != "RPAREN":
                raise ParseError("Expected ')'")
            self.consume()
            return node
        elif kind == "RANGE":
            self.consume()
            m = re.match(r"^([a-zA-Z_][a-zA-Z0-9_.]*):([\[\{])(.+?)\s+TO\s+(.+?)([\]\}])$", val)
            if m:
                field, lbracket, start, end, rbracket = m.groups()
                return RangeNode(
                    field,
                    start.strip('"'),
                    end.strip('"'),
                    inclusive_start=(lbracket == "["),
                    inclusive_end=(rbracket == "]"),
                )
            raise ParseError(f"Invalid range format: {val}")
        elif kind == "FIELD":
            self.consume()
            # Match longest operators first
            m = re.match(r"^([a-zA-Z_][a-zA-Z0-9_.]*)(:!=|:=|:~|:)(.*)$", val)
            if m:
                field, op, val_str = m.groups()
                if val_str.startswith('"') and val_str.endswith('"'):
                    val_str = val_str[1:-1]
                return FieldNode(field, op, val_str)
            raise ParseError(f"Invalid field format: {val}")
        elif kind == "SEARCH":
            self.consume()
            val_str = val[6:].strip()
            if val_str.startswith('"') and val_str.endswith('"'):
                val_str = val_str[1:-1]
            return SearchNode(val_str)
        elif kind == "STRING":
            self.consume()
            return SearchNode(val[1:-1])
        elif kind == "WORD":
            self.consume()
            return SearchNode(val)
        else:
            raise ParseError(f"Unexpected token: {val}")


def parse_llql(query: str):
    if not query or not query.strip():
        return "", []

    try:
        parser = LLQLParser(query)
        ast = parser.parse()
        if ast:
            return ast.to_sql()
        return "", []
    except Exception as e:
        logger.error("[LLQL] Parsing error: %s, falling back to text search", e)
        return "(l.message ILIKE ? OR l.raw_text ILIKE ?)", [f"%{query}%", f"%{query}%"]
