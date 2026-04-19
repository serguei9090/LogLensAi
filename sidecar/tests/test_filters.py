import pytest
from api import App


@pytest.fixture
def api():
    app = App(db_path=":memory:")
    yield app
    from db import Database

    Database.reset()


def test_parse_filters_contains(api):
    filters = [{"field": "raw_text", "value": "error", "operator": "contains"}]
    where, params = api._parse_filters(filters)
    assert "raw_text ILIKE ?" in where
    assert "%error%" in params


def test_parse_filters_equals(api):
    filters = [{"field": "level", "value": "INFO", "operator": "equals"}]
    where, params = api._parse_filters(filters)
    assert "level = ?" in where
    assert "INFO" in params


def test_parse_filters_source_id_special_case(api):
    # source_id always uses ILIKE in equals for better matching
    filters = [{"field": "source_id", "value": "src1", "operator": "equals"}]
    where, params = api._parse_filters(filters)
    assert "source_id ILIKE ?" in where
    assert "src1" in params


def test_parse_filters_invalid_field(api):
    filters = [{"field": "invalid", "value": "val", "operator": "equals"}]
    where, params = api._parse_filters(filters)
    assert len(where) == 0


def test_parse_filters_regex(api):
    filters = [{"field": "raw_text", "value": "^[0-9]+", "operator": "regex"}]
    where, params = api._parse_filters(filters)
    assert "regexp_matches(raw_text, ?)" in where
    assert "^[0-9]+" in params
