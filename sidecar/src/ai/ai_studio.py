import asyncio
import os
import time

from google.adk.agents.llm_agent import LlmAgent
from google.adk.events.event import Event
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import Client, types

from .base import AIChatMessage, AIProvider

DEFAULT_MODEL = "gemini-2.0-flash-exp"
APP_NAME = "LogLensAi"
MODELS_PREFIX = "models/"


class AIStudioProvider(AIProvider):
    """Direct provider using Google AI Studio (API Key)."""

    # Class-level cache for available models to reduce API spam
    _cached_models: list[str] | None = None
    _cache_timestamp: float = 0
    CACHE_DURATION: float = 3600  # 1 hour in seconds

    def __init__(self, api_key: str, system_prompt: str = "", model: str | None = None):
        super().__init__(api_key=api_key, system_prompt=system_prompt)
        active = model or DEFAULT_MODEL
        if active.startswith(MODELS_PREFIX):
            active = active[len(MODELS_PREFIX) :]
        self.active_model = active
        # We wrap the client for list_models and other direct calls
        self._client = Client(api_key=api_key) if api_key else None

    async def list_models(self) -> list[str]:
        """Fetches available Gemini models from the API with caching."""
        if not self._client:
            return [DEFAULT_MODEL]

        # Return cached models if valid
        now = time.time()
        if (
            AIStudioProvider._cached_models
            and (now - AIStudioProvider._cache_timestamp) < AIStudioProvider.CACHE_DURATION
        ):
            return AIStudioProvider._cached_models

        try:
            # Note: This is a synchronous call in google-genai currently
            # but we run it in executor for safety
            loop = asyncio.get_event_loop()
            models = await loop.run_in_executor(None, self._client.models.list)
            AIStudioProvider._cached_models = [
                m.name.replace(MODELS_PREFIX, "")
                for m in models
                if any(keyword in m.name.lower() for keyword in ["gemini", "gemma"])
            ]
            AIStudioProvider._cache_timestamp = now
            return AIStudioProvider._cached_models
        except Exception:
            # If API fails, don't update cache timestamp so we retry next time
            # But return the old cache if it exists, otherwise defaults
            if AIStudioProvider._cached_models:
                return AIStudioProvider._cached_models
            return [DEFAULT_MODEL, "gemini-2.5-pro"]

    async def chat(
        self,
        messages: list[AIChatMessage],
        model: str | None = None,
        session_id: str | None = None,
        provider_session_id: str | None = None,
    ) -> AIChatMessage:
        """Sends a message to Gemini via ADK Agent."""
        if not self.api_key:
            return AIChatMessage(
                role="assistant", content="Error: No API Key configured for AI Studio."
            )

        # Create a transient agent for this request
        target_model = model or self.active_model
        if target_model.startswith(MODELS_PREFIX):
            target_model = target_model[len(MODELS_PREFIX) :]

        agent = LlmAgent(
            name="ai_studio_agent",
            model=target_model,
            instruction=self.system_prompt,
        )

        os.environ["GOOGLE_API_KEY"] = self.api_key

        # Reconstruct context for the runner
        session_service = InMemorySessionService()
        user_id = "default_user"
        adk_session_id = session_id or "temp_session"

        # 1. Create session explicitly in the service
        session = await session_service.create_session(
            app_name=APP_NAME, user_id=user_id, session_id=adk_session_id
        )

        # 2. History injection via ADK Event appending
        for msg in messages[:-1]:
            role = "user" if msg.role == "user" else "ai_studio_agent"
            content = types.Content(
                role="user" if role == "user" else "model", parts=[types.Part(text=msg.content)]
            )
            event = Event(invocation_id="historical", author=role, content=content)
            await session_service.append_event(session, event)

        runner = Runner(
            agent=agent,
            app_name=APP_NAME,
            session_service=session_service,
            auto_create_session=True,
        )

        last_msg = messages[-1]
        content = types.Content(role="user", parts=[types.Part(text=last_msg.content)])

        response_text = ""
        try:
            async for event in runner.run_async(
                user_id=user_id, session_id=adk_session_id, new_message=content
            ):
                if event.is_final_response() and event.content:
                    response_text = event.content.parts[0].text

            # Note: adk_session_id acts as our provider_session_id here
            return AIChatMessage(
                role="assistant", content=response_text, provider_session_id=adk_session_id
            )
        except Exception as e:
            return AIChatMessage(role="assistant", content=f"AI Studio Error: {str(e)}")

    async def chat_stream(
        self,
        messages: list[AIChatMessage],
        model: str | None = None,
        session_id: str | None = None,
        provider_session_id: str | None = None,
        reasoning: bool = True,
        **kwargs,
    ):
        """Streaming version using ADK Runner."""
        if not self.api_key:
            yield "Error: No API Key configured for AI Studio."
            return

        os.environ["GOOGLE_API_KEY"] = self.api_key
        target_model = model or self.active_model
        if target_model.startswith(MODELS_PREFIX):
            target_model = target_model[len(MODELS_PREFIX) :]

        agent = LlmAgent(
            name="ai_studio_agent",
            model=target_model,
            instruction=self.system_prompt,
        )

        session_service = InMemorySessionService()
        user_id = "default_user"
        adk_session_id = session_id or "temp_session"

        # 1. Create session explicitly
        session = await session_service.create_session(
            app_name=APP_NAME, user_id=user_id, session_id=adk_session_id
        )

        # 2. History injection
        for msg in messages[:-1]:
            role = "user" if msg.role == "user" else "ai_studio_agent"
            content = types.Content(
                role="user" if role == "user" else "model", parts=[types.Part(text=msg.content)]
            )
            event = Event(invocation_id="historical", author=role, content=content)
            await session_service.append_event(session, event)

        runner = Runner(
            agent=agent,
            app_name=APP_NAME,
            session_service=session_service,
            auto_create_session=True,
        )
        last_msg = messages[-1]
        content = types.Content(role="user", parts=[types.Part(text=last_msg.content)])

        try:
            async for event in runner.run_async(
                user_id=user_id, session_id=adk_session_id, new_message=content
            ):
                if event.content and event.content.parts:
                    yield event.content.parts[0].text
        except Exception as e:
            yield f"AI Studio Stream Error: {str(e)}"

    async def analyze_logs(self, template: str, samples: list[str]) -> dict:
        """Specific one-off analysis for log clusters."""
        # For simple analysis, we use the direct client to avoid session overhead
        if not self._client:
            return {"summary": "No API Key", "root_cause": "", "recommended_actions": []}

        prompt = (
            "You are a Log Analysis Specialist. Return JSON with 'summary', 'root_cause', 'recommended_actions'.\n\n"
            f"Cluster template: {template}\nSample logs:\n" + "\n".join(samples)
        )

        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self._client.models.generate_content(
                    model=self.active_model,
                    config=types.GenerateContentConfig(response_mime_type="application/json"),
                    contents=prompt,
                ),
            )
            return response.parsed
        except Exception as e:
            return {"summary": "Analysis failed", "root_cause": str(e), "recommended_actions": []}
