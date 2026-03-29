from .base import AIProvider, AIChatMessage
from .gemini_cli import GeminiCLIProvider
from .ai_studio import AIStudioProvider
from .ollama import OllamaProvider

class AIProviderFactory:
    @staticmethod
    def get_provider(provider_name: str, **kwargs) -> AIProvider:
        if provider_name == "ai-studio":
            return AIStudioProvider(api_key=kwargs.get("api_key", ""))
        elif provider_name == "ollama":
            return OllamaProvider(host=kwargs.get("host", "http://localhost:11434"))
        else:
            return GeminiCLIProvider()
