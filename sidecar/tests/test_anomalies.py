import pytest
from src.api import App
from src.db import Database


@pytest.fixture
def app():
    Database.reset()
    a = App(":memory:")
    cursor = a.db.get_cursor()
    cursor.execute("""
        INSERT INTO clusters (workspace_id, cluster_id, count, template) VALUES
        ('ws1', 'c1', 100, 'Pattern 1'),
        ('ws1', 'c2', 1, 'Pattern 2')
    """)
    # Simulate time distribution for anomaly
    cursor.execute("""
        INSERT INTO logs (workspace_id, source_id, timestamp, level, message, cluster_id) VALUES
        ('ws1', 'src1', '2023-10-25 09:00:00', 'INFO', 'msg1', 'c1'),
        ('ws1', 'src1', '2023-10-25 09:00:15', 'INFO', 'msg2', 'c1'),
        ('ws1', 'src1', '2023-10-25 10:00:00', 'INFO', 'msg3', 'c1'),
        ('ws1', 'src1', '2023-10-25 10:00:10', 'ERROR', 'msg4', 'c2')
    """)
    return a

def test_get_anomalies(app):
    res = app.method_get_anomalies(workspace_id='ws1')
    assert "anomalies" in res
    # For now just checking it returns successfully and we can structure the mock response
    assert isinstance(res["anomalies"], list)

