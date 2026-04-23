"""
Backward-compatibility shim for the reasoning module.

All logic has been moved to ``thinking_parser`` (see TODO think_parser_001).
Existing callers (e.g. ``api.py``, ``runner.py``) continue to import
``parse_reasoning_blocks`` from this module without any changes.
"""

from .thinking_parser import (
    ALL_THOUGHT_MARKERS,
    THINK_CLOSE,
    THINK_OPEN,
    ThinkingMode,
    ThinkingStreamParser,
    clean_thinking_markers,
    detect_thinking_mode,
    parse_completed_response,
)


def parse_reasoning_blocks(text: str) -> str:
    """Normalise any raw thinking markers in *text* into <think> tags.

    This is a thin wrapper that handles multiple legacy and modern formats,
    ensuring the frontend can render thinking blocks consistently.

    Args:
        text: A string that may contain raw Gemma 4 channel markers,
              [reasoning] blocks, or <thought> tags.

    Returns:
        The input string with all raw markers converted to <think>...</think>.
    """
    import re

    # 1. Already normalised? Preserve it.
    if THINK_OPEN in text and THINK_CLOSE in text:
        return text

    # 2. Handle [reasoning]...[/reasoning]
    text = re.sub(
        r"\[reasoning\]\s*([\s\S]*?)\s*\[/reasoning\]", rf"{THINK_OPEN}\1{THINK_CLOSE}", text
    )

    # 3. Handle <thought>...</thought>
    text = re.sub(r"<thought>\s*([\s\S]*?)\s*</thought>", rf"{THINK_OPEN}\1{THINK_CLOSE}", text)

    # 4. Handle Gemma 4 Channel Markers (Non-streaming normalization)
    # Since we don't have the mode here, we assume CHANNEL_MARKERS logic if we see the tokens.
    if any(m in text for m in ALL_THOUGHT_MARKERS):
        return parse_completed_response(text, ThinkingMode.CHANNEL_MARKERS)

    return text.strip()


def extract_thinking_content(text: str) -> tuple[str | None, str]:
    """Separates thinking content from the final response.

    Kept for backward compatibility.  Splits a ``<think>…</think>+answer``
    string back into its two components.

    Args:
        text: Normalised response string.

    Returns:
        ``(thinking, answer)`` where *thinking* is ``None`` if no block found.
    """
    import re

    match = re.search(
        rf"{re.escape(THINK_OPEN)}(.*?){re.escape(THINK_CLOSE)}",
        text,
        re.DOTALL,
    )
    if match:
        thinking = match.group(1).strip()
        answer = text.replace(match.group(0), "").strip()
        return thinking, answer

    return None, text


__all__ = [
    "parse_reasoning_blocks",
    "extract_thinking_content",
    "ThinkingMode",
    "ThinkingStreamParser",
    "clean_thinking_markers",
    "detect_thinking_mode",
    "parse_completed_response",
    "THINK_OPEN",
    "THINK_CLOSE",
]
