"""
Backward-compatibility shim for the reasoning module.

All logic has been moved to ``thinking_parser`` (see TODO think_parser_001).
Existing callers (e.g. ``api.py``, ``runner.py``) continue to import
``parse_reasoning_blocks`` from this module without any changes.
"""

from .thinking_parser import (
    THINK_CLOSE,
    THINK_OPEN,
    ThinkingMode,
    ThinkingStreamParser,
    clean_thinking_markers,
    detect_thinking_mode,
    parse_completed_response,
)


def parse_reasoning_blocks(text: str) -> str:
    """Normalise any raw thinking markers in *text* by stripping them cleanly.

    This is a thin wrapper around ``clean_thinking_markers`` kept for backward
    compatibility with callsites in ``api.py`` and ``runner.py``.  New code
    should import directly from ``thinking_parser``.

    Args:
        text: A string that may contain raw Gemma 4 channel markers or
              ``<think>`` blocks.

    Returns:
        The input string with all raw markers removed.  Already-normalised
        ``<think>…</think>`` blocks are **preserved** so the frontend can
        render them.
    """
    return clean_thinking_markers(text)


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
