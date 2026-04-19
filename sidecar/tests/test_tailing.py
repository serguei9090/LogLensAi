from unittest.mock import patch

import pytest
from api import App
from db import Database


@pytest.fixture
def api_app():
    # Ensure DuckDB is reset
    Database.reset()
    app = App()
    return app


def test_method_get_health(api_app):
    """Test standard health reporting endpoint."""
    health = api_app.method_get_health()
    assert health["status"] == "ok"
    assert "database" in health
    assert "active_tailers" in health
    assert isinstance(health["active_tailers"], int)


@patch("api.FileTailer")
def test_method_start_stop_tail(mock_tailer_class, api_app, tmp_path):
    """Test start and stop flow for local file tailing."""
    log_file = tmp_path / "test.log"
    log_file.write_text("initial content")
    filepath = str(log_file)
    workspace_id = "ws-tail-test"

    # Mock behavior
    mock_instance = mock_tailer_class.return_value
    mock_instance.running = True

    # Start
    res = api_app.method_start_tail(filepath, workspace_id)
    assert res["status"] == "started"
    assert len(api_app.tailers) == 1

    # Duplicate start
    res2 = api_app.method_start_tail(filepath, workspace_id)
    assert res2["status"] == "already tailing"

    # Is Tailing check
    assert api_app.method_is_tailing(filepath, workspace_id) is True

    # Stop
    res3 = api_app.method_stop_tail(filepath, workspace_id)
    assert res3["status"] == "stopped"
    assert len(api_app.tailers) == 0
    mock_instance.stop.assert_called_once()


@patch("api.SSHLoader")
def test_method_start_ssh_tail(mock_ssh_class, api_app):
    """Test SSH tailer initialization logic."""
    mock_instance = mock_ssh_class.return_value
    mock_instance.running = True

    host = "10.0.0.1"
    filepath = "/var/log/remote.log"
    workspace_id = "ws-ssh-test"

    res = api_app.method_start_ssh_tail(
        host=host, port=22, username="user", filepath=filepath, workspace_id=workspace_id
    )

    assert res["status"] == "started"
    key = f"ssh:{workspace_id}:{host}:{filepath}"
    assert key in api_app.tailers
    mock_ssh_class.assert_called_once()
    mock_instance.start.assert_called_once()
