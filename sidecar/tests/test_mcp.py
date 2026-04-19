import pytest
from api import App
from db import Database


@pytest.fixture
def app():
    Database.reset()
    a = App(":memory:")
    cursor = a.db.get_cursor()
    cursor.execute("""
        INSERT INTO logs (workspace_id, source_id, timestamp, level, message, cluster_id) VALUES
        ('ws1', 'src1', '2023-10-25 09:00:00', 'INFO', 'test message', 'c1')
    """)
    cursor.execute("""
        INSERT INTO clusters (workspace_id, cluster_id, count, template) VALUES
        ('ws1', 'c1', 1, 'test message template')
    """)
    return a


def test_mcp_tools(app):
    from mcp_server import get_pattern_summary, ls_sources, query_logs

    sources = ls_sources("ws1")
    assert "src1" in sources

    logs = query_logs("ws1", query="test")
    assert logs["total"] == 1
    assert logs["logs"][0]["message"] == "test message"

    patterns = get_pattern_summary("ws1")
    assert len(patterns) == 1
    assert patterns[0]["cluster_id"] == "c1"
