"""
Tests for the unified ThinkingStreamParser and associated utilities.

Covers:
  - detect_thinking_mode registry
  - clean_thinking_markers utility
  - parse_completed_response (non-streaming)
  - ThinkingStreamParser streaming (CHANNEL_MARKERS, NATIVE_FIELD, NONE/pass-through)
"""

from ai.thinking_parser import (
    THINK_CLOSE,
    THINK_OPEN,
    ThinkingMode,
    ThinkingStreamParser,
    clean_thinking_markers,
    detect_thinking_mode,
    parse_completed_response,
)

# ---------------------------------------------------------------------------
# detect_thinking_mode
# ---------------------------------------------------------------------------


class TestDetectThinkingMode:
    """Registry lookup returns the correct ThinkingMode for known model names."""

    def test_gemma4_ollama_colon_format(self):
        assert detect_thinking_mode("gemma4:e2b") == ThinkingMode.CHANNEL_MARKERS

    def test_gemma4_ollama_colon_large(self):
        assert detect_thinking_mode("gemma4:27b") == ThinkingMode.CHANNEL_MARKERS

    def test_gemma4_ai_studio_format(self):
        assert detect_thinking_mode("gemma-4-27b-it") == ThinkingMode.CHANNEL_MARKERS

    def test_gemma4_ai_studio_models_prefix(self):
        assert detect_thinking_mode("models/gemma-4-31b-it") == ThinkingMode.CHANNEL_MARKERS

    def test_gemma3_ai_studio(self):
        assert detect_thinking_mode("gemma-3-27b-it") == ThinkingMode.CHANNEL_MARKERS

    def test_deepseek_r1(self):
        assert detect_thinking_mode("deepseek-r1:7b") == ThinkingMode.STANDARD_TAGS

    def test_qwq(self):
        assert detect_thinking_mode("qwq-32b") == ThinkingMode.STANDARD_TAGS

    def test_openai_o1(self):
        assert detect_thinking_mode("o1") == ThinkingMode.GPT_O_SERIES

    def test_openai_o3_mini(self):
        assert detect_thinking_mode("o3-mini") == ThinkingMode.GPT_O_SERIES

    def test_openai_o4_mini(self):
        assert detect_thinking_mode("o4-mini") == ThinkingMode.GPT_O_SERIES

    def test_regular_gemini(self):
        assert detect_thinking_mode("gemini-2.0-flash") == ThinkingMode.NONE

    def test_llama_no_thinking(self):
        assert detect_thinking_mode("llama3:8b") == ThinkingMode.NONE

    def test_empty_string(self):
        assert detect_thinking_mode("") == ThinkingMode.NONE

    def test_case_insensitivity(self):
        assert detect_thinking_mode("GEMMA-4-27B-IT") == ThinkingMode.CHANNEL_MARKERS


# ---------------------------------------------------------------------------
# clean_thinking_markers
# ---------------------------------------------------------------------------


class TestCleanThinkingMarkers:
    """Marker stripping is idempotent and comprehensive."""

    def test_strips_channel_thought_start(self):
        text = "<|channel>thought some reasoning"
        result = clean_thinking_markers(text)
        assert "<|channel>thought" not in result
        assert "some reasoning" in result

    def test_strips_channel_text_start(self):
        text = "<|channel>text final answer"
        result = clean_thinking_markers(text)
        assert "<|channel>text" not in result
        assert "final answer" in result

    def test_strips_think_block(self):
        text = f"{THINK_OPEN}reasoning here{THINK_CLOSE}answer here"
        result = clean_thinking_markers(text)
        assert THINK_OPEN not in result
        assert THINK_CLOSE not in result
        assert "reasoning here" not in result
        assert "answer here" in result

    def test_idempotent_on_clean_text(self):
        text = "This is a plain log analysis response."
        assert clean_thinking_markers(text) == text

    def test_strips_all_alt_markers(self):
        markers = ["<|thought|>", "<|text|>", "<channel|>", "<|channel|>text"]
        for marker in markers:
            result = clean_thinking_markers(f"{marker} content")
            assert marker not in result

    def test_handles_none_input(self):
        assert clean_thinking_markers(None) == ""


# ---------------------------------------------------------------------------
# parse_completed_response
# ---------------------------------------------------------------------------


class TestParseCompletedResponse:
    """Non-streaming completed-response parsing produces normalised output."""

    def test_channel_marker_with_thought_and_text(self):
        raw = "<|channel>thought I am thinking<|channel>text Here is my answer"
        result = parse_completed_response(raw, ThinkingMode.CHANNEL_MARKERS)
        assert result.startswith(THINK_OPEN)
        assert "I am thinking" in result
        assert THINK_CLOSE in result
        assert "Here is my answer" in result

    def test_channel_marker_no_thinking(self):
        raw = "Just a plain response"
        result = parse_completed_response(raw, ThinkingMode.CHANNEL_MARKERS)
        assert result == "Just a plain response"

    def test_channel_marker_thinking_only(self):
        raw = "<|channel>thought Still thinking, no answer yet"
        result = parse_completed_response(raw, ThinkingMode.CHANNEL_MARKERS)
        assert result.startswith(THINK_OPEN)
        assert "Still thinking" in result
        # Should end with THINK_CLOSE since no text transition was found
        assert THINK_CLOSE in result

    def test_standard_tags_passthrough(self):
        """STANDARD_TAGS mode: content already has <think> tags, just pass through."""
        raw = f"{THINK_OPEN}reasoning{THINK_CLOSE}answer"
        result = parse_completed_response(raw, ThinkingMode.STANDARD_TAGS)
        assert result == raw

    def test_none_mode_strips_markers(self):
        raw = "<|channel>thought leaked thinking<|channel>text answer"
        result = parse_completed_response(raw, ThinkingMode.NONE)
        assert "<|channel>" not in result

    def test_alt_thought_marker(self):
        raw = "<|thought|>reasoning here<|text|>final text"
        result = parse_completed_response(raw, ThinkingMode.CHANNEL_MARKERS)
        assert THINK_OPEN in result
        assert "reasoning here" in result
        assert THINK_CLOSE in result
        assert "final text" in result


# ---------------------------------------------------------------------------
# ThinkingStreamParser — NONE / STANDARD_TAGS (pass-through)
# ---------------------------------------------------------------------------


class TestThinkingStreamParserPassThrough:
    """NONE and STANDARD_TAGS modes emit tokens unchanged."""

    def test_none_mode_passes_through(self):
        parser = ThinkingStreamParser(ThinkingMode.NONE)
        result = parser.feed(content="hello world")
        assert result == ["hello world"]

    def test_none_mode_empty_is_empty(self):
        parser = ThinkingStreamParser(ThinkingMode.NONE)
        assert parser.feed(content="") == []

    def test_standard_tags_passes_through(self):
        parser = ThinkingStreamParser(ThinkingMode.STANDARD_TAGS)
        chunks = parser.feed(content=f"{THINK_OPEN}reasoning{THINK_CLOSE}answer")
        assert "".join(chunks) == f"{THINK_OPEN}reasoning{THINK_CLOSE}answer"

    def test_flush_on_passthrough_is_empty(self):
        parser = ThinkingStreamParser(ThinkingMode.NONE)
        parser.feed(content="some content")
        assert parser.flush() == []


# ---------------------------------------------------------------------------
# ThinkingStreamParser — CHANNEL_MARKERS (Gemma 4 streaming)
# ---------------------------------------------------------------------------


class TestThinkingStreamParserChannelMarkers:
    """Stateful channel-marker parsing wraps thinking content in <think> tags."""

    def _feed_tokens(self, tokens: list[str]) -> str:
        """Helper: feed a list of tokens through the parser and join output."""
        parser = ThinkingStreamParser(ThinkingMode.CHANNEL_MARKERS)
        output: list[str] = []
        for token in tokens:
            output.extend(parser.feed(content=token))
        output.extend(parser.flush())
        return "".join(output)

    def test_simple_thought_then_text(self):
        tokens = ["<|channel>thought", " I am thinking", "<|channel>text", " Here is my answer"]
        result = self._feed_tokens(tokens)
        assert THINK_OPEN in result
        assert "I am thinking" in result
        assert THINK_CLOSE in result
        assert "Here is my answer" in result

    def test_native_thinking_field(self):
        """Ollama native message.thinking field wraps content in <think> tags."""
        parser = ThinkingStreamParser(ThinkingMode.CHANNEL_MARKERS)
        out: list[str] = []
        # Simulate chunks with native thinking
        out.extend(parser.feed(content="", native_thinking="Thinking step 1"))
        out.extend(parser.feed(content="", native_thinking="Thinking step 2"))
        # Now the text answer arrives
        out.extend(parser.feed(content="Final answer"))
        out.extend(parser.flush())
        result = "".join(out)
        assert THINK_OPEN in result
        assert "Thinking step 1" in result
        assert "Thinking step 2" in result
        assert THINK_CLOSE in result
        assert "Final answer" in result

    def test_no_thinking_emits_text_directly(self):
        """If no thought markers appear, text is emitted without any <think> wrapping."""
        tokens = ["Hello", " world", " no thinking"]
        result = self._feed_tokens(tokens)
        assert THINK_OPEN not in result
        assert result == "Hello world no thinking"

    def test_partial_marker_buffered(self):
        """Partial markers at the end of a token are held until the next token resolves them."""
        parser = ThinkingStreamParser(ThinkingMode.CHANNEL_MARKERS)
        # Split "<|channel>thought" across two tokens
        out: list[str] = []
        out.extend(parser.feed(content="<|channel>thou"))
        # Nothing should be emitted yet — partial marker is buffered
        out.extend(parser.feed(content="ght actual thinking<|channel>text answer"))
        out.extend(parser.flush())
        result = "".join(out)
        assert THINK_OPEN in result
        assert "actual thinking" in result
        assert THINK_CLOSE in result
        assert "answer" in result

    def test_flush_closes_open_think_tag(self):
        """If a stream ends while inside a thought phase, flush closes the tag."""
        parser = ThinkingStreamParser(ThinkingMode.CHANNEL_MARKERS)
        out: list[str] = []
        out.extend(parser.feed(content="<|channel>thought"))
        out.extend(parser.feed(content=" still thinking..."))
        out.extend(parser.flush())
        result = "".join(out)
        # <think> is emitted as soon as the marker is detected.
        # flush() appends </think> to close the open block.
        assert THINK_OPEN in result
        assert "still thinking..." in result
        assert THINK_CLOSE in result

    def test_alt_markers_recognised(self):
        """Alternative Gemma markers (<|thought|> / <|text|>) are also handled."""
        tokens = ["<|thought|>", "alt thinking", "<|text|>", "alt answer"]
        result = self._feed_tokens(tokens)
        assert THINK_OPEN in result
        assert "alt thinking" in result
        assert THINK_CLOSE in result
        assert "alt answer" in result

    def test_multiple_consecutive_thinking_chunks(self):
        """Native thinking can arrive across many tokens before the answer."""
        parser = ThinkingStreamParser(ThinkingMode.CHANNEL_MARKERS)
        out: list[str] = []
        for word in ["The", " user", " is", " asking", " about"]:
            out.extend(parser.feed(content="", native_thinking=word))
        out.extend(parser.feed(content="The answer is X"))
        out.extend(parser.flush())
        result = "".join(out)
        # All thinking words should appear inside <think>…</think>
        think_content = result[
            result.index(THINK_OPEN) + len(THINK_OPEN) : result.index(THINK_CLOSE)
        ]
        assert "user" in think_content
        assert "asking" in think_content
        assert "The answer is X" in result

    def test_text_preceding_thought(self):
        """Content arriving before the first thought marker is correctly emitted."""
        parser = ThinkingStreamParser(ThinkingMode.CHANNEL_MARKERS)
        out: list[str] = []
        out.extend(parser.feed(content="Prefix text "))
        out.extend(parser.feed(content="<|channel>thought I am thinking"))
        out.extend(parser.flush())
        result = "".join(out)
        assert result.startswith("Prefix text ")
        assert THINK_OPEN in result
        assert "I am thinking" in result

    def test_partial_text_marker_detection(self):
        """Verify partial markers for text transition are buffered."""
        parser = ThinkingStreamParser(ThinkingMode.CHANNEL_MARKERS)
        out: list[str] = []
        out.extend(parser.feed(content="<|channel>thought I am thinking"))
        # Partial text marker "<|channel>t"
        out.extend(parser.feed(content="<|channel>t"))
        assert THINK_CLOSE not in "".join(out)
        # Complete it
        out.extend(parser.feed(content="ext and here is the answer"))
        out.extend(parser.flush())
        result = "".join(out)
        assert THINK_CLOSE in result
        assert "here is the answer" in result

    def test_feed_empty_content(self):
        """Feeding empty content results in no emission."""
        parser = ThinkingStreamParser(ThinkingMode.CHANNEL_MARKERS)
        assert parser.feed(content="") == []
        assert parser.feed(content=None) == []

    def test_combined_text_and_marker(self):
        """A single token containing both text and a marker is correctly split."""
        parser = ThinkingStreamParser(ThinkingMode.CHANNEL_MARKERS)
        # Token starts with text, ends with marker
        chunks = parser.feed(content="Pre-text<|channel>thought")
        assert "Pre-text" in chunks
        assert THINK_OPEN in chunks

    def test_flush_partial_marker(self):
        """Flushing a partial marker at the end of the stream emits it as plain text."""
        parser = ThinkingStreamParser(ThinkingMode.CHANNEL_MARKERS)
        # Buffer a partial marker
        parser.feed(content="Partial <|chan")
        chunks = parser.flush()
        assert "Partial <|chan" in "".join(chunks)

    def test_none_mode_parse_completed(self):
        """NONE mode in parse_completed_response strips markers."""
        assert parse_completed_response("<|thought|>hidden", ThinkingMode.NONE) == "hidden"

    def test_standard_tags_parse_completed(self):
        """STANDARD_TAGS mode in parse_completed_response returns raw."""
        assert parse_completed_response("raw content", ThinkingMode.STANDARD_TAGS) == "raw content"

    def test_instant_transition_in_single_token(self):
        """A single token containing both thought-start and text-start is handled."""
        parser = ThinkingStreamParser(ThinkingMode.CHANNEL_MARKERS)
        chunks = parser.feed(content="<|channel>thought brief reasoning <|channel>text answer")
        result = "".join(chunks)
        assert result.startswith(THINK_OPEN)
        assert "brief reasoning" in result
        assert THINK_CLOSE in result
        assert "answer" in result
