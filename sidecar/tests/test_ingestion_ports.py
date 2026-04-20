import socket
import time

import pytest
import requests
from api import App
from db import LogDatabase


@pytest.fixture
def app(monkeypatch):
    import socket

    def get_free_port():
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("", 0))
            return s.getsockname()[1]

    syslog_port = get_free_port()
    http_port = get_free_port()

    # Mock settings to return our free ports
    original_get_settings = App.method_get_settings

    def mock_get_settings(self, workspace_id=None):
        settings = original_get_settings(self, workspace_id)
        settings["ingestion_syslog_port"] = str(syslog_port)
        settings["ingestion_http_port"] = str(http_port)
        return settings

    monkeypatch.setattr(App, "method_get_settings", mock_get_settings)

    a = App(db_path=":memory:")
    a.test_syslog_port = syslog_port
    a.test_http_port = http_port
    yield a
    a.ingestion_server.stop()
    LogDatabase.reset()


def test_syslog_ingestion(app):
    # Send a UDP packet to dynamic port
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    message = "2023-10-01 12:00:00 [ERROR] Syslog test message"
    sock.sendto(message.encode(), ("127.0.0.1", app.test_syslog_port))

    # Wait for ingestion
    time.sleep(1.5)

    # Check DB
    logs = app.method_get_logs(workspace_id="default")
    assert logs["total"] >= 1
    assert any("Syslog test message" in log["message"] for log in logs["logs"])
    assert any("syslog" in log["source_id"] for log in logs["logs"])


def test_http_ingestion(app):
    # Send an HTTP POST to dynamic port with explicit workspace in URL
    workspace_id = "http_test"
    payload = {
        "raw_text": "2023-10-01 12:05:00 [INFO] HTTP test message",
        "level": "INFO",
    }
    response = requests.post(
        f"http://127.0.0.1:{app.test_http_port}/ingest/{workspace_id}", json=payload
    )
    assert response.status_code == 200

    # Check DB
    logs = app.method_get_logs(workspace_id=workspace_id)
    assert logs["total"] == 1
    assert logs["logs"][0]["message"] == "2023-10-01 12:05:00 [INFO] HTTP test message"
    assert logs["logs"][0]["source_id"] == "http-ingest"
