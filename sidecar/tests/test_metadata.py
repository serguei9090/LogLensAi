import pytest
from api import App
from metadata_extractor import extract_log_metadata


@pytest.fixture
def mock_db():
    app = App(db_path=":memory:")
    yield app
    from db import Database

    Database.reset()


def test_extract_standard_log(mock_db):
    raw = "2024-03-21 15:30:45 INFO [main] User logged in successfully"
    # Basic heuristic test since we use :memory: DB with no entries
    meta = extract_log_metadata("ws1", "src1", raw)
    assert meta["level"] == "INFO"


def test_extract_iso_log(mock_db):
    raw = "2024-03-21T15:30:45.123Z ERROR Database connection failed"
    meta = extract_log_metadata("ws1", "src1", raw)
    assert meta["level"] == "ERROR"


def test_extract_bracket_level(mock_db):
    raw = "Mar 21 15:30:45 [WARN] Low disk space"
    meta = extract_log_metadata("ws1", "src1", raw)
    assert meta["level"] == "WARN"


def test_extract_no_metadata(mock_db):
    raw = "Just some random text with no date or level"
    meta = extract_log_metadata("ws1", "src1", raw)
    assert meta["level"] == "INFO"  # Default heuristic


def test_extract_complex_java_stacktrace_head(mock_db):
    raw = "2024-03-21 10:00:00,456 FATAL com.example.App: Unexpected null pointer"
    meta = extract_log_metadata("ws1", "src1", raw)
    assert meta["level"] == "FATAL"


def test_extract_facets(mock_db):
    raw = "2024-03-21 15:30:45 INFO user_id=12345 ip=192.168.1.1 email=test@example.com uuid=550e8400-e29b-41d4-a716-446655440000 status=200"
    meta = extract_log_metadata("ws1", "src1", raw)
    facets = meta["facets"]
    assert facets["user_id"] == "12345"
    assert facets["ip"] == "192.168.1.1"
    assert facets["email"] == "test@example.com"
    assert facets["uuid"] == "550e8400-e29b-41d4-a716-446655440000"
    assert facets["status"] == "200"


def test_extract_ipv6(mock_db):
    raw = "2024-03-21 15:30:45 INFO Connection from 2001:0db8:85a3:0000:0000:8a2e:0370:7334"
    meta = extract_log_metadata("ws1", "src1", raw)
    facets = meta["facets"]
    # ipaddress normalizes the address
    assert facets["ip"] == "2001:db8:85a3::8a2e:370:7334"
