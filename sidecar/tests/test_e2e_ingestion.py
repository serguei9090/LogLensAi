import os
import tempfile

import pytest
from api import App, JSONRPCRequest
from db import Database


@pytest.fixture
def mock_log_file():
    with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".log") as f:
        f.write("2023-10-01 10:00:00 [INFO] Server started\n")
        f.write("2023-10-01 10:00:05 [ERROR] Connection failed timeout\n")
        f.flush()
        yield f.name
    os.remove(f.name)


@pytest.fixture
def e2e_api():
    app = App(db_path=":memory:")
    yield app
    Database.reset()


@pytest.mark.asyncio
async def test_start_tail_and_get_logs(e2e_api, mock_log_file):
    req_start = JSONRPCRequest(
        id=1, method="start_tail", params={"filepath": mock_log_file, "workspace_id": "test_e2e_ws"}
    )
    res_start = await e2e_api.dispatch(req_start)
    assert res_start.result["status"] == "started"

    # Wait for tailer thread to process lines
    import asyncio

    await asyncio.sleep(1)

    req_logs = JSONRPCRequest(id=2, method="get_logs", params={"workspace_id": "test_e2e_ws"})
    await e2e_api.dispatch(req_logs)

    # Note: FileTailer reads from EOF because it's a "tail".
    # Let's append a log line to test actual ingestion.
    with open(mock_log_file, "a") as f:
        f.write("2023-10-01 10:00:10 [DEBUG] New log entry\n")
        f.flush()

    await asyncio.sleep(1)

    res_logs_after = await e2e_api.dispatch(req_logs)

    assert res_logs_after.result["total"] >= 1
    assert any("New log entry" in log["message"] for log in res_logs_after.result["logs"])

    # Cleanup
    req_stop = JSONRPCRequest(
        id=3, method="stop_tail", params={"filepath": mock_log_file, "workspace_id": "test_e2e_ws"}
    )
    await e2e_api.dispatch(req_stop)
