from openai import AsyncOpenAI

from .base import AIChatMessage, AIProvider


class OpenAICompatibleProvider(AIProvider):
    """Provider for any OpenAI-compatible API (Azure, Anthropic via proxy, Groq, etc)."""

    def __init__(self, api_key: str, system_prompt: str = "", host: str = "https://api.openai.com/v1"):
        super().__init__(api_key=api_key, system_prompt=system_prompt)
        self.host = host
        self._client = None
        if api_key:
            self._client = AsyncOpenAI(api_key=api_key, base_url=host)

    async def list_models(self) -> list[str]:
        """Fetch available models from the provider."""
        if not self._client:
            return ["gpt-4o", "gpt-3.5-turbo"]
        try:
            res = await self._client.models.list()
            return [m.id for m in res.data]
        except Exception:
            return ["gpt-4o", "gpt-3.5-turbo"]

    async def chat(
        self,
        messages: list[AIChatMessage],
        model: str | None = None,
        session_id: str | None = None,
        provider_session_id: str | None = None,
    ) -> AIChatMessage:
        """Execute a chat session."""
        if not self._client:
            return AIChatMessage(role="assistant", content="Error: OpenAI Provider not configured.")

        # Construct messages including system prompt
        chat_messages = [{"role": "system", "content": self.system_prompt}]
        for m in messages:
            chat_messages.append({"role": m.role, "content": m.content})

        try:
            res = await self._client.chat.completions.create(
                model=model or "gpt-4o",
                messages=chat_messages
            )
            content = res.choices[0].message.content
            return AIChatMessage(role="assistant", content=content)
        except Exception as e:
            return AIChatMessage(role="assistant", content=f"OpenAI Compatible Error: {str(e)}")

    async def chat_stream(self, messages: list[AIChatMessage], model: str | None = None, **kwargs):
        """Streaming chat."""
        if not self._client:
            yield "Error: OpenAI Provider not configured."
            return

        chat_messages = [{"role": "system", "content": self.system_prompt}]
        for m in messages:
            chat_messages.append({"role": m.role, "content": m.content})

        try:
            stream = await self._client.chat.completions.create(
                model=model or "gpt-4o",
                messages=chat_messages,
                stream=True
            )
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            yield f"OpenAI Stream Error: {str(e)}"

    async def analyze_logs(self, template: str, samples: list[str]) -> dict:
        """One-off analysis."""
        if not self._client:
            return {"summary": "Not configured", "root_cause": "", "recommended_actions": []}

        prompt = (
            "You are a Log Analysis Specialist. Return JSON with 'summary', 'root_cause', 'recommended_actions'.\n\n"
            f"Cluster template: {template}\nSample logs:\n" + "\n".join(samples)
        )

        try:
            import json
            res = await self._client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            return json.loads(res.choices[0].message.content)
        except Exception as e:
            return {"summary": "Analysis failed", "root_cause": str(e), "recommended_actions": []}
