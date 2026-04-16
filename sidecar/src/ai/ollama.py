import json

import aiohttp

from .base import AIChatMessage, AIProvider


class OllamaProvider(AIProvider):
    """Local provider using Ollama API."""

    def __init__(self, host: str = "http://localhost:11434", system_prompt: str = ""):
        super().__init__(system_prompt=system_prompt)
        self.host = host.rstrip("/")
        self.timeout = aiohttp.ClientTimeout(total=60)

    async def list_models(self) -> list[str]:
        """Fetches available models from the local Ollama instance."""
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                async with session.get(f"{self.host}/api/tags") as resp:
                    if resp.status != 200:
                        return ["gemma4:e2b", "llama3", "mistral"]
                    
                    data = await resp.json()
                    return [m["name"] for m in data.get("models", [])]
        except Exception:
            return ["gemma4:e2b", "llama3", "mistral"]

    async def chat(self, messages: list[AIChatMessage], model: str | None = "gemma4:e2b", session_id: str | None = None, provider_session_id: str | None = None) -> AIChatMessage:
        """Sends a message to Ollama."""
        ollama_messages = []
        if self.system_prompt:
            ollama_messages.append({"role": "system", "content": self.system_prompt})
            
        ollama_messages.extend([{"role": msg.role, "content": msg.content} for msg in messages])
        
        payload = {
            "model": model,
            "messages": ollama_messages,
            "stream": False
        }
        
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                async with session.post(f"{self.host}/api/chat", json=payload) as resp:
                    if resp.status != 200:
                        error_text = await resp.text()
                        return AIChatMessage(role="assistant", content=f"Ollama Error: {error_text}")
                    
                    data = await resp.json()
                    content = data.get("message", {}).get("content", "")
                    return AIChatMessage(role="assistant", content=content)
        except Exception as e:
            return AIChatMessage(role="assistant", content=f"Ollama Connection Error: {str(e)}")

    async def analyze_logs(self, template: str, samples: list[str], model: str = "gemma4:e2b") -> dict:
        """Specific one-off analysis for log clusters using Ollama."""
        prompt = (
            "You are a Log Analysis Specialist. Return JSON with 'summary', 'root_cause', 'recommended_actions'.\n\n"
            f"Cluster template: {template}\nSample logs:\n" + "\n".join(samples)
        )
        
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "format": "json" # Ollama supports forcing JSON output
        }
        
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                async with session.post(f"{self.host}/api/generate", json=payload) as resp:
                    if resp.status != 200: 
                        raise RuntimeError(f"Ollama returned status {resp.status}")
                    
                    data = await resp.json()
                    return json.loads(data.get("response", "{}"))
        except Exception as e:
            return {"summary": "Analysis failed", "root_cause": str(e), "recommended_actions": []}
