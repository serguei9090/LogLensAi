from unittest.mock import MagicMock

import pytest
from src.api import App, IngestLogEntry


@pytest.fixture
def api():
    # Use memory DB for isolation
    app = App(db_path=":memory:")
    # Mock AI provider to avoid real calls
    app.ai = MagicMock()
    app.ai.analyze.return_value = {
        "summary": "test",
        "root_cause": "test",
        "recommended_actions": [],
    }
    yield app
    from src.db import Database

    Database.reset()


def test_get_settings_initial(api):
    res = api.method_get_settings()
    # Initially settings table might be empty or have default migration data
    assert isinstance(res, dict)


def test_update_settings(api):
    settings = {"ai_provider": "openai", "mcp_server_enabled": "true"}
    res = api.method_update_settings(settings)
    assert res["status"] == "success"

    # Verify persistence
    saved = api.method_get_settings()
    assert saved["ai_provider"] == "openai"
    assert saved["mcp_server_enabled"] == "true"


def test_ingest_and_fetch_logs(api):
    logs = [
        IngestLogEntry(
            workspace_id="ws1",
            source_id="src1",
            raw_text="2023-01-01 10:00:00 INFO Order processed",
            level="INFO",
        ),
        IngestLogEntry(
            workspace_id="ws1",
            source_id="src1",
            raw_text="2023-01-01 10:01:00 ERROR Database timeout",
            level="ERROR",
        ),
    ]
    res_ingest = api.method_ingest_logs(logs)
    assert res_ingest["status"] == "ok"
    assert res_ingest["count"] == 2

    # Fetch logs
    res_fetch = api.method_get_logs(workspace_id="ws1", limit=10)
    assert res_fetch["total"] == 2
    assert len(res_fetch["logs"]) == 2
    assert res_fetch["logs"][0]["level"] == "ERROR"  # Default sort is DESC


def test_get_log_distribution(api):
    api.method_ingest_logs(
        [
            IngestLogEntry(
                workspace_id="ws1",
                source_id="src1",
                raw_text="2023-01-01 10:00:00 INFO Test",
                timestamp="2023-01-01 10:00:00",
            ),
            IngestLogEntry(
                workspace_id="ws1",
                source_id="src1",
                raw_text="2023-01-01 10:00:30 INFO Test",
                timestamp="2023-01-01 10:00:30",
            ),
        ]
    )
    res = api.method_get_log_distribution(workspace_id="ws1")
    assert len(res["buckets"]) > 0
    assert "bucket" in res["buckets"][0]


def test_log_comment(api):
    api.method_ingest_logs([IngestLogEntry(workspace_id="ws1", source_id="src1", raw_text="test")])
    logs = api.method_get_logs(workspace_id="ws1")["logs"]
    log_id = logs[0]["id"]

    api.method_update_log_comment(log_id=log_id, comment="Important")

    updated = api.method_get_logs(workspace_id="ws1")["logs"][0]
    assert updated["comment"] == "Important"
    assert updated["has_comment"] is True


def test_analyze_cluster(api):
    api.method_ingest_logs(
        [IngestLogEntry(workspace_id="ws1", source_id="src1", raw_text="Connection failed")]
    )
    logs = api.method_get_logs(workspace_id="ws1")["logs"]
    cluster_id = logs[0]["cluster_id"]

    res = api.method_analyze_cluster(cluster_id=cluster_id, workspace_id="ws1")
    assert "summary" in res
    api.ai.analyze.assert_called_once()


def test_get_fusion_config_empty(api):
    res = api.method_get_fusion_config(workspace_id="ws1")
    assert res["sources"] == []


def test_update_fusion_config(api):
    from src.api import FusionSourceConfig

    sources = [FusionSourceConfig(source_id="src1", enabled=True, tz_offset=0)]
    api.method_update_fusion_config(workspace_id="ws1", sources=sources)

    res = api.method_get_fusion_config(workspace_id="ws1")
    assert len(res["sources"]) == 1
    assert res["sources"][0]["source_id"] == "src1"
