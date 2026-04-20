import pytest
from api import App


@pytest.mark.asyncio
async def test_get_dashboard_stats(tmp_path):
    db_path = str(tmp_path / "test_stats.duckdb")
    app = App(db_path=db_path, start_ingestion=False, start_anomalies=False, start_mcp=False)

    # 1. Seed some data
    cursor = app.db.get_cursor()
    cursor.execute("""
        INSERT INTO logs (workspace_id, source_id, timestamp, level, message, cluster_id) 
        VALUES ('ws1', 'src1', '2024-01-01 10:00:00', 'ERROR', 'Failure', 'c1')
    """)
    cursor.execute("""
        INSERT INTO logs (workspace_id, source_id, timestamp, level, message, cluster_id) 
        VALUES ('ws1', 'src1', '2024-01-01 10:01:00', 'INFO', 'Success', 'c2')
    """)
    cursor.execute("""
        INSERT INTO clusters (workspace_id, cluster_id, template, count) 
        VALUES ('ws1', 'c1', 'Failure', 1), ('ws1', 'c2', 'Success', 1)
    """)
    app.db.commit()

    # 2. Call method
    stats = app.method_get_dashboard_stats(workspace_id="ws1")

    # 3. Assertions
    assert stats["total_logs"] == 2
    assert stats["total_clusters"] == 2
    assert stats["level_counts"]["ERROR"] == 1
    assert stats["level_counts"]["INFO"] == 1
    assert len(stats["top_clusters"]) == 2
    assert stats["workspace_count"] == 1
    assert stats["active_tailers"] == 0
