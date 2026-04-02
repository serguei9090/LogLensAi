import pytest
from src.metadata_extractor import extract_log_metadata
from src.api import App

@pytest.fixture
def mock_db():
    app = App(db_path=":memory:")
    yield app
    from src.db import Database
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
    assert meta["level"] == "INFO" # Default heuristic

def test_extract_complex_java_stacktrace_head(mock_db):
    raw = "2024-03-21 10:00:00,456 FATAL com.example.App: Unexpected null pointer"
    meta = extract_log_metadata("ws1", "src1", raw)
    assert meta["level"] == "FATAL"
