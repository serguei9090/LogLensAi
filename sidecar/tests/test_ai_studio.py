from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from ai.ai_studio import AIStudioProvider
from ai.base import AIChatMessage


@pytest.fixture
def provider():
    # Reset class-level cache before each test
    AIStudioProvider._cached_models = None
    AIStudioProvider._cache_timestamp = 0
    with patch("ai.ai_studio.Client"):
        p = AIStudioProvider(
            api_key="AIza_test_key", system_prompt="System prompt", model="gemini-2.0-flash"
        )
        return p


@pytest.mark.asyncio
async def test_init_and_patch(provider):
    assert provider.api_key == "AIza_test_key"
    assert provider.active_model == "gemini-2.0-flash"


@pytest.mark.asyncio
async def test_list_models_success(provider):
    mock_client = MagicMock()
    provider._client = mock_client

    mock_model_1 = MagicMock()
    mock_model_1.name = "models/gemini-pro"
    mock_model_2 = MagicMock()
    mock_model_2.name = "models/gemma-7b"
    mock_client.models.list.return_value = [mock_model_1, mock_model_2]

    models = await provider.list_models()
    assert "models/gemini-pro" in models
    assert "models/gemma-7b" in models
    assert AIStudioProvider._cached_models == models


@pytest.mark.asyncio
@patch("google.generativeai.list_models")
@patch("google.generativeai.configure")
async def test_list_models_legacy_fallback(mock_configure, mock_list_legacy, provider):
    mock_client = MagicMock()
    provider._client = mock_client
    # Mock new client to fail
    mock_client.models.list.side_effect = Exception("New SDK failed")

    mock_m1 = MagicMock()
    mock_m1.name = "models/gemini-1.5-flash"
    mock_list_legacy.return_value = [mock_m1]

    models = await provider.list_models()
    assert "models/gemini-1.5-flash" in models
    mock_configure.assert_called_once()


@pytest.mark.asyncio
async def test_prepare_messages_gemma_thinking(provider):
    messages = [AIChatMessage(role="user", content="Hello")]
    prepared = provider._prepare_messages(messages, "models/gemma-2-9b", reasoning=True)
    assert "<|think|>" in prepared[0].content
    assert "System prompt" in prepared[0].content


@pytest.mark.asyncio
@patch("ai.ai_studio.Runner")
@patch("ai.ai_studio.InMemorySessionService")
async def test_chat_success(mock_session_service_cls, mock_runner_cls, provider):
    mock_session_service = MagicMock()
    mock_session_service_cls.return_value = mock_session_service
    mock_session_service.create_session = AsyncMock(return_value="session_obj")
    mock_session_service.append_event = AsyncMock()

    mock_runner = MagicMock()
    mock_runner_cls.return_value = mock_runner

    async def mock_run_async(*args, **kwargs):
        mock_event = MagicMock()
        mock_event.is_final_response.return_value = True

        mock_part = MagicMock()
        mock_part.text = "The answer is 42"
        mock_part.thought = False

        mock_event.content.parts = [mock_part]
        yield mock_event

    mock_runner.run_async.side_effect = mock_run_async

    messages = [AIChatMessage(role="user", content="What is the answer?")]
    response = await provider.chat(messages)

    assert response.content == "The answer is 42"
    assert response.role == "assistant"


@pytest.mark.asyncio
@patch("ai.ai_studio.Runner")
@patch("ai.ai_studio.InMemorySessionService")
async def test_chat_with_thinking(mock_session_service_cls, mock_runner_cls, provider):
    mock_session_service = MagicMock()
    mock_session_service_cls.return_value = mock_session_service
    mock_session_service.create_session = AsyncMock(return_value="session_obj")

    mock_runner = MagicMock()
    mock_runner_cls.return_value = mock_runner

    async def mock_run_async(*args, **kwargs):
        mock_event = MagicMock()
        mock_event.is_final_response.return_value = True

        mock_part_thought = MagicMock()
        mock_part_thought.thought = True
        mock_part_thought.text = "Thinking..."

        mock_part_text = MagicMock()
        mock_part_text.thought = False
        mock_part_text.text = "Final answer"

        mock_event.content.parts = [mock_part_thought, mock_part_text]
        yield mock_event

    mock_runner.run_async.side_effect = mock_run_async

    messages = [AIChatMessage(role="user", content="Calculate X")]
    response = await provider.chat(messages, model="gemma-4")

    assert "<think>Thinking...</think>Final answer" in response.content


@pytest.mark.asyncio
@patch("ai.ai_studio.Runner")
@patch("ai.ai_studio.InMemorySessionService")
async def test_chat_stream_success(mock_session_service_cls, mock_runner_cls, provider):
    mock_session_service = MagicMock()
    mock_session_service_cls.return_value = mock_session_service
    mock_session_service.create_session = AsyncMock(return_value="session_obj")

    mock_runner = MagicMock()
    mock_runner_cls.return_value = mock_runner

    async def mock_run_async(*args, **kwargs):
        ev1 = MagicMock()
        p1 = MagicMock()
        p1.thought = True
        p1.text = "Hmm"
        ev1.content.parts = [p1]
        yield ev1

        ev2 = MagicMock()
        p2 = MagicMock()
        p2.thought = False
        p2.text = "Result"
        ev2.content.parts = [p2]
        yield ev2

    mock_runner.run_async.side_effect = mock_run_async

    chunks = []
    async for chunk in provider.chat_stream(
        [AIChatMessage(role="user", content="Stream this")], model="gemma-4"
    ):
        chunks.append(chunk)

    combined = "".join(chunks)
    assert "<think>" in combined
    assert "Hmm" in combined
    assert "</think>" in combined
    assert "Result" in combined


@pytest.mark.asyncio
async def test_analyze_logs_success(provider):
    mock_client = MagicMock()
    provider._client = mock_client

    mock_res = MagicMock()
    mock_res.parsed = {"summary": "Cluster summary"}
    mock_client.models.generate_content.return_value = mock_res

    res = await provider.analyze_logs("template", ["log1"])
    assert res["summary"] == "Cluster summary"


@pytest.mark.asyncio
async def test_test_connection_invalid_key(provider):
    provider.api_key = "invalid"
    res = await provider.test_connection()
    assert res["status"] == "error"
    assert "Invalid key format" in res["message"]


@pytest.mark.asyncio
async def test_test_connection_success(provider):
    mock_client = MagicMock()
    provider._client = mock_client

    mock_m = MagicMock()
    mock_m.name = "models/gemini-2.0-flash"
    mock_client.models.list.return_value = [mock_m]

    res = await provider.test_connection()
    assert res["status"] == "success"
    assert "Successfully connected" in res["message"]


@pytest.mark.asyncio
async def test_test_connection_no_models(provider):
    mock_client = MagicMock()
    provider._client = mock_client

    mock_client.models.list.return_value = []

    res = await provider.test_connection()
    assert res["status"] == "warning"
    assert "could not fetch models" in res["message"]


@pytest.mark.asyncio
@patch("ai.ai_studio.Runner")
@patch("ai.ai_studio.InMemorySessionService")
async def test_chat_error_retry_default(mock_session_service_cls, mock_runner_cls, provider):
    mock_runner = MagicMock()
    mock_runner_cls.return_value = mock_runner
    mock_session_service = MagicMock()
    mock_session_service_cls.return_value = mock_session_service
    mock_session_service.create_session = AsyncMock(return_value="session_obj")

    call_count = 0

    async def mock_run_async(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise Exception("404 Model not found")

        mock_event = MagicMock()
        mock_event.is_final_response.return_value = True
        mock_part = MagicMock()
        mock_part.text = "Default answer"
        mock_part.thought = False
        mock_event.content.parts = [mock_part]
        yield mock_event

    mock_runner.run_async.side_effect = mock_run_async

    # Use gemini prefix to bypass early fallback in _get_target_model_and_mode
    res = await provider.chat(
        [AIChatMessage(role="user", content="Hi")], model="gemini-non-existent"
    )
    assert res.content == "Default answer"
    assert call_count == 2
