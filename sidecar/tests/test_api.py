import pytest
from src.api import App, JSONRPCRequest


@pytest.fixture
def api():
    app = App(db_path=":memory:")
    yield app
    from src.db import Database

    Database.reset()


def test_json_rpc_dispatch(api):
    req = JSONRPCRequest(id=1, method="get_logs", params={"workspace_id": "test_ws", "limit": 10})
    res = api.dispatch(req)

    assert res.jsonrpc == "2.0"
    assert res.id == 1
    assert res.error is None
    assert "logs" in res.result
    assert res.result["total"] == 0


def test_invalid_method(api):
    req = JSONRPCRequest(id=2, method="non_existent", params={})
    res = api.dispatch(req)

    assert res.error is not None
    assert res.error["code"] == -32601
