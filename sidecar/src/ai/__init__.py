from .ai_studio import AIStudioProvider
from .base import AIChatMessage, AIProvider
from .gemini_cli import GeminiCLIProvider
from .ollama import OllamaProvider


class AIProviderFactory:
    @staticmethod
    def get_provider(provider_name: str, **kwargs) -> AIProvider:
        api_key = kwargs.get("api_key", "")
        system_prompt = kwargs.get("system_prompt", "")

        if provider_name == "ai-studio":
            return AIStudioProvider(api_key=api_key, system_prompt=system_prompt)
        elif provider_name == "ollama":
            return OllamaProvider(
                host=kwargs.get("host", "http://localhost:11434"),
                system_prompt=system_prompt,
                model=kwargs.get("model", "gemma4:e2b"),
            )
        else:
            return GeminiCLIProvider(
                host=kwargs.get("host", "http://localhost:22436"),
                system_prompt=system_prompt,
                model=kwargs.get("model"),
            )
