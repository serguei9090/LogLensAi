from unittest.mock import MagicMock, patch

import pytest
from api import App, on_cleanup, run_stdio_async, start_background_http


def test_extract_a2ui_payload():
    app = App(db_path=":memory:", start_ingestion=False, start_anomalies=False, start_mcp=False)
    # Valid payload
    text1 = 'Some text <a2ui>{"type":"chart"}</a2ui> more text'
    res1 = app._extract_a2ui_payload(text1)
    assert res1 == {"type": "chart"}

    # Invalid JSON payload
    text2 = "Some text <a2ui>not json</a2ui> more text"
    res2 = app._extract_a2ui_payload(text2)
    assert res2 == {"type": "markup", "raw": "not json"}

    # No tags
    res3 = app._extract_a2ui_payload("just text")
    assert res3 is None
    app.stop()


@pytest.mark.asyncio
async def test_on_cleanup():
    server_app = {}
    app = App(db_path=":memory:", start_ingestion=False, start_anomalies=False, start_mcp=False)
    app.stop_async = pytest.AsyncMock()
    server_app["sidecar_app"] = app
    await on_cleanup(server_app)
    app.stop_async.assert_called_once()


@pytest.mark.asyncio
async def test_start_background_http():
    app = App(db_path=":memory:", start_ingestion=False, start_anomalies=False, start_mcp=False)
    runner = await start_background_http(app, port=5001)
    assert runner is not None
    await runner.cleanup()
    app.stop()


@pytest.mark.asyncio
async def test_run_stdio_async(monkeypatch):
    app_mock = MagicMock()
    app_mock.dispatch = pytest.AsyncMock(
        return_value=MagicMock(model_dump=lambda: {"jsonrpc": "2.0"})
    )
    app_mock.stop_async = pytest.AsyncMock()

    with patch("api.App", return_value=app_mock):

        async def mock_readline():
            lines = [
                '{"jsonrpc": "2.0", "method": "method_get_health", "id": 1}\n',
                "invalid json\n",
                '{"invalid": "req"}\n',
                "",
            ]
            for line in lines:
                yield line

        # Patch sys.stdin.readline
        iterator = mock_readline()

        async def mock_run_in_executor(*args):
            try:
                return await anext(iterator)
            except StopAsyncIteration:
                return ""

        loop_mock = MagicMock()
        loop_mock.run_in_executor = mock_run_in_executor

        with patch("asyncio.get_event_loop", return_value=loop_mock):
            await run_stdio_async(db_path=":memory:", start_http=False)

        app_mock.stop_async.assert_called_once()
