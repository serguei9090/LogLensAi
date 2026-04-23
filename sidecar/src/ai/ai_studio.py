import asyncio
import logging
import os
import time

from google.adk.agents.llm_agent import LlmAgent
from google.adk.events.event import Event
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import Client, types

# Registry Patch Imports
try:
    from google.adk.models.google_llm import Gemini
    from google.adk.models.registry import LLMRegistry
except ImportError:
    LLMRegistry = None
    Gemini = None

from .base import AIChatMessage, AIProvider
from .thinking_parser import (
    THINK_CLOSE,
    THINK_OPEN,
    ThinkingMode,
    ThinkingStreamParser,
    clean_thinking_markers,
    detect_thinking_mode,
    parse_completed_response,
)

DEFAULT_MODEL = "gemini-2.0-flash"  # Updated to match latest available
APP_NAME = "LogLensAi"
MODELS_PREFIX = "models/"

logger = logging.getLogger("LogLensSidecar")


class AIStudioProvider(AIProvider):
    """Direct provider using Google AI Studio (API Key)."""

    # Class-level cache for available models to reduce API spam
    _cached_models: list[str] | None = None
    _cache_timestamp: float = 0
    CACHE_DURATION: float = 3600  # 1 hour in seconds

    def __init__(self, api_key: str, system_prompt: str = "", model: str | None = None):
        api_key = api_key.strip() if api_key else ""
        super().__init__(api_key=api_key, system_prompt=system_prompt)
        self.active_model = model or DEFAULT_MODEL
        # We wrap the client for list_models and other direct calls
        self._client = Client(api_key=api_key) if api_key else None

        # Patch registry to avoid "Model not found" errors for known variants
        self._patch_registry()

    def _patch_registry(self):
        """Manually register missing model variants in ADK to prevent ValueErrors."""
        if LLMRegistry and Gemini:
            # Common aliases or new variants not yet in the library's static list
            custom_variants = [
                r"^gemma-3-.*",
                r"^gemma-4-.*",
                r"^gemini-2\.0-.*",
                r"models/gemma-3-.*",
                r"models/gemma-4-.*",
            ]
            for variant in custom_variants:
                try:
                    LLMRegistry._register(variant, Gemini)
                    logger.debug("Patched ADK Registry with variant: %s", variant)
                except Exception as e:
                    logger.warning("Failed to patch ADK Registry for %s: %s", variant, e)

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

        if self.api_key:
            os.environ["GOOGLE_API_KEY"] = self.api_key

        try:
            from google.genai import errors

            loop = asyncio.get_event_loop()

            # Try new SDK first
            try:
                models = await loop.run_in_executor(None, self._client.models.list)
                AIStudioProvider._cached_models = [
                    m.name
                    for m in models
                    if any(keyword in m.name.lower() for keyword in ["gemini", "gemma"])
                ]
            except (errors.APIError, Exception) as e:
                # Fallback to legacy SDK if new one fails
                logger.warning(
                    "AI Studio new SDK list_models failed, trying legacy SDK: %s", str(e)
                )

                import google.generativeai as legacy_genai

                legacy_genai.configure(api_key=self.api_key)

                def _list_legacy():
                    return [m.name for m in legacy_genai.list_models()]

                legacy_models = await loop.run_in_executor(None, _list_legacy)
                AIStudioProvider._cached_models = [
                    m
                    for m in legacy_models
                    if any(keyword in m.lower() for keyword in ["gemini", "gemma"])
                ]

            AIStudioProvider._cache_timestamp = now
            return AIStudioProvider._cached_models
        except Exception as e:
            logger.error("AI Studio All SDKs failed (list_models): %s", str(e))
            if AIStudioProvider._cached_models:
                return AIStudioProvider._cached_models
            return [DEFAULT_MODEL, "gemini-2.0-flash", "gemini-1.5-pro"]

    def _get_target_model_and_mode(self, model: str | None) -> tuple[str, ThinkingMode]:
        """Validates the model name and determines the thinking mode."""
        target_model = model or self.active_model
        mode = detect_thinking_mode(target_model)

        # Safety fallback: incompatible model from a different provider
        if not any(x in target_model.lower() for x in ["gemini-", "gemma-", "learnlm"]):
            logger.warning(
                "AI Studio: Model '%s' potentially incompatible. Falling back to %s",
                target_model,
                DEFAULT_MODEL,
            )
            target_model = DEFAULT_MODEL
            mode = detect_thinking_mode(target_model)
        return target_model, mode

    def _prepare_messages(
        self, messages: list[AIChatMessage], target_model: str, reasoning: bool | None
    ) -> list[AIChatMessage]:
        """Injects system instructions or thinking tokens based on model capabilities."""
        is_gemma = "gemma" in target_model.lower()
        if reasoning and is_gemma and self.system_prompt:
            messages = list(messages)
            last_msg = messages[-1]
            if last_msg.role == "user":
                # Inject <|think|> token to enable thinking mode for Gemma
                gemma_prefix = f"<|think|>\n{self.system_prompt}"
                last_msg.content = f"{gemma_prefix}\n\nUser Question: {last_msg.content}"
        return messages

    async def _prepare_adk_session(
        self,
        session_service: InMemorySessionService,
        session_id: str | None,
        messages: list[AIChatMessage],
    ) -> str:
        """Creates an ADK session and populates it with historical conversation events."""
        user_id = "default_user"
        adk_session_id = session_id or "temp_session"

        session = await session_service.create_session(
            app_name=APP_NAME, user_id=user_id, session_id=adk_session_id
        )

        # Inject conversation history via ADK Events
        for msg in messages[:-1]:
            role = "user" if msg.role == "user" else "ai_studio_agent"
            # Strip thinking artefacts from history to keep context clean
            clean_content = (
                clean_thinking_markers(msg.content) if msg.role == "assistant" else msg.content
            )
            adk_content = types.Content(
                role="user" if role == "user" else "model",
                parts=[types.Part(text=clean_content)],
            )
            event = Event(invocation_id="historical", author=role, content=adk_content)
            await session_service.append_event(session, event)

        return adk_session_id

    async def chat(
        self,
        messages: list[AIChatMessage],
        model: str | None = None,
        session_id: str | None = None,
        provider_session_id: str | None = None,
        reasoning: bool | None = True,
    ) -> AIChatMessage:
        """Sends a message to Gemini via ADK Agent."""
        if not self.api_key:
            return AIChatMessage(role="assistant", content="Error: No API Key configured.")

        target_model, mode = self._get_target_model_and_mode(model)
        messages = self._prepare_messages(messages, target_model, reasoning)

        is_gemma = "gemma" in target_model.lower()
        instruction = self.system_prompt if not is_gemma else ""

        agent = LlmAgent(name="ai_studio_agent", model=target_model, instruction=instruction)
        os.environ["GOOGLE_API_KEY"] = self.api_key

        session_service = InMemorySessionService()
        adk_session_id = await self._prepare_adk_session(session_service, session_id, messages)

        runner = Runner(
            agent=agent,
            app_name=APP_NAME,
            session_service=session_service,
            auto_create_session=True,
        )

        last_msg = messages[-1]
        adk_msg = types.Content(role="user", parts=[types.Part(text=last_msg.content)])

        raw_text, thinking_text = "", ""
        try:
            async for event in runner.run_async(
                user_id="default_user", session_id=adk_session_id, new_message=adk_msg
            ):
                if event.is_final_response() and event.content:
                    for part in event.content.parts:
                        if hasattr(part, "thought") and part.thought:
                            thinking_text += str(part.text or "")
                        elif hasattr(part, "text") and part.text:
                            raw_text += str(part.text)

            if thinking_text:
                clean_thought = clean_thinking_markers(thinking_text).strip()
                clean_answer = clean_thinking_markers(raw_text).strip()
                final_content = f"{THINK_OPEN}{clean_thought}{THINK_CLOSE}{clean_answer}"
            else:
                final_content = parse_completed_response(raw_text, mode)

            return AIChatMessage(
                role="assistant", content=final_content, provider_session_id=adk_session_id
            )
        except Exception as e:
            if "404" in str(e) and target_model != DEFAULT_MODEL:
                return await self.chat(messages, model=DEFAULT_MODEL, session_id=session_id)
            logger.error("AI Studio Error: %s", str(e))
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
        target_model, mode = self._get_target_model_and_mode(model)
        messages = self._prepare_messages(messages, target_model, reasoning)

        is_gemma = "gemma" in target_model.lower()
        instruction = self.system_prompt if not is_gemma else ""

        agent = LlmAgent(name="ai_studio_agent", model=target_model, instruction=instruction)
        session_service = InMemorySessionService()
        adk_session_id = await self._prepare_adk_session(session_service, session_id, messages)

        runner = Runner(
            agent=agent,
            app_name=APP_NAME,
            session_service=session_service,
            auto_create_session=True,
        )
        last_msg = messages[-1]
        adk_msg = types.Content(role="user", parts=[types.Part(text=last_msg.content)])

        parser = ThinkingStreamParser(mode)
        try:
            async for event in runner.run_async(
                user_id="default_user", session_id=adk_session_id, new_message=adk_msg
            ):
                if not (event.content and event.content.parts):
                    continue

                for part in event.content.parts:
                    if hasattr(part, "thought") and part.thought:
                        for chunk in parser.feed(content="", native_thinking=str(part.text or "")):
                            yield chunk
                    elif hasattr(part, "text") and part.text:
                        for chunk in parser.feed(content=str(part.text)):
                            yield chunk

            for chunk in parser.flush():
                yield chunk

        except Exception as e:
            if "404" in str(e) and target_model != DEFAULT_MODEL:
                async for chunk in self.chat_stream(
                    messages, model=DEFAULT_MODEL, session_id=session_id
                ):
                    yield chunk
                return
            logger.error("AI Studio Stream Error: %s", str(e))
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

    async def test_connection(self) -> dict:
        """Verify the Google AI Studio API Key."""
        if not self.api_key:
            return {"status": "error", "message": "No API Key provided."}

        # Basic format validation for AI Studio keys
        if not self.api_key.startswith("AIza"):
            return {
                "status": "error",
                "message": "Invalid key format. Google AI Studio keys typically start with 'AIza'. Please check if you are using a Vertex AI or Google Cloud key by mistake.",
            }

        try:
            # Clear cache to force a fresh check
            AIStudioProvider._cached_models = None

            # We try a simple list_models call as the ultimate test
            await self.list_models()

            # If it returns the default models due to error, we should check if they were actually fetched
            if AIStudioProvider._cached_models:
                return {
                    "status": "success",
                    "message": f"Successfully connected to Google AI Studio. Found {len(AIStudioProvider._cached_models)} models.",
                }

            return {
                "status": "warning",
                "message": "Connected but could not fetch models. This usually means the API key is valid but the 'Generative Language API' is not enabled in your Google Cloud project.",
            }
        except Exception as e:
            error_msg = str(e)
            if "400" in error_msg and "INVALID_ARGUMENT" in error_msg:
                return {
                    "status": "error",
                    "message": "API Key rejected by Google (400 Invalid Argument). Please verify the key is active and correctly copied.",
                }
            return {"status": "error", "message": f"Connection failed: {error_msg}"}
