from metadata_extractor import (
    _apply_custom_extractions,
    _extract_base_metadata,
    extract_log_metadata,
)


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


def test_extract_base_metadata_no_config():
    line = "ERROR: Something went wrong"
    ts, lvl, msg = _extract_base_metadata(line)
    assert lvl == "ERROR"
    assert msg == line


def test_extract_base_metadata_with_config():
    config = {"regex": r"^(?P<timestamp>.*?) \[(?P<level>.*?)\] (?P<message>.*)$"}
    line = "2026-04-23 12:00:00 [DEBUG] Detailed info"
    ts, lvl, msg = _extract_base_metadata(line, parser_config=config)
    assert ts == "2026-04-23 12:00:00.000"
    assert lvl == "DEBUG"
    assert msg == "Detailed info"


def test_extract_base_metadata_with_timezone():
    config = {"regex": r"^(?P<timestamp>[\d\- :]{19}) (?P<message>.*)$"}
    line = "2026-04-23 12:00:00 Something happened"
    ts, _, _ = _extract_base_metadata(line, parser_config=config, tz_offset=2)
    assert ts == "2026-04-23 14:00:00.000"


def test_extract_log_metadata_full():
    line = "ERROR [main] user_id=admin 192.168.1.1 GET /login"
    result = extract_log_metadata(line)
    assert result["level"] == "ERROR"
    assert result["message"] == line


def test_extract_base_metadata_exception():
    config = {"regex": "["}
    _, lvl, msg = _extract_base_metadata("Some line", parser_config=config)
    assert lvl == "INFO"
    assert msg == "Some line"


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
    _apply_custom_extractions(line, rules, facets)
    assert "bad" not in facets
