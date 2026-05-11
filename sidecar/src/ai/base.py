from abc import ABC, abstractmethod

from pydantic import BaseModel


class AIChatMessage(BaseModel):
    role: str  # 'user' | 'assistant' | 'system' | 'tool'
    content: str
    context_logs: list[int] | None = None
    timestamp: str | None = None
    provider_session_id: str | None = None  # E.g. A2A taskId
    tool_calls: list[dict] | None = None
    tool_call_id: str | None = None
    name: str | None = None


class AIProvider(ABC):
    """Abstract base class for all AI providers."""

    def __init__(self, api_key: str = "", system_prompt: str = ""):
        self.api_key = api_key
        self.system_prompt = system_prompt

    @abstractmethod
    async def list_models(self) -> list[str]:
        """Fetch available models for this provider."""
        pass

    @abstractmethod
    async def chat(
        self,
        messages: list[AIChatMessage],
        model: str | None = None,
        session_id: str | None = None,
        provider_session_id: str | None = None,
        tools: list[dict] | None = None,
        **kwargs,
    ) -> AIChatMessage:
        """Execute a chat session with memory/context."""
        pass

    @abstractmethod
    async def chat_stream(
        self,
        messages: list[AIChatMessage],
        model: str | None = None,
        session_id: str | None = None,
        provider_session_id: str | None = None,
        tools: list[dict] | None = None,
        **kwargs,
    ):
        """Streaming version of chat."""
        pass

    @abstractmethod
    async def analyze_logs(self, template: str, samples: list[str]) -> dict:
        """One-off diagnostic analysis of a log cluster."""
        pass

    @abstractmethod
    async def test_connection(self) -> dict:
        """Verify the provider credentials and connectivity."""
        pass
