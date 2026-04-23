import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from ai.base import AIChatMessage
from ai.openai_compatible import OpenAICompatibleProvider


@pytest.fixture
def provider():
    return OpenAICompatibleProvider(
        api_key="test_key",
        system_prompt="Test system prompt",
        host="http://localhost:8080/v1",
        model="test-model"
    )

@pytest.mark.asyncio
async def test_init_no_key():
    prov = OpenAICompatibleProvider(api_key="")
    assert prov._client is None
    models = await prov.list_models()
    assert models == []

@pytest.mark.asyncio
@patch("httpx.AsyncClient.get")
async def test_list_models_success(mock_get, provider):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"data": [{"id": "model-1"}, {"id": "model-2"}]}
    mock_get.return_value = mock_response
    
    models = await provider.list_models()
    assert models == ["model-1", "model-2"]

@pytest.mark.asyncio
@patch("httpx.AsyncClient.get")
async def test_list_models_lm_studio_format(mock_get, provider):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"models": [{"key": "model-1"}, {"key": "model-2"}]}
    mock_get.return_value = mock_response
    
    models = await provider.list_models()
    assert models == ["model-1", "model-2"]

@pytest.mark.asyncio
@patch("httpx.AsyncClient.get")
async def test_list_models_error(mock_get, provider):
    mock_get.side_effect = Exception("Connection error")
    models = await provider.list_models()
    assert models == []

@pytest.mark.asyncio
async def test_chat_success(provider):
    mock_client = MagicMock()
    mock_completions = AsyncMock()
    mock_client.chat.completions.create = mock_completions
    
    mock_choice = MagicMock()
    mock_choice.message.content = "Test response"
    mock_res = MagicMock()
    mock_res.choices = [mock_choice]
    mock_completions.return_value = mock_res
    
    provider._client = mock_client
    
    messages = [AIChatMessage(role="user", content="Hello")]
    res = await provider.chat(messages)
    
    assert res.role == "assistant"
    assert res.content == "Test response"
    mock_completions.assert_called_once()
    call_args = mock_completions.call_args[1]
    assert call_args["model"] == "test-model"
    assert call_args["messages"][0] == {"role": "system", "content": "Test system prompt"}
    assert call_args["messages"][1] == {"role": "user", "content": "Hello"}

@pytest.mark.asyncio
async def test_chat_error(provider):
    mock_client = MagicMock()
    mock_completions = AsyncMock()
    mock_completions.side_effect = Exception("API error")
    mock_client.chat.completions.create = mock_completions
    provider._client = mock_client
    
    res = await provider.chat([])
    assert "OpenAI Compatible Error" in res.content

@pytest.mark.asyncio
async def test_chat_stream_success(provider):
    mock_client = MagicMock()
    mock_completions = AsyncMock()
    mock_client.chat.completions.create = mock_completions
    
    async def async_generator():
        chunk1 = MagicMock()
        chunk1.choices = [MagicMock()]
        chunk1.choices[0].delta.content = "Chunk 1 "
        yield chunk1
        
        chunk2 = MagicMock()
        chunk2.choices = [MagicMock()]
        chunk2.choices[0].delta.content = "Chunk 2"
        yield chunk2
        
    mock_completions.return_value = async_generator()
    provider._client = mock_client
    
    chunks = []
    async for chunk in provider.chat_stream([AIChatMessage(role="user", content="Hello")]):
        chunks.append(chunk)
        
    assert chunks == ["Chunk 1 ", "Chunk 2"]

@pytest.mark.asyncio
async def test_chat_stream_error(provider):
    mock_client = MagicMock()
    mock_completions = AsyncMock()
    mock_completions.side_effect = Exception("Stream error")
    mock_client.chat.completions.create = mock_completions
    provider._client = mock_client
    
    chunks = []
    async for chunk in provider.chat_stream([]):
        chunks.append(chunk)
        
    assert "OpenAI Stream Error" in chunks[0]

@pytest.mark.asyncio
async def test_analyze_logs_success(provider):
    mock_client = MagicMock()
    mock_completions = AsyncMock()
    mock_client.chat.completions.create = mock_completions
    
    mock_choice = MagicMock()
    mock_choice.message.content = json.dumps({
        "summary": "Log summary",
        "root_cause": "Test root cause",
        "recommended_actions": ["Action 1"]
    })
    mock_res = MagicMock()
    mock_res.choices = [mock_choice]
    mock_completions.return_value = mock_res
    provider._client = mock_client
    
    res = await provider.analyze_logs("template", ["log1"])
    assert res["summary"] == "Log summary"
    assert res["root_cause"] == "Test root cause"
    assert len(res["recommended_actions"]) == 1

@pytest.mark.asyncio
async def test_analyze_logs_error(provider):
    mock_client = MagicMock()
    mock_completions = AsyncMock()
    mock_completions.side_effect = Exception("Analysis error")
    mock_client.chat.completions.create = mock_completions
    provider._client = mock_client
    
    res = await provider.analyze_logs("template", ["log1"])
    assert res["summary"] == "Analysis failed"

@pytest.mark.asyncio
async def test_test_connection_success(provider):
    provider.list_models = AsyncMock(return_value=["model-1"])
    res = await provider.test_connection()
    assert res["status"] == "success"

@pytest.mark.asyncio
async def test_test_connection_no_models(provider):
    provider.list_models = AsyncMock(return_value=[])
    res = await provider.test_connection()
    assert res["status"] == "error"

@pytest.mark.asyncio
async def test_test_connection_error(provider):
    provider.list_models = AsyncMock(side_effect=Exception("Test error"))
    res = await provider.test_connection()
    assert res["status"] == "error"
