import pytest
from db import LogDatabase


@pytest.fixture
def db():
    # Reset singleton to ensure fresh memory DB
    LogDatabase.reset()
    d = LogDatabase(":memory:")
    yield d
    LogDatabase.reset()


def test_get_filter_condition(db):
    clause, param = db._get_filter_condition("l.level", "contains", "ERROR")
    assert clause == "l.level ILIKE ?"
    assert param == "%ERROR%"

    clause, param = db._get_filter_condition("l.level", "regex", "^ER")
    assert clause == "regexp_matches(l.level, ?)"
    assert param == "^ER"


def test_parse_filters(db):
    filters = [
        {"field": "level", "operator": "equals", "value": "INFO"},
        {"field": "facets.ip", "operator": "equals", "value": "1.1.1.1"},
        {"field": "unknown", "value": "test"},  # Should be ignored
    ]
    clauses, params = db._parse_filters(filters)
    assert len(clauses) == 2
    assert "l.level = ?" in clauses
    assert "json_extract_string(l.facets, '$.ip')" in clauses[1]


def test_process_log_results(db):
    # Mock a cursor result
    class MockCursor:
        description = [("id",), ("facets",)]

        def fetchall(self):
            return [(1, '{"ip": "1.1.1.1"}'), (2, None), (3, "invalid json")]

    logs = db._process_log_results(MockCursor())
    assert len(logs) == 3
    assert logs[0]["facets"]["ip"] == "1.1.1.1"
    assert logs[1]["facets"] == {}
    assert logs[2]["facets"] == {}


def test_get_facet_keys(db):
    cursor = db.get_cursor()
    # Add some extra rules
    cursor.execute(
        "INSERT INTO settings (key, value) VALUES ('facet_extractions', '[{\"name\": \"custom1\"}]')"
    )
    cursor.execute(
        "INSERT INTO workspace_settings (workspace_id, key, value) VALUES ('ws1', 'facet_extractions', '[{\"name\": \"custom2\"}]')"
    )
    db.commit()

    keys = db._get_facet_keys("ws1")
    assert "ip" in keys
    assert "custom1" in keys
    assert "custom2" in keys


def test_apply_temporal_offsets(db):
    cursor = db.get_cursor()
    cursor.execute(
        "INSERT INTO temporal_offsets (workspace_id, source_id, offset_seconds) VALUES ('ws1', 's1', 3600)"
    )
    db.commit()

    logs = [
        {"source_id": "s1", "timestamp": "2026-04-23 12:00:00"},
        {"source_id": "s2", "timestamp": "2026-04-23 12:00:00"},
    ]
    db._apply_temporal_offsets("ws1", logs)

    assert logs[0]["timestamp"] == "2026-04-23 13:00:00"  # Shifted
    assert logs[1]["timestamp"] == "2026-04-23 12:00:00"  # No shift
