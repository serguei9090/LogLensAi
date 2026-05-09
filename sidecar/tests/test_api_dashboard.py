import pytest
from api import App


@pytest.fixture
def app():
    # Use memory DB for tests
    return App(db_path=":memory:", start_ingestion=False, start_anomalies=False, start_mcp=False)


@pytest.mark.asyncio
async def test_dashboard_stats_filtering(app):
    # 1. Seed some data
    cursor = app.db.get_cursor()

    # Logs for workspace A
    cursor.execute("""
        INSERT INTO logs (workspace_id, source_id, timestamp, level, message, cluster_id)
        VALUES 
        ('ws_a', 'src_1', '2026-05-01 10:00:00', 'INFO', 'Log 1', '1'),
        ('ws_a', 'src_1', '2026-05-01 11:00:00', 'ERROR', 'Log 2', '1'),
        ('ws_a', 'src_2', '2026-05-02 10:00:00', 'WARN', 'Log 3', '2')
    """)

    # Logs for workspace B
    cursor.execute("""
        INSERT INTO logs (workspace_id, source_id, timestamp, level, message, cluster_id)
        VALUES 
        ('ws_b', 'src_3', '2026-05-01 10:00:00', 'INFO', 'Log 4', '1')
    """)

    # Clusters metadata
    cursor.execute("""
        INSERT INTO clusters (workspace_id, cluster_id, template)
        VALUES 
        ('ws_a', '1', 'Template One'),
        ('ws_a', '2', 'Template Two'),
        ('ws_b', '1', 'Template One')
    """)

    app.db.commit()

    # 2. Test Global Stats (no filters)
    stats = app.method_get_dashboard_stats()
    assert stats["total_logs"] == 4
    assert stats["workspace_count"] == 2
    assert len(stats["top_clusters"]) >= 2

    # 3. Test Workspace A Filter
    stats_a = app.method_get_dashboard_stats(workspace_id="ws_a")
    assert stats_a["total_logs"] == 3
    assert stats_a["level_counts"]["INFO"] == 1
    assert stats_a["level_counts"]["ERROR"] == 1
    assert stats_a["level_counts"]["WARN"] == 1
    assert stats_a["total_clusters"] == 2  # 1 and 2

    # 4. Test Source Filter
    stats_src2 = app.method_get_dashboard_stats(workspace_id="ws_a", source_id="src_2")
    assert stats_src2["total_logs"] == 1
    assert stats_src2["level_counts"] == {"WARN": 1}

    # 5. Test Time Filter
    stats_time = app.method_get_dashboard_stats(
        workspace_id="ws_a", start_time="2026-05-01T10:30:00Z", end_time="2026-05-01T23:59:59Z"
    )
    assert stats_time["total_logs"] == 1  # Log 2 only
    assert stats_time["level_counts"] == {"ERROR": 1}

    # 6. Test Top 10 Clusters
    # Add more variety for Top 10
    for i in range(3, 15):
        cursor.execute(
            "INSERT INTO logs (workspace_id, source_id, timestamp, level, message, cluster_id) VALUES (?, ?, ?, ?, ?, ?)",
            ("ws_a", "src_1", "2026-05-03 10:00:00", "INFO", f"Log {i}", str(i)),
        )
    app.db.commit()

    stats_top = app.method_get_dashboard_stats(workspace_id="ws_a")
    assert len(stats_top["top_clusters"]) == 10
