import pytest
from api import App
from db import LogDatabase


@pytest.fixture
def app():
    LogDatabase.reset()
    a = App(":memory:")
    return a


def test_anomaly_detection_persistence(app):
    cursor = app.db.get_cursor()

    # 1. Setup baseline data (last 24 hours)
    import datetime

    now = datetime.datetime.now()
    for h in range(1, 25):
        ts = (now - datetime.timedelta(hours=h)).strftime("%Y-%m-%d %H:%M:%S")
        # 10 logs per hour for cluster c1
        for _ in range(10):
            cursor.execute(
                "INSERT INTO logs (workspace_id, cluster_id, timestamp) VALUES (?, ?, ?)",
                ("ws1", "c1", ts),
            )

    # 2. Setup current anomaly data (last 5 minutes)
    # 100 logs in last 5 minutes (scaled to hourly rate = 1200, which is >> 10)
    ts_now = now.strftime("%Y-%m-%d %H:%M:%S")
    for _ in range(100):
        cursor.execute(
            "INSERT INTO logs (workspace_id, cluster_id, timestamp) VALUES (?, ?, ?)",
            ("ws1", "c1", ts_now),
        )

    app.db.commit()

    # 3. Run detection
    app.anomaly_detector.detect_anomalies()

    # 4. Check DB for anomaly entry
    cursor.execute("SELECT * FROM anomalies WHERE workspace_id = ?", ("ws1",))
    anomalies = cursor.fetchall()
    assert len(anomalies) > 0
    assert anomalies[0][1] == "c1"  # cluster_id
    assert anomalies[0][3] > 3.0  # z_score should be high

    # 5. Check API method
    res = app.method_get_anomalies(workspace_id="ws1")
    assert len(res["anomalies"]) > 0
    assert res["anomalies"][0]["cluster_id"] == "c1"
