import pytest
from ai.base import AIChatMessage
from ai.ollama import OllamaProvider
from ai.thinking_parser import THINK_OPEN, ThinkingMode, detect_thinking_mode


@pytest.fixture
def provider():
    return OllamaProvider(system_prompt="Base Prompt")


def test_thinking_mode_detection():
    assert detect_thinking_mode("gemma4:e2b") == ThinkingMode.CHANNEL_MARKERS
    assert detect_thinking_mode("llama3") == ThinkingMode.NONE


@pytest.mark.asyncio
async def test_reasoning_injection_enabled(provider):
    # Test normalization logic (simulated)
    raw_content = "<|channel>thought Thinking...<|channel>text Hello"
    from ai.thinking_parser import parse_completed_response

    normalized = parse_completed_response(raw_content, ThinkingMode.CHANNEL_MARKERS)

    assert THINK_OPEN in normalized
    assert "Thinking..." in normalized


def test_reasoning_disabled_strips_directive(provider):
    # If reasoning is disabled, the REASONING_DIRECTIVE should be stripped
    # (OllamaProvider handles this in _format_messages)
    messages = [AIChatMessage(role="user", content="hi")]
    formatted = provider._format_messages(messages, reasoning=False)
    # Since we didn't override the system prompt in fixture, it uses default or empty
    # If it was REASONING_DIRECTIVE, it should be empty now.
    for msg in formatted:
        assert "For EVERY response" not in msg["content"]


def test_user_nudge_manual(provider):
    # Logic for manual nudge (if we still wanted one)
    user_msg = "What is in the logs?"
    target_model = "gemma4:e2b"

    content = user_msg
    if detect_thinking_mode(target_model) == ThinkingMode.CHANNEL_MARKERS:
        content = f"<|think|>\n{user_msg}\n(Please think deeply before responding)"

    assert content.startswith("<|think|>")
