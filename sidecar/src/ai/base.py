from abc import ABC, abstractmethod
from typing import Any, List, Optional
from pydantic import BaseModel

class AIChatMessage(BaseModel):
    role: str # 'user' | 'assistant' | 'system'
    content: str
    context_logs: Optional[List[int]] = None
    timestamp: Optional[str] = None
    provider_session_id: Optional[str] = None # E.g. A2A taskId

class AIProvider(ABC):
    """Abstract base class for all AI providers."""
    def __init__(self, api_key: str = "", system_prompt: str = ""):
        self.api_key = api_key
        self.system_prompt = system_prompt

    @abstractmethod
    async def list_models(self) -> List[str]:
        """Fetch available models for this provider."""
        pass

    @abstractmethod
    async def chat(self, messages: List[AIChatMessage], model: Optional[str] = None, session_id: Optional[str] = None, provider_session_id: Optional[str] = None) -> AIChatMessage:
        """Execute a chat session with memory/context."""
        pass

    @abstractmethod
    async def analyze_logs(self, template: str, samples: List[str]) -> dict:
        """One-off diagnostic analysis of a log cluster."""
        pass
