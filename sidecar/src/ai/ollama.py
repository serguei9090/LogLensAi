import json
import logging

import aiohttp

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

logger = logging.getLogger(__name__)

DEFAULT_OLLAMA_MODEL = "gemma4:e2b"


class OllamaProvider(AIProvider):
    """Local provider using the Ollama API.

    Thinking-mode parsing is fully delegated to ``ThinkingStreamParser``
    (see ``sidecar/src/ai/thinking_parser.py``).  This class focuses only on
    the Ollama wire-format: HTTP chat endpoint, payload construction, and
    message formatting.
    """

    REASONING_DIRECTIVE = (
        "You are a professional log analysis assistant. "
        "For EVERY response, you MUST first conduct a deep reasoning phase. "
        "You must start your reasoning with the token <|channel>thought and once you are "
        "ready to give your final user-facing answer, you MUST output the token <|channel>text."
    )

    def __init__(
        self,
        host: str = "http://localhost:11434",
        system_prompt: str = "",
        model: str = DEFAULT_OLLAMA_MODEL,
    ):
        # Inject reasoning directive for models that support channel markers
        final_prompt = system_prompt
        if not final_prompt and detect_thinking_mode(model) == ThinkingMode.CHANNEL_MARKERS:
            final_prompt = self.REASONING_DIRECTIVE

        super().__init__(system_prompt=final_prompt)
        self.host = host.rstrip("/")
        self.model = model
        self.timeout = aiohttp.ClientTimeout(total=60)

    async def list_models(self) -> list[str]:
        """Fetches available models from the local Ollama instance."""
        try:
            async with (
                aiohttp.ClientSession(timeout=self.timeout) as session,
                session.get(f"{self.host}/api/tags") as resp,
            ):
                if resp.status != 200:
                    return [DEFAULT_OLLAMA_MODEL, "llama3", "mistral"]

                data = await resp.json()
                return [m["name"] for m in data.get("models", [])]
        except Exception:
            return [DEFAULT_OLLAMA_MODEL, "llama3", "mistral"]

    def _format_messages(self, messages: list[AIChatMessage], reasoning: bool = True) -> list[dict]:
        """Prepares the message list for the Ollama payload.

        Assistant history is cleaned so that raw channel markers do not
        confuse the model on the next turn.
        """
        ollama_messages = []

        # Determine if we should use the system prompt
        # We only suppress the REASONING_DIRECTIVE if reasoning is explicitly false.
        # User-provided prompts are always preserved.
        system_content = self.system_prompt
        if not reasoning and system_content == self.REASONING_DIRECTIVE:
            system_content = ""

        if system_content:
            ollama_messages.append({"role": "system", "content": system_content})

        for msg in messages:
            content = (
                clean_thinking_markers(msg.content) if msg.role == "assistant" else msg.content
            )
            ollama_messages.append({"role": msg.role, "content": content})
        return ollama_messages

    async def chat(
        self,
        messages: list[AIChatMessage],
        model: str | None = None,
        session_id: str | None = None,
        provider_session_id: str | None = None,
        reasoning: bool | None = True,
    ) -> AIChatMessage:
        """Sends a message to Ollama (non-streaming)."""
        target_model = model or self.model or DEFAULT_OLLAMA_MODEL
        mode = detect_thinking_mode(target_model)

        payload = {
            "model": target_model,
            "messages": self._format_messages(messages, reasoning=reasoning),
            "stream": False,
        }

        logger.debug("Ollama Request Payload: %s", json.dumps(payload, indent=2))

        try:
            async with (
                aiohttp.ClientSession(timeout=self.timeout) as session,
                session.post(f"{self.host}/api/chat", json=payload) as resp,
            ):
                if resp.status != 200:
                    error_text = await resp.text()
                    return AIChatMessage(role="assistant", content=f"Ollama Error: {error_text}")

                data = await resp.json()
                msg = data.get("message", {})
                raw_content = msg.get("content", "")
                native_thinking = msg.get("thinking") or msg.get("thought")

                if native_thinking:
                    # Ollama pre-extracted the thinking field — wrap and return.
                    clean_thought = clean_thinking_markers(native_thinking).strip()
                    clean_answer = clean_thinking_markers(raw_content).strip()
                    return AIChatMessage(
                        role="assistant",
                        content=f"{THINK_OPEN}{clean_thought}{THINK_CLOSE}{clean_answer}",
                    )

                # Fallback: parse raw content for channel markers (or pass through)
                clean_content = parse_completed_response(raw_content, mode)
                return AIChatMessage(role="assistant", content=clean_content)
        except Exception as e:
            return AIChatMessage(role="assistant", content=f"Ollama Connection Error: {str(e)}")

    async def chat_stream(
        self,
        messages: list[AIChatMessage],
        model: str | None = None,
        reasoning: bool | None = True,
        session_id: str | None = None,
        **kwargs,
    ):
        """Streams response using Ollama's /api/chat endpoint.

        Thinking-mode parsing is handled by ``ThinkingStreamParser`` which
        is model-aware — no provider-specific phase logic required here.
        """
        target_model = model or self.model
        mode = detect_thinking_mode(target_model)

        payload = {
            "model": target_model,
            "messages": self._format_messages(messages, reasoning=reasoning),
            "stream": True,
            "options": {"temperature": 1.0, "top_p": 0.95, "top_k": 64},
        }

        try:
            async with (
                aiohttp.ClientSession(timeout=self.timeout) as session,
                session.post(f"{self.host}/api/chat", json=payload) as resp,
            ):
                if resp.status != 200:
                    err_text = await resp.text()
                    raise RuntimeError(f"Ollama stream error: {err_text}")

                parser = ThinkingStreamParser(mode)

                async for line in resp.content:
                    if not line:
                        continue

                    chunk_data = json.loads(line.decode("utf-8").strip())
                    msg = chunk_data.get("message", {})

                    # Ollama native pre-extracted thinking field
                    native_thinking = msg.get("thinking") or msg.get("thought")
                    content = msg.get("content", "")

                    logger.debug("CHUNK DATA: %s", chunk_data)

                    for out_chunk in parser.feed(content=content, native_thinking=native_thinking):
                        yield out_chunk

                    if chunk_data.get("done"):
                        break

                # Flush buffered content and close any open <think> tag
                for out_chunk in parser.flush():
                    yield out_chunk

        except Exception:
            logger.exception("Final exception in Ollama chat_stream")
            raise

    async def analyze_logs(
        self, template: str, samples: list[str], model: str | None = None
    ) -> dict:
        """Specific one-off analysis for log clusters using Ollama."""
        prompt = (
            "You are a Log Analysis Specialist. "
            "Return JSON with 'summary', 'root_cause', 'recommended_actions'.\n\n"
            f"Cluster template: {template}\nSample logs:\n" + "\n".join(samples)
        )

        target_model = model or self.model or DEFAULT_OLLAMA_MODEL

        payload = {
            "model": target_model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
        }

        try:
            async with (
                aiohttp.ClientSession(timeout=self.timeout) as session,
                session.post(f"{self.host}/api/generate", json=payload) as resp,
            ):
                if resp.status != 200:
                    raise RuntimeError(f"Ollama returned status {resp.status}")

                data = await resp.json()
                return json.loads(data.get("response", "{}"))
        except Exception as e:
            return {"summary": "Analysis failed", "root_cause": str(e), "recommended_actions": []}

    async def test_connection(self) -> dict:
        """Verify the local Ollama connection."""
        try:
            async with (
                aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5)) as session,
                session.get(f"{self.host}/api/tags") as resp,
            ):
                if resp.status == 200:
                    data = await resp.json()
                    count = len(data.get("models", []))
                    return {
                        "status": "success",
                        "message": f"Ollama is running. Found {count} models.",
                    }
                return {"status": "error", "message": f"Ollama returned status {resp.status}"}
        except Exception as e:
            return {
                "status": "error",
                "message": f"Could not connect to Ollama at {self.host}: {str(e)}",
            }
