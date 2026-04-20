from query_parser import parse_llql


def test_llql_simple_search():
    sql, params = parse_llql("error")
    assert "ILIKE ?" in sql
    assert "%error%" in params


def test_llql_field_equals():
    sql, params = parse_llql("level:ERROR")
    assert "l.level = ?" in sql
    assert "ERROR" in params


def test_llql_field_not_equals():
    sql, params = parse_llql("level:!=INFO")
    assert "l.level != ?" in sql
    assert "INFO" in params


def test_llql_field_like():
    sql, params = parse_llql("level:~ERR")
    assert "l.level ILIKE ?" in sql
    assert "%ERR%" in params


def test_llql_and_or():
    sql, params = parse_llql("level:ERROR AND source:manual")
    assert "l.level = ?" in sql
    assert "l.source_id = ?" in sql
    assert "AND" in sql
    assert "ERROR" in params
    assert "manual" in params


def test_llql_complex():
    sql, params = parse_llql("(level:ERROR OR level:CRITICAL) AND source:manual")
    assert "(l.level = ? OR l.level = ?)" in sql
    assert "AND l.source_id = ?" in sql


def test_llql_implicit_and():
    sql, params = parse_llql("error connection")
    # Result: ( (l.message ILIKE ? OR l.raw_text ILIKE ?) AND (l.message ILIKE ? OR l.raw_text ILIKE ?) )
    assert "AND" in sql
    assert sql.count("ILIKE ?") == 4
    assert "%error%" in params
    assert "%connection%" in params


def test_llql_not_minus():
    sql, params = parse_llql("-level:INFO")
    assert "(NOT l.level = ?)" in sql
    assert "INFO" in params


def test_llql_not_keyword():
    sql, params = parse_llql("NOT level:INFO")
    assert "(NOT l.level = ?)" in sql
    assert "INFO" in params


def test_llql_complex_implicit():
    sql, params = parse_llql("level:ERROR Connection timeout")
    assert "l.level = ?" in sql
    assert "AND" in sql
    assert "(l.message ILIKE ? OR l.raw_text ILIKE ?)" in sql


def test_llql_field_mappings():
    # Test level, source, cluster
    s1, p1 = parse_llql("level:ERROR")
    assert "l.level =" in s1

    s2, p2 = parse_llql("source:manual")
    assert "l.source_id =" in s2

    s3, p3 = parse_llql("cluster:123")
    assert "l.cluster_id =" in s3

    # Test proposed content and raw mappings
    s4, p4 = parse_llql("content:hello")
    assert "l.message =" in s4

    s5, p5 = parse_llql("raw:world")
    assert "l.raw_text =" in s5
