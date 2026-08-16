package providers

import (
	"regexp"
	"strings"
)

// thinkOpen/thinkClose are the normalized wrapper tags used to surface a
// model's reasoning/thinking content to the UI, matching Python's
// THINK_OPEN/THINK_CLOSE constants (sidecar/src/ai/thinking_parser.py).
const (
	thinkOpen  = "<think>"
	thinkClose = "</think>"
)

// thinkingModel is the subset of Python's `_MODEL_RULES` registry that is
// actually load-bearing for this port: which models get the
// REASONING_DIRECTIVE system prompt injected (Ollama) and which models
// natively expose a separate "thinking" field worth wrapping in
// <think>...</think>. See the deviation note in the package doc comment on
// why the full Gemma-4 inline channel-marker *streaming* state machine
// (ThinkingStreamParser in Python) was not ported.
var thinkingModelPattern = regexp.MustCompile(`(?i)gemma[-_]?4|gemma[-_]?3|gemini.*thinking|claude-3-7`)

// hasChannelMarkerThinking reports whether a model name is known to use
// inline channel-switching markers (Gemma 4/3 style) or otherwise benefits
// from the reasoning directive / thinking-wrapping behavior. Mirrors the
// subset of Python's detect_thinking_mode() this port relies on.
func hasChannelMarkerThinking(model string) bool {
	if model == "" {
		return false
	}
	return thinkingModelPattern.MatchString(model)
}

// wrapThinking normalizes a (thought, answer) pair into the
// "<think>...</think>answer" form the UI expects, matching Python's
// parse_completed_response()/native-thinking branch in ollama.py and
// ai_studio.py.
func wrapThinking(thought, answer string) string {
	thought = cleanThinkingMarkers(thought)
	answer = cleanThinkingMarkers(answer)
	if thought == "" {
		return answer
	}
	return thinkOpen + thought + thinkClose + answer
}

// cleanThinkingMarkers strips a completed <think>...</think> block and any
// stray channel markers from text, matching Python's
// clean_thinking_markers(). Used to sanitize assistant history before it is
// replayed back to a model as context.
func cleanThinkingMarkers(text string) string {
	text = thinkBlockRe.ReplaceAllString(text, "")
	for _, marker := range rawChannelMarkers {
		text = strings.ReplaceAll(text, marker, "")
	}
	return strings.TrimSpace(text)
}

var thinkBlockRe = regexp.MustCompile(`(?s)<think>.*?</think>`)

var rawChannelMarkers = []string{
	"<|channel>thought",
	"<|channel>text",
	"<channel|>",
	"<|thought|>",
	"<|text|>",
	"<|channel|>text",
}
