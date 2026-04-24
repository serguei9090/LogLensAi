from ai.reasoning import THINK_CLOSE, THINK_OPEN, extract_thinking_content, parse_reasoning_blocks


def test_parse_reasoning_blocks_already_normalised():
    text = f"{THINK_OPEN}already{THINK_CLOSE} answer"
    assert parse_reasoning_blocks(text) == text


def test_parse_reasoning_blocks_plain():
    assert parse_reasoning_blocks("plain text") == "plain text"


def test_extract_thinking_no_match():
    thinking, answer = extract_thinking_content("no tags here")
    assert thinking is None
    assert answer == "no tags here"
