import json
from unittest.mock import MagicMock, patch

import pytest
from metadata_extractor import (
    _apply_custom_extractions,
    _extract_base_metadata,
    _extract_context_facets,
    _extract_heuristic_facets,
    _extract_kv_facets,
    extract_log_metadata,
)


@pytest.fixture
def mock_db():
    with patch("metadata_extractor.Database") as mock_class:
        mock_instance = MagicMock()
        mock_class.return_value = mock_instance
        mock_cursor = MagicMock()
        mock_instance.get_cursor.return_value = mock_cursor
        yield mock_cursor


def test_extract_heuristic_facets():
    line = (
        "Error from 192.168.1.1 for user 550e8400-e29b-41d4-a716-446655440000 status: 404 GET /api"
    )
    facets = _extract_heuristic_facets(line)
    assert facets["ip"] == "192.168.1.1"
    assert facets["uuid"] == "550e8400-e29b-41d4-a716-446655440000"
    assert facets["status"] == "404"
    assert facets["method"] == "GET"


def test_extract_heuristic_facets_ipv6():
    line = "Connection from 2001:0db8:85a3:0000:0000:8a2e:0370:7334"
    facets = _extract_heuristic_facets(line)
    assert facets["ip"] == "2001:db8:85a3::8a2e:370:7334"


def test_extract_heuristic_facets_email():
    line = "User alert for test@example.com"
    facets = _extract_heuristic_facets(line)
    assert facets["email"] == "test@example.com"


def test_extract_context_facets():
    line = "host:server-01 [thread-main] logger:com.app.Service"
    facets = {}
    _extract_context_facets(line, facets)
    assert facets["host"] == "server-01"
    assert facets["thread"] == "thread-main"
    assert facets["logger"] == "com.app.Service"


def test_extract_kv_facets():
    line = "key1=val1 key2=val2-abc timestamp=123"
    facets = {}
    _extract_kv_facets(line, facets)
    assert facets["key1"] == "val1"
    assert facets["key2"] == "val2-abc"
    assert "timestamp" not in facets  # Reserved key


def test_apply_custom_extractions():
    line = "ORDER_ID: 12345"
    rules = [
        {"name": "order_id", "regex": r"ORDER_ID: (\d+)", "enabled": True},
        {"name": "ignored", "regex": r"MISSING", "enabled": True},
        {"name": "disabled", "regex": r"ORDER_ID", "enabled": False},
    ]
    facets = {}
    _apply_custom_extractions(line, rules, facets)
    assert facets["order_id"] == "12345"
    assert "ignored" not in facets
    assert "disabled" not in facets


def test_extract_base_metadata_no_config(mock_db):
    mock_db.fetchone.return_value = None
    line = "ERROR: Something went wrong"
    ts, lvl, msg = _extract_base_metadata("ws1", "src1", line)
    assert lvl == "ERROR"
    assert msg == line


def test_extract_base_metadata_with_config(mock_db):
    # Mock config with regex: ^(?P<timestamp>.*?) \[(?P<level>.*?)\] (?P<message>.*)$
    config = {"regex": r"^(?P<timestamp>.*?) \[(?P<level>.*?)\] (?P<message>.*)$"}
    mock_db.fetchone.return_value = (json.dumps(config), 0)

    line = "2026-04-23 12:00:00 [DEBUG] Detailed info"
    ts, lvl, msg = _extract_base_metadata("ws1", "src1", line)
    assert ts == "2026-04-23 12:00:00"
    assert lvl == "DEBUG"
    assert msg == "Detailed info"


def test_extract_base_metadata_with_timezone(mock_db):
    # Use a more explicit regex to avoid non-greedy capture issues
    config = {"regex": r"^(?P<timestamp>[\d\- :]{19}) (?P<message>.*)$"}
    mock_db.fetchone.return_value = (json.dumps(config), 2)  # +2 hours

    line = "2026-04-23 12:00:00 Something happened"
    ts, lvl, msg = _extract_base_metadata("ws1", "src1", line)
    assert ts == "2026-04-23 14:00:00"


def test_extract_log_metadata_full(mock_db):
    mock_db.fetchone.return_value = None
    line = "ERROR [main] user_id=admin 192.168.1.1 GET /login"
    result = extract_log_metadata("ws1", "src1", line)
    assert result["level"] == "ERROR"
    assert result["facets"]["user_id"] == "admin"
    assert result["facets"]["ip"] == "192.168.1.1"
    assert result["facets"]["method"] == "GET"
    assert result["facets"]["thread"] == "main"


def test_extract_base_metadata_exception(mock_db):
    mock_db.execute.side_effect = Exception("DB error")
    ts, lvl, msg = _extract_base_metadata("ws1", "src1", "Some line")
    assert lvl == "INFO"  # Default
    assert msg == "Some line"


def test_extract_heuristic_facets_invalid_ip():
    line = "Not an IP: 999.999.999.999"
    facets = _extract_heuristic_facets(line)
    assert "ip" not in facets


def test_apply_custom_extractions_named_group():
    line = "User: alice"
    rules = [{"name": "user", "regex": r"User: (?P<user>\w+)", "enabled": True}]
    facets = {}
    _apply_custom_extractions(line, rules, facets)
    assert facets["user"] == "alice"


def test_apply_custom_extractions_invalid_regex():
    line = "something"
    rules = [{"name": "bad", "regex": "[", "enabled": True}]
    facets = {}
    _apply_custom_extractions(line, rules, facets)  # Should not raise
    assert "bad" not in facets
