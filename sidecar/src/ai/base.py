from abc import ABC, abstractmethod

from pydantic import BaseModel


class AIChatMessage(BaseModel):
    role: str # 'user' | 'assistant' | 'system'
    content: str
    context_logs: list[int] | None = None
    timestamp: str | None = None
    provider_session_id: str | None = None # E.g. A2A taskId

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
    async def chat(self, messages: list[AIChatMessage], model: str | None = None, session_id: str | None = None, provider_session_id: str | None = None) -> AIChatMessage:
        """Execute a chat session with memory/context."""
        pass

    @abstractmethod
    async def analyze_logs(self, template: str, samples: list[str]) -> dict:
        """One-off diagnostic analysis of a log cluster."""
        pass
