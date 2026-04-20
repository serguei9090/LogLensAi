import json
import logging
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


THINK_OPEN = "<think>"
THINK_CLOSE = "</think>"


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
        text = re.sub(rf"{THINK_OPEN}[\s\S]*?{THINK_CLOSE}", "", text)

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
            return f"{THINK_OPEN}{thinking}{THINK_CLOSE}{response}"

        thinking = raw[thought_idx + len(thought_marker) :]
        thinking = OllamaProvider._clean_channel_tags(thinking).strip()
        return f"{THINK_OPEN}{thinking}{THINK_CLOSE}"

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
                        content=f"{THINK_OPEN}{clean_thinking}{THINK_CLOSE}{clean_response}",
                    )

                # Fallback to marker-based parsing for raw content
                clean_content = self._parse_completed_response(raw_content)
                return AIChatMessage(role="assistant", content=clean_content)
        except Exception as e:
            return AIChatMessage(role="assistant", content=f"Ollama Connection Error: {str(e)}")

    def _handle_text_phase(self, buffer: str, emitted_think: bool):
        """Internal helper for text-to-thought transition detection."""
        found_idx = -1
        found_marker = ""
        for m in ALL_THOUGHT_MARKERS:
            idx = buffer.find(m)
            if idx != -1 and (found_idx == -1 or idx < found_idx):
                found_idx = idx
                found_marker = m

        if found_idx != -1:
            before = buffer[:found_idx]
            rem = buffer[found_idx + len(found_marker) :]
            chunks = []
            if before:
                chunks.append(before)
            if not emitted_think:
                chunks.append(THINK_OPEN)
                emitted_think = True
            return chunks, _StreamPhase.THOUGHT, emitted_think, rem

        if any(buffer.endswith(m[:i]) for m in ALL_THOUGHT_MARKERS for i in range(1, len(m))):
            return [], _StreamPhase.TEXT, emitted_think, buffer

        return [buffer], _StreamPhase.TEXT, emitted_think, ""

    def _handle_thought_phase(self, buffer: str, emitted_think: bool):
        """Internal helper for thought-to-text transition detection."""
        found_idx = -1
        found_marker = ""
        for m in ALL_TEXT_MARKERS:
            idx = buffer.find(m)
            if idx != -1 and (found_idx == -1 or idx < found_idx):
                found_idx = idx
                found_marker = m

        if found_idx != -1:
            thinking_chunk = buffer[:found_idx]
            rem = buffer[found_idx + len(found_marker) :]
            chunks = []
            if thinking_chunk:
                chunks.append(thinking_chunk)
            if emitted_think:
                chunks.append(THINK_CLOSE)
                emitted_think = False
            return chunks, _StreamPhase.TEXT, emitted_think, rem

        if any(buffer.endswith(m[:i]) for m in ALL_TEXT_MARKERS for i in range(1, len(m))):
            return [], _StreamPhase.THOUGHT, emitted_think, buffer

        return [buffer], _StreamPhase.THOUGHT, emitted_think, ""

    def _handle_native_thought(self, native_thinking: str | None, state: dict):
        """Processes native thinking tokens if present."""
        chunks = []
        if native_thinking:
            if not state["emitted_think"]:
                chunks.append(THINK_OPEN)
                state["emitted_think"] = True
            chunks.append(native_thinking)
            state["phase"] = _StreamPhase.THOUGHT
        return chunks

    def _apply_token_transitions(self, token: str, native_thinking: bool, state: dict):
        """Handles manual phase transitions based on token content."""
        chunks = []
        is_thought_to_text = (
            state["phase"] == _StreamPhase.THOUGHT
            and token.strip()
            and not native_thinking
            and not any(m in token for m in ALL_THOUGHT_MARKERS)
        )
        if is_thought_to_text:
            if state["emitted_think"]:
                chunks.append(THINK_CLOSE)
                state["emitted_think"] = False
            state["phase"] = _StreamPhase.TEXT
        return chunks

    def _process_stream_buffer(self, buffer: str, phase: _StreamPhase, emitted_think: bool):
        """Processes the content buffer and yields (chunk, new_phase, new_emitted_think)."""
        if phase == _StreamPhase.TEXT:
            return self._handle_text_phase(buffer, emitted_think)
        return self._handle_thought_phase(buffer, emitted_think)

    def _process_stream_line(self, line: bytes, state: dict):
        """Processes a single line from the Ollama chat stream."""
        if not line:
            return []

        chunk_data = json.loads(line.decode("utf-8").strip())
        msg = chunk_data.get("message", {})
        native_thinking = msg.get("thinking") or msg.get("thought")

        # 1. Handle Native Thinking
        chunks = self._handle_native_thought(native_thinking, state)
        if chunks:
            return chunks

        # 2. Handle Token/Done
        token = msg.get("content", "")
        if not token:
            if chunk_data.get("done"):
                state["done"] = True
            return []

        # 3. Transition logic
        chunks.extend(self._apply_token_transitions(token, bool(native_thinking), state))

        # 4. Buffer logic
        state["buffer"] += token
        while state["buffer"]:
            sub_chunks, state["phase"], state["emitted_think"], state["buffer"] = (
                self._process_stream_buffer(state["buffer"], state["phase"], state["emitted_think"])
            )
            chunks.extend(sub_chunks)
            if not sub_chunks and state["buffer"]:
                break

        return chunks

    def _format_messages(self, messages: list[AIChatMessage]) -> list[dict]:
        """Prepares message list for Ollama payload."""
        ollama_messages = []
        if self.system_prompt:
            ollama_messages.append({"role": "system", "content": self.system_prompt})

        for msg in messages:
            content = (
                self._clean_channel_tags(msg.content) if msg.role == "assistant" else msg.content
            )
            ollama_messages.append({"role": msg.role, "content": content})
        return ollama_messages

    async def chat_stream(
        self,
        messages: list[AIChatMessage],
        model: str | None = None,
        reasoning: bool | None = True,
        session_id: str | None = None,
        **kwargs,
    ):
        """Streams response using Ollama's /api/chat endpoint."""
        payload = {
            "model": model or self.model,
            "messages": self._format_messages(messages),
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

                state = {
                    "phase": _StreamPhase.TEXT,
                    "buffer": "",
                    "emitted_think": False,
                    "done": False,
                }
                async for line in resp.content:
                    chunks = self._process_stream_line(line, state)
                    for c in chunks:
                        yield c
                    if state["done"]:
                        break

                if state["buffer"]:
                    rem = self._clean_channel_tags(state["buffer"]).strip()
                    if rem:
                        yield rem
                if state["emitted_think"]:
                    yield THINK_CLOSE

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
