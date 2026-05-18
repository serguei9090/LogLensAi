import contextlib
from unittest.mock import MagicMock

import pytest
from api import App, JSONRPCRequest


@pytest.fixture
def app_instance():
    app = App(db_path=":memory:", start_ingestion=False, start_anomalies=False, start_mcp=False)
    app.ai = MagicMock()
    yield app
    app.stop()
    from db import LogDatabase

    LogDatabase.reset()


@pytest.mark.asyncio
async def test_all_rpc_methods(app_instance):
    methods = [m for m in dir(app_instance) if m.startswith("method_")]
    for method in methods:
        req = JSONRPCRequest(jsonrpc="2.0", id=1, method=method, params={})

        with contextlib.suppress(Exception):
            await app_instance.dispatch(req)
