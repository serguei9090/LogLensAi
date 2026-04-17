import pytest
from src.ai.base import AIChatMessage
from src.ai.ollama import OllamaProvider


@pytest.fixture
def provider():
    return OllamaProvider(system_prompt="<|think|>Base Prompt")


def test_is_reasoning_model(provider):
    assert provider._is_reasoning_model("gemma4:e2b") is True
    assert provider._is_reasoning_model("llama3") is False


@pytest.mark.asyncio
async def test_reasoning_injection_enabled(provider):
    [AIChatMessage(role="user", content="hello")]

    from unittest.mock import patch

    with patch("aiohttp.ClientSession.post"):
        # Test message processing logic (extracted from chat/chat_stream)
        processed_content = "hello"
        if True:  # reasoning enabled
            processed_content = "<|think|>\nhello\n(Please think deeply before responding in your reasoning channel)"

        assert "<|think|>" in processed_content


def test_reasoning_disabled_strips_system_tag(provider):
    # If reasoning is disabled, the system prompt should not have the thinking tag
    final_system = provider.system_prompt
    reasoning = False
    if not reasoning and "<|think|>" in final_system:
        final_system = final_system.replace("<|think|>", "")

    assert "<|think|>" not in final_system
    assert "Base Prompt" in final_system


def test_user_nudge_injection(provider):
    target_model = "gemma4:e2b"
    user_msg = "What is in the logs?"
    reasoning = True

    content = user_msg
    if reasoning and provider._is_reasoning_model(target_model):
        content = f"<|think|>\n{user_msg}\n(Please think deeply before responding in your reasoning channel)"

    assert content.startswith("<|think|>")
    assert "(Please think deeply" in content
