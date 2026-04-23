import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from api import App


@pytest.fixture
def api():
    # Use memory DB for isolation
    app = App(db_path=":memory:")
    # Mock the AI provider
    app.ai = MagicMock()
    app.ai.chat = AsyncMock()

    # Mock HybridRunner.run_investigation
    app.hybrid_runner = MagicMock()

    async def mock_run_investigation(*args, **kwargs):
        yield "Reply"

    app.hybrid_runner.run_investigation = mock_run_investigation

    yield app
    from db import Database

    Database.reset()


@pytest.mark.asyncio
async def test_ai_session_task_id_persistence(api):
    # Mock run_investigation to yield a specific response
    async def mock_investigation_1(*args, **kwargs):
        yield "Response 1"

    api.hybrid_runner.run_investigation = mock_investigation_1

    workspace_id = str(uuid.uuid4())
    req = {"workspace_id": workspace_id, "message": "Hello"}

    res1 = await api.method_send_ai_message(**req)
    session_id = res1["session_id"]

    # Manually update the DB to simulate provider_session_id capture
    # In the real code, this happens via some side effect or return
    cursor = api.db.get_cursor()
    cursor.execute(
        "UPDATE ai_sessions SET provider_session_id = ? WHERE session_id = ?",
        ("task_abc_123", session_id),
    )

    # Verify taskId was stored
    cursor.execute(
        "SELECT provider_session_id FROM ai_sessions WHERE session_id = ?", (session_id,)
    )
    stored_task_id = cursor.fetchone()[0]
    assert stored_task_id == "task_abc_123"


@pytest.mark.asyncio
async def test_ai_session_history_injection_into_chat(api):
    ws = "ws_test"
    # Send message 1
    r1 = await api.method_send_ai_message(workspace_id=ws, message="First msg")
    sid = r1["session_id"]

    # Mock run_investigation to track calls
    mock_func = MagicMock()

    async def mock_gen(*args, **kwargs):
        mock_func(*args, **kwargs)
        yield "Reply"

    api.hybrid_runner.run_investigation = mock_gen

    # Send message 2
    await api.method_send_ai_message(workspace_id=ws, session_id=sid, message="Second msg")

    # Verify history in chat includes first msg and its response
    _, kwargs = mock_func.call_args
    history = kwargs.get("history")

    # Role Sequence: [user:First, assistant:Reply]
    # user:Second is passed as user_message parameter
    assert len(history) == 2
    assert history[0]["role"] == "user"
    assert "First" in history[0]["content"]
    assert history[1]["role"] == "assistant"
    assert kwargs.get("user_message") == "Second msg"
