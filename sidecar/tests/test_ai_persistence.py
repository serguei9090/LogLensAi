import pytest
import uuid
import json
from unittest.mock import MagicMock, AsyncMock
from src.api import App, SendAiMessageRequest
from src.ai.base import AIChatMessage

@pytest.fixture
def api():
    # Use memory DB for isolation
    app = App(db_path=":memory:")
    # Mock the AI provider entirely for persistence testing
    app.ai = MagicMock()
    # Mock the chat response specifically
    app.ai.chat = AsyncMock()
    yield app
    from src.db import Database
    Database.reset()

@pytest.mark.asyncio
async def test_ai_session_task_id_persistence(api):
    # 1. First message should not have taskId
    api.ai.chat.return_value = AIChatMessage(role="assistant", content="Response 1", provider_session_id="task_abc_123")
    
    workspace_id = str(uuid.uuid4())
    req = {
        "workspace_id": workspace_id,
        "message": "Hello"
    }
    
    res1 = await api.method_send_ai_message(**req)
    session_id = res1["session_id"]
    
    # Verify taskId was stored in the DB
    cursor = api.db.get_cursor()
    cursor.execute("SELECT provider_session_id FROM ai_sessions WHERE session_id = ?", (session_id,))
    stored_task_id = cursor.fetchone()[0]
    assert stored_task_id == "task_abc_123"
    
    # 2. Second message should REUSE taskId
    api.ai.chat.return_value = AIChatMessage(role="assistant", content="Response 2", provider_session_id="task_abc_123")
    
    req2 = {
        "workspace_id": workspace_id,
        "session_id": session_id,
        "message": "Continue"
    }
    await api.method_send_ai_message(**req2)
    
    # Verify it was passed correctly (last call's provider_session_id param)
    # The last call includes: history, model, session_id, provider_session_id
    _, kwargs = api.ai.chat.call_args
    assert kwargs["provider_session_id"] == "task_abc_123"

@pytest.mark.asyncio
async def test_ai_session_history_injection_into_chat(api):
    api.ai.chat.return_value = AIChatMessage(role="assistant", content="Reply")
    
    ws = "ws_test"
    # Send message 1
    r1 = await api.method_send_ai_message(workspace_id=ws, message="First msg")
    sid = r1["session_id"]
    
    # Send message 2
    await api.method_send_ai_message(workspace_id=ws, session_id=sid, message="Second msg")
    
    # Verify history in chat includes first msg and its response
    args, _ = api.ai.chat.call_args
    history = args[0]
    
    # Role Sequence: [user:First, assistant:Reply, user:Second]
    assert len(history) == 3
    assert history[0].role == "user"
    assert "First" in history[0].content
    assert history[1].role == "assistant"
    assert history[2].role == "user"
    assert "Second" in history[2].content
