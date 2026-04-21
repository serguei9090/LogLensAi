from query_parser import parse_llql


def test_llql_wildcards_search():
    # '*' should become '%'
    sql, params = parse_llql("conn*")
    assert "ILIKE ?" in sql
    assert "conn%" in params
    assert "%conn*%" not in params


def test_llql_wildcards_field():
    sql, params = parse_llql("source:auth*")
    assert "l.source_id ILIKE ?" in sql
    assert "auth%" in params


def test_llql_range_inclusive():
    sql, params = parse_llql("id:[100 TO 200]")
    assert "(l.id >= ? AND l.id <= ?)" in sql
    assert 100 in params or "100" in params
    assert 200 in params or "200" in params


def test_llql_range_exclusive():
    sql, params = parse_llql("id:{100 TO 200}")
    assert "(l.id > ? AND l.id < ?)" in sql


def test_llql_range_mixed():
    sql, params = parse_llql("level:ERROR AND id:[100 TO 200]")
    assert "l.level = ?" in sql
    assert "(l.id >= ? AND l.id <= ?)" in sql


def test_llql_plus_operator():
    sql, params = parse_llql("+level:ERROR")
    assert "l.level = ?" in sql


def test_llql_escaping():
    sql, params = parse_llql(r"source:auth\*")
    assert "l.source_id = ?" in sql
    assert "auth*" in params
    assert "ILIKE" not in sql
