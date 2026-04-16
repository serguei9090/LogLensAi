from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from src.ai.ai_studio import AIStudioProvider
from src.ai.base import AIChatMessage
from src.ai.gemini_cli import GeminiCLIProvider
from src.ai.ollama import OllamaProvider


@pytest.mark.asyncio
async def test_ollama_provider_chat_mock():
    provider = OllamaProvider(host="http://localhost:11434", system_prompt="System msg")
    
    with patch("aiohttp.ClientSession.post") as mock_post:
        mock_resp = AsyncMock()
        mock_resp.status = 200
        mock_resp.json.return_value = {"message": {"content": "Ollama response"}}
        mock_post.return_value.__aenter__.return_value = mock_resp
        
        msg = AIChatMessage(role="user", content="Test prompt")
        res = await provider.chat([msg], model="llama3")
        
        assert res.content == "Ollama response"
        _, kwargs = mock_post.call_args
        payload = kwargs["json"]
        # In current OllamaProvider.chat, we extend messages with the log history
        # If no prior messages, it sends: [system, latest_user]
        assert payload["messages"][0]["role"] == "system"
        assert payload["messages"][0]["content"] == "System msg"

@pytest.mark.asyncio
async def test_gemini_cli_hot_mode_resume():
    provider = GeminiCLIProvider(host="http://localhost:22436")
    
    class AsyncMockStream:
        def __init__(self, items):
            self.items = items
        async def __aiter__(self):
            for item in self.items:
                yield item

    with patch("aiohttp.ClientSession") as mock_session_cls:
        mock_session = MagicMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session_cls.return_value = mock_session
        
        # mock task check
        mock_get_resp = AsyncMock()
        mock_get_resp.status = 200
        mock_get_ctx = MagicMock()
        mock_get_ctx.__aenter__ = AsyncMock(return_value=mock_get_resp)
        mock_session.get.return_value = mock_get_ctx
        
        # mock chat response
        mock_post_resp = AsyncMock()
        mock_post_resp.status = 200
        mock_post_resp.content = AsyncMockStream([
            b'data: {"message": {"parts": [{"kind": "text", "text": "Hot response"}]}}\n\n'
        ])
        mock_post_ctx = MagicMock()
        mock_post_ctx.__aenter__ = AsyncMock(return_value=mock_post_resp)
        mock_session.post.return_value = mock_post_ctx
        
        msg = AIChatMessage(role="user", content="Hello")
        with patch.object(GeminiCLIProvider, "_chat_cold") as mock_cold:
            mock_cold.side_effect = Exception("Cold mode was triggered!")
            res = await provider.chat([msg], session_id="sid1", provider_session_id="task_123")
        
        assert res.content == "Hot response"

@pytest.mark.asyncio
async def test_ai_studio_provider_error_handling():
    provider = AIStudioProvider(api_key="") # Missing key
    msg = AIChatMessage(role="user", content="test")
    res = await provider.chat([msg])
    assert "Error: No API Key" in res.content
