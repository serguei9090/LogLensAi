import time

import aiohttp
import pytest
from api import App


@pytest.mark.asyncio
async def test_full_ingestion_pipeline(tmp_path):
    """
    E2E Test: HTTP Ingest -> DuckDB -> JSON-RPC Retrieval
    """
    db_path = str(tmp_path / "test_e2e.duckdb")
    # Disable background services during init to avoid port conflicts
    app = App(db_path=db_path, start_ingestion=False, start_anomalies=False, start_mcp=False)

    # 1. Start Ingestion Server on a random port
    import socket

    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("", 0))
    port = s.getsockname()[1]
    s.close()

    app.ingestion_server.http_port = port
    app.ingestion_server.start()

    # Wait for server to boot
    time.sleep(1)

    try:
        # 2. Send logs via HTTP
        async with aiohttp.ClientSession() as session:
            payload = [
                {
                    "timestamp": "2024-04-20 12:00:00",
                    "level": "ERROR",
                    "message": "Critical failure in subsystem X",
                    "facets": {"user_id": "user_123", "ip": "192.168.1.1"},
                },
                {
                    "timestamp": "2024-04-20 12:05:00",
                    "level": "INFO",
                    "message": "User login success",
                    "facets": {"user_id": "user_456", "ip": "10.0.0.5"},
                },
            ]
            async with session.post(
                f"http://127.0.0.1:{port}/ingest/e2e-ws/e2e-col", json=payload
            ) as resp:
                assert resp.status == 200
                data = await resp.json()
                assert data["count"] == 2

        # 3. Verify in DuckDB via RPC methods
        # Wait for async ingestion to settle (it's threaded in IngestionServer)
        time.sleep(0.5)

        logs_res = app.method_get_logs(workspace_id="e2e-ws", source_ids=["e2e-col"])
        assert logs_res["total"] == 2

        # Verify facets were extracted and stored correctly
        first_log = logs_res["logs"][0]  # DESC order, so this is the 12:05 one
        assert first_log["level"] == "INFO"
        assert first_log["facets"]["user_id"] == "user_456"

        # 4. Test Facet Aggregation RPC
        facets_res = app.method_get_metadata_facets(workspace_id="e2e-ws", source_ids=["e2e-col"])
        # Expected facets: ip, user_id (and potentially auto-extracted ones)
        facet_names = list(facets_res.keys())
        assert "ip" in facet_names
        assert "user_id" in facet_names

        # Verify IP counts
        ip_values = facets_res["ip"]
        assert len(ip_values) == 2

    finally:
        app.ingestion_server.stop()
        from db import LogDatabase

        LogDatabase.reset()
