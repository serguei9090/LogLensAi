import json
import logging
import os
from enum import Enum, auto

import aiohttp

from .base import AIChatMessage, AIProvider

logger = logging.getLogger(__name__)

DEFAULT_OLLAMA_MODEL = "gemma4:e2b"

# Markers emitted by Gemma4 inside the content stream for channel switching
# Performance control tokens for reasoning models
CHANNEL_THOUGHT_START = "<|channel>thought"
CHANNEL_TEXT_START = "<|channel>text"
CHANNEL_THOUGHT_END = "<channel|>"
ALT_THOUGHT_START = "<|thought|>"
ALT_TEXT_START = "<|text|>"
ALT_CHANNEL_TEXT = "<|channel|>text"

ALL_TEXT_MARKERS = (CHANNEL_TEXT_START, ALT_TEXT_START, ALT_CHANNEL_TEXT, CHANNEL_THOUGHT_END)
ALL_THOUGHT_MARKERS = (CHANNEL_THOUGHT_START, ALT_THOUGHT_START)


class _StreamPhase(Enum):
    """Tracks whether the stateful parser is inside thinking or text output."""

    TEXT = auto()
    THOUGHT = auto()


class OllamaProvider(AIProvider):
    """Local provider using Ollama API.

    Gemma4 models use native channel-switching markers inside the content
    stream (`<|channel>thought` / `<|channel>text`). This provider includes
    a stateful stream parser that converts those raw markers into clean
    `<think>...</think>` blocks that the frontend already handles.
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
        # Use a clean persona prompt — no injected channel markers
        final_prompt = system_prompt
        if not final_prompt and self._is_reasoning_model(model):
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

    def _is_reasoning_model(self, model_name: str) -> bool:
        """Central gate for models that support/require reasoning phase."""
        return model_name.startswith("gemma4")

    @staticmethod
    def _clean_channel_tags(text: str) -> str:
        """Strip raw channel markers and internal <think> blocks from text.

        Used for generating clean history to feed back into the model.
        Removes both the markers and any content wrapped in <think> tags.
        """
        import re

        # 1. Remove entire <think>...</think> blocks if present (clean format)
        text = re.sub(r"<think>[\s\S]*?</think>", "", text)

        # 2. Remove raw channel markers (leaked format)
        all_tags = (
            CHANNEL_THOUGHT_START,
            CHANNEL_TEXT_START,
            CHANNEL_THOUGHT_END,
            ALT_THOUGHT_START,
            ALT_TEXT_START,
            ALT_CHANNEL_TEXT,
        )
        for tag in all_tags:
            text = text.replace(tag, "")

        return text.strip()

    @staticmethod
    def _parse_completed_response(raw: str) -> str:
        """Convert a completed (non-streaming) Gemma4 response into clean
        `<think>...</think>` + text format.
        """
        # Find earliest thought start
        thought_idx = -1
        thought_marker = ""
        for m in ALL_THOUGHT_MARKERS:
            idx = raw.find(m)
            if idx != -1 and (thought_idx == -1 or idx < thought_idx):
                thought_idx = idx
                thought_marker = m

        if thought_idx == -1:
            return OllamaProvider._clean_channel_tags(raw).strip()

        # Find earliest text transition after thought start
        text_idx = -1
        text_marker = ""
        for m in ALL_TEXT_MARKERS:
            idx = raw.find(m, thought_idx + len(thought_marker))
            if idx != -1 and (text_idx == -1 or idx < text_idx):
                text_idx = idx
                text_marker = m

        if text_idx != -1:
            thinking = raw[thought_idx + len(thought_marker) : text_idx]
            response = raw[text_idx + len(text_marker) :]
            thinking = OllamaProvider._clean_channel_tags(thinking).strip()
            response = OllamaProvider._clean_channel_tags(response).strip()
            return f"<think>{thinking}</think>{response}"

        thinking = raw[thought_idx + len(thought_marker) :]
        thinking = OllamaProvider._clean_channel_tags(thinking).strip()
        return f"<think>{thinking}</think>"

    async def chat(
        self,
        messages: list[AIChatMessage],
        model: str | None = None,
        session_id: str | None = None,
        provider_session_id: str | None = None,
        reasoning: bool | None = True,
    ) -> AIChatMessage:
        """Sends a message to Ollama (Non-streaming)."""
        target_model = model or self.model or DEFAULT_OLLAMA_MODEL
        ollama_messages = []

        if self.system_prompt:
            ollama_messages.append({"role": "system", "content": self.system_prompt})

        # Clean history: strip any raw channel tags from previous assistant messages
        for msg in messages:
            content = msg.content
            if msg.role == "assistant":
                content = self._clean_channel_tags(content)
            ollama_messages.append({"role": msg.role, "content": content})

        payload = {
            "model": target_model,
            "messages": ollama_messages,
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
                    # Use native fields if Ollama has pre-parsed them
                    clean_thinking = self._clean_channel_tags(native_thinking).strip()
                    clean_response = self._clean_channel_tags(raw_content).strip()
                    return AIChatMessage(
                        role="assistant",
                        content=f"<think>{clean_thinking}</think>{clean_response}",
                    )

                # Fallback to marker-based parsing for raw content
                clean_content = self._parse_completed_response(raw_content)
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

        Uses a stateful parser to track <|channel>thought / <|channel>text
        transitions and yield clean <think>...</think> + text chunks.
        """
        target_model = model or self.model
        url = f"{self.host}/api/chat"

        ollama_messages = []
        if self.system_prompt:
            ollama_messages.append({"role": "system", "content": self.system_prompt})

        # Clean history: strip raw channel tags from previous assistant messages
        for msg in messages:
            content = msg.content
            if msg.role == "assistant":
                content = self._clean_channel_tags(content)
            ollama_messages.append({"role": msg.role, "content": content})

        payload = {
            "model": target_model,
            "messages": ollama_messages,
            "stream": True,
            "options": {
                "temperature": 1.0,
                "top_p": 0.95,
                "top_k": 64,
            },
        }

        logger.debug("Ollama Stream Request Payload: %s", json.dumps(payload, indent=2))

        try:
            async with (
                aiohttp.ClientSession(timeout=self.timeout) as session,
                session.post(url, json=payload) as resp,
            ):
                if resp.status != 200:
                    err_text = await resp.text()
                    logger.error("Ollama Streaming Error (%d): %s", resp.status, err_text)
                    raise RuntimeError(f"Ollama stream error: {err_text}")

                # Stateful parser state
                phase = _StreamPhase.TEXT
                content_buffer = ""
                think_open_emitted = False

                async for line in resp.content:
                    if not line:
                        continue
                    try:
                        line_str = line.decode("utf-8").strip()
                        if not line_str:
                            continue

                        chunk_data = json.loads(line_str)
                        msg = chunk_data.get("message", {})

                        # 1. Native Ollama Reasoning Field Detection
                        # If the chunk contains a 'thinking' or 'thought' field, it's definitely reasoning.
                        native_thinking = msg.get("thinking") or msg.get("thought")
                        if native_thinking:
                            if not think_open_emitted:
                                yield "<think>"
                                think_open_emitted = True
                            yield native_thinking
                            phase = _StreamPhase.THOUGHT
                            continue

                        token = msg.get("content", "")
                        if not token:
                            if chunk_data.get("done"):
                                break
                            continue

                        # 2. Automated Phase Transition
                        # If we have a non-empty 'content' token but were in THOUGHT phase,
                        # and this chunk has NO native thinking field, we transition to TEXT.
                        if (
                            phase == _StreamPhase.THOUGHT
                            and token.strip()
                            and not native_thinking
                            and not any(m in token for m in ALL_THOUGHT_MARKERS)
                        ):
                            if think_open_emitted:
                                yield "</think>"
                                think_open_emitted = False
                            phase = _StreamPhase.TEXT

                        # Granular token logging (Toggled via ENV)
                        if os.getenv("LOGLENS_AI_DEBUG", "false").lower() == "true":
                            logger.debug(
                                "PHASE: %s | TOKEN: [%s]", phase.name, token.replace("\n", "\\n")
                            )

                        # 3. Accumulate into buffer for marker-based transition (Fallback)
                        content_buffer += token

                        # 4. Process buffer for channel markers
                        while content_buffer:
                            if phase == _StreamPhase.TEXT:
                                # Look for any thought start marker
                                found_idx = -1
                                found_marker = ""
                                for m in ALL_THOUGHT_MARKERS:
                                    idx = content_buffer.find(m)
                                    if idx != -1 and (found_idx == -1 or idx < found_idx):
                                        found_idx = idx
                                        found_marker = m

                                if found_idx != -1:
                                    # Yield any text before the marker
                                    before = content_buffer[:found_idx]
                                    if before:
                                        yield before
                                    # Transition to thought phase
                                    phase = _StreamPhase.THOUGHT
                                    if not think_open_emitted:
                                        yield "<think>"
                                        think_open_emitted = True
                                    content_buffer = content_buffer[found_idx + len(found_marker) :]
                                elif any(
                                    content_buffer.endswith(m[:i])
                                    for m in ALL_THOUGHT_MARKERS
                                    for i in range(1, len(m))
                                ):
                                    # Buffer ends with a partial start marker - hold it
                                    break
                                else:
                                    # No marker in sight - flush text
                                    yield content_buffer
                                    content_buffer = ""

                            elif phase == _StreamPhase.THOUGHT:
                                # Look for any text transition marker
                                found_idx = -1
                                found_marker = ""
                                for m in ALL_TEXT_MARKERS:
                                    idx = content_buffer.find(m)
                                    if idx != -1 and (found_idx == -1 or idx < found_idx):
                                        found_idx = idx
                                        found_marker = m

                                if found_idx != -1:
                                    # Yield thinking content before transition
                                    thinking_chunk = content_buffer[:found_idx]
                                    if thinking_chunk:
                                        yield thinking_chunk
                                    content_buffer = content_buffer[found_idx + len(found_marker) :]

                                    # Close thinking block and move to text
                                    if think_open_emitted:
                                        yield "</think>"
                                        think_open_emitted = False
                                    phase = _StreamPhase.TEXT
                                elif any(
                                    content_buffer.endswith(m[:i])
                                    for m in ALL_TEXT_MARKERS
                                    for i in range(1, len(m))
                                ):
                                    # Buffer ends with a partial end/transition marker - hold it
                                    break
                                else:
                                    # Pure thinking content - flush it
                                    yield content_buffer
                                    content_buffer = ""

                        if chunk_data.get("done"):
                            logger.info("Ollama Stream finished successfully")
                            break

                    except json.JSONDecodeError:
                        continue

                # Final flush
                if content_buffer:
                    remaining = self._clean_channel_tags(content_buffer).strip()
                    if remaining:
                        yield remaining

                if think_open_emitted:
                    yield "</think>"
                    think_open_emitted = False

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
            "format": "json",  # Ollama supports forcing JSON output
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
