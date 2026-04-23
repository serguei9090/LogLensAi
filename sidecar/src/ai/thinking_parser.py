"""
Unified Thinking / Reasoning Stream Parser — TODO(think_parser_001)

Single source of truth for extracting and normalising AI "thinking" content
across every provider (Ollama, AI Studio, OpenAI-compatible).

Why a dedicated module?
  - The same model (e.g. Gemma 4) can be served by multiple providers.
    Duplicating the parsing logic inside each provider violates DRY and
    guarantees drift.
  - Different models emit thinking in fundamentally different ways:
      • Gemma 4 (Ollama)     — inline channel-switching markers in `content`
      • Gemma 4 (AI Studio)  — may expose a `thought` part in the event content
      • Ollama native field  — `message.thinking` populated by the server
      • DeepSeek-R / QwQ    — standard <think>…</think> tags in content
      • GPT o-series         — three-state: thinking_tokens / summary / output
  - Centralising the logic means adding a new model is just a two-line
    registry entry + no provider code change.

Public API (all providers need only these three symbols):
  detect_thinking_mode(model_name)   → ThinkingMode
  ThinkingStreamParser(mode)         — stateful per-request parser
  parse_completed_response(raw,mode) → str  (normalised <think>…</think>+text)
  clean_thinking_markers(text)       → str  (strip all markers from a string)
"""

from __future__ import annotations

import re
from enum import Enum, auto
from typing import Any, NamedTuple

# ---------------------------------------------------------------------------
# Constants — channel-switching markers used by Gemma 4 in Ollama
# ---------------------------------------------------------------------------

THINK_OPEN = "<think>"
THINK_CLOSE = "</think>"

# Gemma 4 inline stream markers
_CHANNEL_THOUGHT_START = "<|channel>thought"
_CHANNEL_TEXT_START = "<|channel>text"
_CHANNEL_THOUGHT_END = "<channel|>"
_ALT_THOUGHT_START = "<|thought|>"
_ALT_TEXT_START = "<|text|>"
_ALT_CHANNEL_TEXT = "<|channel|>text"

# Grouped for iteration
ALL_TEXT_MARKERS: tuple[str, ...] = (
    _CHANNEL_TEXT_START,
    _ALT_TEXT_START,
    _ALT_CHANNEL_TEXT,
    _CHANNEL_THOUGHT_END,
)
ALL_THOUGHT_MARKERS: tuple[str, ...] = (
    _CHANNEL_THOUGHT_START,
    _ALT_THOUGHT_START,
)

# All markers that should be stripped from clean text
_ALL_RAW_MARKERS: tuple[str, ...] = (
    _CHANNEL_THOUGHT_START,
    _CHANNEL_TEXT_START,
    _CHANNEL_THOUGHT_END,
    _ALT_THOUGHT_START,
    _ALT_TEXT_START,
    _ALT_CHANNEL_TEXT,
)


# ---------------------------------------------------------------------------
# ThinkingMode — capability enum
# ---------------------------------------------------------------------------


class ThinkingMode(Enum):
    """Describes how a model exposes its internal reasoning tokens."""

    NONE = auto()
    """Model has no thinking/reasoning capability."""

    CHANNEL_MARKERS = auto()
    """Gemma 4 style: channel-switching tokens injected into the content stream
    (``<|channel>thought`` / ``<|channel>text``).  Also covers the native Ollama
    wire-format where ``message.thinking`` is pre-extracted by the server."""

    STANDARD_TAGS = auto()
    """Model wraps reasoning in ``<think>…</think>`` tags inside the content
    field directly (DeepSeek-R, QwQ, etc.)."""

    GPT_O_SERIES = auto()
    """OpenAI o1/o3/o4-mini: three-state thinking — ``thinking_tokens``,
    ``summary``, and ``output`` are separate fields on the completion delta."""


# ---------------------------------------------------------------------------
# Model-name → ThinkingMode registry
# ---------------------------------------------------------------------------


class _ModelRule(NamedTuple):
    pattern: str  # compiled regex pattern string (case-insensitive)
    mode: ThinkingMode


# Checked in order — first match wins.
_MODEL_RULES: tuple[_ModelRule, ...] = (
    # Gemma 4 via Ollama/Studio (e.g. "gemma4:e2b", "gemma-4-27b-it")
    _ModelRule(r"gemma[-_]?4", ThinkingMode.CHANNEL_MARKERS),
    # Gemma 3
    _ModelRule(r"gemma[-_]?3", ThinkingMode.CHANNEL_MARKERS),
    # Gemini Thinking Models (e.g. "gemini-2.0-flash-thinking", "gemini-3-flash")
    _ModelRule(r"gemini.*thinking", ThinkingMode.CHANNEL_MARKERS),
    _ModelRule(r"gemini.*flash", ThinkingMode.CHANNEL_MARKERS),  # Defensive for Flash reasoning
    # Claude 3.7 Thinking (Claude 3.7 Sonnet)
    _ModelRule(r"claude-3-7", ThinkingMode.CHANNEL_MARKERS),
    # DeepSeek Reasoner / R1 / R-series
    _ModelRule(r"deepseek.*r1", ThinkingMode.STANDARD_TAGS),
    _ModelRule(r"deepseek.*reasoner", ThinkingMode.STANDARD_TAGS),
    _ModelRule(r"deepseek.*r\d*", ThinkingMode.STANDARD_TAGS),
    # QwQ / Qwen Reasoning
    _ModelRule(r"qwq", ThinkingMode.STANDARD_TAGS),
    _ModelRule(r"qwen.*reasoner", ThinkingMode.STANDARD_TAGS),
    # OpenAI o-series (o1, o3, o4 …)
    _ModelRule(r"^o[134](-mini|-pro|-preview)?$", ThinkingMode.GPT_O_SERIES),
    _ModelRule(r"^(gpt-)?o[134]", ThinkingMode.GPT_O_SERIES),
)

_compiled_rules: tuple[tuple[re.Pattern[str], ThinkingMode], ...] | None = None


def _get_compiled_rules() -> tuple[tuple[re.Pattern[str], ThinkingMode], ...]:
    """Lazily compile regex patterns once."""
    global _compiled_rules
    if _compiled_rules is None:
        _compiled_rules = tuple(
            (re.compile(rule.pattern, re.IGNORECASE), rule.mode) for rule in _MODEL_RULES
        )
    return _compiled_rules


def detect_thinking_mode(model_name: str) -> ThinkingMode:
    """Return the ``ThinkingMode`` for *model_name*.

    Args:
        model_name: Raw model identifier as stored in settings (e.g.
            ``"gemma4:e2b"``, ``"models/gemma-4-31b-it"``, ``"o3-mini"``).

    Returns:
        The matching ``ThinkingMode``, or ``ThinkingMode.NONE`` if the model
        is not in the registry.
    """
    if not model_name:
        return ThinkingMode.NONE
    for pattern, mode in _get_compiled_rules():
        if pattern.search(model_name):
            return mode
    return ThinkingMode.NONE


# ---------------------------------------------------------------------------
# Utility — strip raw markers from any string
# ---------------------------------------------------------------------------


def clean_thinking_markers(text: Any) -> str:
    """Strip channel-switching markers and ``<think>`` blocks from *text*.

    Primarily used to clean assistant history before feeding it back to the
    model as context — the model should not see its own raw markers.

    Args:
        text: Raw assistant message content.

    Returns:
        Cleaned string with all thinking artefacts removed.
    """
    if not isinstance(text, str):
        text = str(text) if text is not None else ""
    # Remove entire <think>…</think> blocks (already-normalised format)
    text = re.sub(rf"{re.escape(THINK_OPEN)}[\s\S]*?{re.escape(THINK_CLOSE)}", "", text)
    # Remove raw channel markers that may have leaked through
    for marker in _ALL_RAW_MARKERS:
        text = text.replace(marker, "")
    return text.strip()


# ---------------------------------------------------------------------------
# Completed-response parser (non-streaming)
# ---------------------------------------------------------------------------


def parse_completed_response(raw: str, mode: ThinkingMode) -> str:
    """Convert a fully accumulated response into ``<think>…</think>+answer`` form.

    This is used for the non-streaming ``chat()`` path and as a post-processor
    when a stream has been fully consumed.

    Args:
        raw: The complete, unprocessed response string from the model.
        mode: ``ThinkingMode`` for the model that produced *raw*.

    Returns:
        Normalised string — thinking wrapped in ``<think>`` tags, followed by
        the clean answer text.  If no thinking content is found, *raw* is
        returned after stripping any stray markers.
    """
    # If already normalised (contains <think>), just clean up other stray markers
    if THINK_OPEN in raw and THINK_CLOSE in raw:
        return raw

    if mode == ThinkingMode.CHANNEL_MARKERS:
        return _parse_channel_marker_response(raw)
    if mode in (ThinkingMode.STANDARD_TAGS, ThinkingMode.GPT_O_SERIES):
        # Already assembled by the caller with the correct tags before calling us.
        return raw
    return clean_thinking_markers(raw).strip()


def _parse_channel_marker_response(raw: str) -> str:
    """Internal: convert a Gemma 4 channel-marker response to normalised form."""
    # Find the earliest thought marker
    thought_idx = -1
    thought_marker = ""
    for marker in ALL_THOUGHT_MARKERS:
        idx = raw.find(marker)
        if idx != -1 and (thought_idx == -1 or idx < thought_idx):
            thought_idx = idx
            thought_marker = marker

    if thought_idx == -1:
        # No thinking content at all
        return clean_thinking_markers(raw).strip()

    # Find the earliest text-transition after the thought start
    text_idx = -1
    text_marker = ""
    for marker in ALL_TEXT_MARKERS:
        idx = raw.find(marker, thought_idx + len(thought_marker))
        if idx != -1 and (text_idx == -1 or idx < text_idx):
            text_idx = idx
            text_marker = marker

    if text_idx != -1:
        thinking = raw[thought_idx + len(thought_marker) : text_idx]
        response = raw[text_idx + len(text_marker) :]
        thinking = clean_thinking_markers(thinking).strip()
        response = clean_thinking_markers(response).strip()
        return f"{THINK_OPEN}{thinking}{THINK_CLOSE}{response}"

    # Only thinking content, no answer yet
    thinking = raw[thought_idx + len(thought_marker) :]
    thinking = clean_thinking_markers(thinking).strip()
    return f"{THINK_OPEN}{thinking}{THINK_CLOSE}"


# ---------------------------------------------------------------------------
# Streaming phase state
# ---------------------------------------------------------------------------


class _Phase(Enum):
    TEXT = auto()
    THOUGHT = auto()


# ---------------------------------------------------------------------------
# ThinkingStreamParser — stateful, per-request parser
# ---------------------------------------------------------------------------


class ThinkingStreamParser:
    """Stateful stream parser that emits normalised ``<think>`` chunks.

    Create one instance **per request** (not per provider).  Feed tokens from
    the provider as they arrive; call ``flush()`` after the stream ends.

    Supports:
      * ``ThinkingMode.CHANNEL_MARKERS`` — Gemma 4 inline channel tokens,
        plus the Ollama native ``message.thinking`` pre-extracted field.
      * ``ThinkingMode.STANDARD_TAGS`` — pass-through (tags already in content).
      * ``ThinkingMode.NONE`` — pass-through, no processing.
      * ``ThinkingMode.GPT_O_SERIES`` — caller assembles ``<think>`` from the
        three API fields and feeds as a single content string; pass-through here.

    Usage::

        parser = ThinkingStreamParser(detect_thinking_mode(model))
        async for line in provider_stream:
            for chunk in parser.feed(content=line.content, native_thinking=line.thinking):
                yield chunk
        for chunk in parser.flush():
            yield chunk

    Args:
        mode: The ``ThinkingMode`` for the model being streamed.
    """

    def __init__(self, mode: ThinkingMode) -> None:
        self.mode = mode
        self._phase = _Phase.TEXT
        self._buffer = ""
        self._emitted_think = False
        self._done = False

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def feed(
        self,
        content: str = "",
        native_thinking: str | None = None,
    ) -> list[str]:
        """Process one streaming token/chunk.

        Args:
            content: The text token from the model's ``content`` / ``message``
                field.  May be empty when only native thinking is present.
            native_thinking: Pre-extracted thinking text from ``message.thinking``
                (Ollama native format).  ``None`` if not present in this chunk.

        Returns:
            A list of normalised string chunks to forward to the UI.  May be
            empty (data is buffered internally).
        """
        # Ensure we are working with strings
        content = str(content) if content is not None else ""
        native_thinking = str(native_thinking) if native_thinking is not None else None

        # 1. Native pre-extracted thinking field (provider or server did the work)
        if native_thinking:
            # We force switch to CHANNEL_MARKERS logic internally for native handling
            # even if the mode is NONE, because explicit thinking was provided.
            return self._handle_native_thinking(native_thinking)

        if self.mode in (ThinkingMode.NONE, ThinkingMode.STANDARD_TAGS, ThinkingMode.GPT_O_SERIES):
            # Pass-through: no marker processing required for standard content.
            return [content] if content else []

        # 2. Empty token — may indicate stream end
        if not content:
            return []

        # CHANNEL_MARKERS mode — full stateful processing for content stream
        return self._feed_channel_markers(content, None)

    def flush(self) -> list[str]:
        """Return any remaining buffered content and close open tags.

        Call once after the stream has been fully consumed.

        Returns:
            Zero or more normalised chunks.
        """
        chunks: list[str] = []

        if self.mode == ThinkingMode.CHANNEL_MARKERS:
            # Emit whatever is left in the buffer
            if self._buffer:
                rem = clean_thinking_markers(self._buffer).strip()
                if rem:
                    chunks.append(rem)
                self._buffer = ""
            # Close any open <think> tag
            if self._emitted_think:
                chunks.append(THINK_CLOSE)
                self._emitted_think = False

        return chunks

    # ------------------------------------------------------------------
    # Internal — CHANNEL_MARKERS mode
    # ------------------------------------------------------------------

    def _feed_channel_markers(
        self,
        content: str,
        native_thinking: str | None,
    ) -> list[str]:
        """Stateful processing for Gemma 4 channel-marker streams."""
        chunks: list[str] = []

        # 1. Native pre-extracted thinking field (Ollama server did the work)
        if native_thinking:
            chunks.extend(self._handle_native_thinking(native_thinking))
            # When native_thinking is present the content is expected to be ""
            return chunks

        # 2. Empty token — may indicate stream end
        if not content:
            return chunks

        # 3. Transition detection: if we were in THOUGHT phase and the new
        #    content token has no thought markers, switch to TEXT phase.
        chunks.extend(self._maybe_close_thought(content))

        # 4. Buffer the token and process marker boundaries
        self._buffer += content
        while self._buffer:
            sub_chunks, new_phase, new_emitted, self._buffer = self._process_buffer(
                self._buffer, self._phase, self._emitted_think
            )
            self._phase = new_phase
            self._emitted_think = new_emitted
            chunks.extend(sub_chunks)
            if not sub_chunks and self._buffer:
                # Nothing was emitted and buffer unchanged — partial marker; wait
                break

        return chunks

    def _handle_native_thinking(self, native_thinking: str) -> list[str]:
        """Emit <think> wrapper around a pre-extracted thinking string."""
        chunks: list[str] = []
        if not self._emitted_think:
            chunks.append(THINK_OPEN)
            self._emitted_think = True
        chunks.append(native_thinking)
        self._phase = _Phase.THOUGHT
        return chunks

    def _maybe_close_thought(self, token: str) -> list[str]:
        """Detect text-phase resumption when in THOUGHT and no thought marker."""
        if (
            self._phase == _Phase.THOUGHT
            and token.strip()
            and not any(m in token for m in ALL_THOUGHT_MARKERS)
        ):
            chunks: list[str] = []
            if self._emitted_think:
                chunks.append(THINK_CLOSE)
                self._emitted_think = False
            self._phase = _Phase.TEXT
            return chunks
        return []

    # ------------------------------------------------------------------
    # Buffer processing — detects marker boundaries inside buffered text
    # ------------------------------------------------------------------

    def _process_buffer(
        self,
        buffer: str,
        phase: _Phase,
        emitted_think: bool,
    ) -> tuple[list[str], _Phase, bool, str]:
        """Scan *buffer* for the next phase-transition marker.

        Returns:
            (emitted_chunks, new_phase, new_emitted_think, remaining_buffer)
        """
        if phase == _Phase.TEXT:
            return self._scan_for_thought_start(buffer, emitted_think)
        return self._scan_for_text_start(buffer, emitted_think)

    @staticmethod
    def _scan_for_thought_start(
        buffer: str, emitted_think: bool
    ) -> tuple[list[str], _Phase, bool, str]:
        """TEXT phase: look for the first thought-start marker."""
        found_idx = -1
        found_marker = ""
        for marker in ALL_THOUGHT_MARKERS:
            idx = buffer.find(marker)
            if idx != -1 and (found_idx == -1 or idx < found_idx):
                found_idx = idx
                found_marker = marker

        if found_idx != -1:
            before = buffer[:found_idx]
            remaining = buffer[found_idx + len(found_marker) :]
            chunks: list[str] = []
            if before:
                chunks.append(before)
            if not emitted_think:
                chunks.append(THINK_OPEN)
                emitted_think = True
            return chunks, _Phase.THOUGHT, emitted_think, remaining

        # Check for partial marker at the end (don't emit yet)
        if any(buffer.endswith(m[:i]) for m in ALL_THOUGHT_MARKERS for i in range(1, len(m))):
            return [], _Phase.TEXT, emitted_think, buffer

        return [buffer], _Phase.TEXT, emitted_think, ""

    @staticmethod
    def _scan_for_text_start(
        buffer: str, emitted_think: bool
    ) -> tuple[list[str], _Phase, bool, str]:
        """THOUGHT phase: look for the first text-start marker."""
        found_idx = -1
        found_marker = ""
        for marker in ALL_TEXT_MARKERS:
            idx = buffer.find(marker)
            if idx != -1 and (found_idx == -1 or idx < found_idx):
                found_idx = idx
                found_marker = marker

        if found_idx != -1:
            thinking_chunk = buffer[:found_idx]
            remaining = buffer[found_idx + len(found_marker) :]
            chunks: list[str] = []
            if thinking_chunk:
                chunks.append(thinking_chunk)
            if emitted_think:
                chunks.append(THINK_CLOSE)
                emitted_think = False
            return chunks, _Phase.TEXT, emitted_think, remaining

        # Check for partial marker at the end
        if any(buffer.endswith(m[:i]) for m in ALL_TEXT_MARKERS for i in range(1, len(m))):
            return [], _Phase.THOUGHT, emitted_think, buffer

        return [buffer], _Phase.THOUGHT, emitted_think, ""
