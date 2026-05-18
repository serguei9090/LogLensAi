import time
from unittest.mock import MagicMock

import pytest
from db import LogDatabase
from drain3.template_miner_config import TemplateMinerConfig
from workers.clustering import ClusteringWorker, _tag_log_batch


@pytest.fixture
def mock_app():
    app = MagicMock()
    app.db = LogDatabase(":memory:")
    # Initialize schema so tables exist
    app.db.get_cursor()

    # Mock fast_path
    app.fast_path = MagicMock()
    app.fast_path.get_line.return_value = "Mock log text from fast_path"
    app.fast_path.get_lines.return_value = ["Mock log text from fast_path"]

    # Mock get_drain_parser
    parser_mock = MagicMock()
    parser_mock.parse.return_value = {"cluster_id": "1", "template": "Mock Template"}
    parser_mock.get_clusters.return_value = []
    parser_mock.miner.config = TemplateMinerConfig()
    app.get_drain_parser.return_value = parser_mock

    # Mock facet rules
    app._get_facet_rules_for_workspace.return_value = []

    yield app
    app.db.reset()


def test_clustering_worker_start_stop(mock_app):
    worker = ClusteringWorker(mock_app, interval=0.01)
    assert not worker.running
    worker.start()
    assert worker.running
    worker.stop()
    assert not worker.running


def test_clustering_worker_process_batch(mock_app):
    worker = ClusteringWorker(mock_app, batch_size=10, interval=0.01)
    cursor = mock_app.db.get_cursor()
    cursor.execute(
        "INSERT INTO logs (workspace_id, source_id, line_id, raw_text, timestamp, level, processed) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ("ws1", "src1", 1, "Testing log message 1", "2026-05-18T10:00:00Z", "INFO", False),
    )
    mock_app.db.commit()

    processed_count = worker._process_batch()
    assert processed_count == 1

    # Check if processed was set to True
    cursor.execute("SELECT processed FROM logs WHERE line_id = 1")
    res = cursor.fetchone()
    assert res[0] is True


def test_clustering_worker_process_batch_missing(mock_app):
    worker = ClusteringWorker(mock_app, batch_size=10, interval=0.01)
    cursor = mock_app.db.get_cursor()
    cursor.execute(
        "INSERT INTO logs (workspace_id, source_id, line_id, raw_text, timestamp, level, processed) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ("ws1", "src1", 2, None, "2026-05-18T10:00:00Z", "INFO", False),
    )
    mock_app.db.commit()

    mock_app.fast_path.get_lines.return_value = [None]
    processed_count = worker._process_batch()
    # It quarantines the missing log and records a MISSING update.
    assert processed_count == 1


def test_clustering_worker_status(mock_app):
    worker = ClusteringWorker(mock_app, interval=0.01)
    status = worker.get_status()
    assert status["running"] is False
    assert status["paused"] is False
    assert status["mode"] == "auto"


def test_clustering_worker_set_mode(mock_app):
    worker = ClusteringWorker(mock_app, interval=0.01)
    worker.set_mode("burst")
    assert worker.mode == "burst"
    assert worker.paused is False

    worker.set_mode("manual")
    assert worker.mode == "auto"
    assert worker.paused is True


def test_tag_log_batch():
    rows = [
        (1, "ws1", "src1", 1, '{"existing":"val"}', "2026-05-18T10:00:00Z [INFO] System started"),
        (2, "ws1", "src1", 2, None, "2026-05-18T10:00:01Z [ERROR] Disk full"),
        (3, "ws1", "src1", 3, None, None),  # Missing raw text
    ]
    cluster_map = {}
    config = TemplateMinerConfig()
    rules = []
    p_config = {}
    p_tz = 0
    now = time.time()

    results = _tag_log_batch(rows, cluster_map, config, rules, p_config, p_tz, now)

    assert len(results) == 3
    assert results[0]["status"] == "ok"
    assert results[0]["log_id"] == 1
    assert "System started" in results[0]["raw_text"]
    assert "existing" in results[0]["facets_json"]

    assert results[1]["status"] == "ok"
    assert results[1]["log_id"] == 2

    assert results[2]["status"] == "missing"
    assert results[2]["log_id"] == 3


def test_clustering_worker_hydrate_missing(mock_app):
    worker = ClusteringWorker(mock_app, batch_size=10, interval=0.01)
    worker._quarantine = {}

    # Test _hydrate_log_text
    # Should use fast_path
    res = worker._hydrate_log_text("src1", 100, None, time.time())
    assert res == "Mock log text from fast_path"

    # Mock fast_path to return None to trigger quarantine
    mock_app.fast_path.get_line.return_value = None
    now = time.time()

    res = worker._hydrate_log_text("src1", 101, None, now)
    assert res is False  # Quarantined

    # Wait until wait time passes (2^1 = 2 sec)
    res = worker._hydrate_log_text("src1", 101, None, now + 3.0)
    assert res is False  # Still fails, retries = 2

    # Max retries
    worker._quarantine[("src1", 101)] = (8, now)
    res = worker._hydrate_log_text("src1", 101, None, now + 300)
    assert res is None  # Missing permanently


def test_sync_job_statuses(mock_app):
    worker = ClusteringWorker(mock_app, interval=0.01)
    cursor = mock_app.db.get_cursor()
    cursor.execute(
        "INSERT INTO ingestion_jobs (workspace_id, source_id, status, processed_lines) VALUES ('ws1', 'src1', 'processing', 0)"
    )

    worker._sync_job_statuses()

    # Should be set to completed
    cursor.execute(
        "SELECT status, processed_lines FROM ingestion_jobs WHERE workspace_id = 'ws1' AND source_id = 'src1'"
    )
    res = cursor.fetchone()
    assert res[0] == "completed"
    assert res[1] == 0
