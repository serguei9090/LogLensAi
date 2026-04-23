from .ai_studio import AIStudioProvider
from .base import AIChatMessage, AIProvider
from .gemini_cli import GeminiCLIProvider
from .graph import GraphManager
from .ollama import OllamaProvider
from .openai_compatible import OpenAICompatibleProvider
from .runner import HybridRunner
from .thinking_parser import (
    ThinkingMode,
    ThinkingStreamParser,
    clean_thinking_markers,
    detect_thinking_mode,
    parse_completed_response,
)
from .tools import ToolRegistry

__all__ = [
    "AIChatMessage",
    "AIProvider",
    "AIStudioProvider",
    "GeminiCLIProvider",
    "OllamaProvider",
    "OpenAICompatibleProvider",
    "AIProviderFactory",
    "HybridRunner",
    "GraphManager",
    "ToolRegistry",
    "ThinkingMode",
    "ThinkingStreamParser",
    "detect_thinking_mode",
    "clean_thinking_markers",
    "parse_completed_response",
]


class AIProviderFactory:
    @staticmethod
    def get_provider(provider_name: str, **kwargs) -> AIProvider:
        api_key = kwargs.get("api_key", "")
        system_prompt = kwargs.get("system_prompt", "")
        model = kwargs.get("model", "")
        settings = kwargs.get("settings", {})

        # --- Host Resolution Logic (OCP) ---
        # If host is not explicitly provided, resolve from settings keys
        host = kwargs.get("host")
        if not host and settings:
            host_map = {
                "gemini-cli": "ai_gemini_url",
                "openai-compatible": "ai_openai_host",
                "openai": "ai_openai_host",
                "ollama": "ai_ollama_host",
            }
            host = settings.get(host_map.get(provider_name, ""), "")

        # --- A2UI v0.9 Protocol Injection ---
        a2ui_instructions = """
You are equipped with A2UI v0.9 (Agent-to-UI). When you provide insights that lead to a specific action (like filtering logs or searching), enclose an interactive UI block in: [[A2UI]] ... [[/A2UI]].

Preferred Markup Format (Token Efficient):
[[A2UI]] button label="Show Errors" action={"type": "filter", "field": "level", "value": "ERROR"} [[/A2UI]]
[[A2UI]] button label="Trace IP" action={"type": "search", "query": "192.168.1.1"} [[/A2UI]]

Standard JSON Schema:
- { "type": "button", "label": "Label", "action": { "type": "filter|search|command", ... } }
- { "type": "text", "text": "Content" }
- { "type": "card|stack_v|stack_h", "children": [...] }

Action Details:
- filter: { "field": "level|source_id|cluster_id", "value": "...", "operator": "equals|contains" }
- search: { "query": "..." }
- command: { "command": "/analyze" }
"""
        if "A2UI" not in system_prompt:
            system_prompt = f"{system_prompt}\n\n{a2ui_instructions}"

        if provider_name == "ai-studio":
            return AIStudioProvider(
                api_key=api_key,
                system_prompt=system_prompt,
                model=model or "gemini-2.5-flash",
            )
        elif provider_name == "ollama":
            return OllamaProvider(
                host=host or "http://localhost:11434",
                system_prompt=system_prompt,
                model=model or "gemma4:e2b",
            )
        elif provider_name == "openai-compatible" or provider_name == "openai":
            return OpenAICompatibleProvider(
                api_key=api_key,
                system_prompt=system_prompt,
                host=host or "https://api.openai.com/v1",
                model=model or "gpt-4o",
            )
        else:
            return GeminiCLIProvider(
                host=host or "http://localhost:22436",
                system_prompt=system_prompt,
                model=model,
            )
