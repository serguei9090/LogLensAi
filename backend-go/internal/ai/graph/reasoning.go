package graph

import (
	"regexp"
	"strings"
)

// ThinkOpen/ThinkClose are the canonical normalised-thinking wrapper tags,
// mirroring thinking_parser.py's THINK_OPEN/THINK_CLOSE constants.
const (
	ThinkOpen  = "<think>"
	ThinkClose = "</think>"
)

// Gemma-style inline channel-switching markers, mirroring
// thinking_parser.py's marker constants.
const (
	channelThoughtStart = "<|channel>thought"
	channelTextStart    = "<|channel>text"
	channelThoughtEnd   = "<channel|>"
	altThoughtStart     = "<|thought|>"
	altTextStart        = "<|text|>"
	altChannelText      = "<|channel|>text"
)

// allTextMarkers/allThoughtMarkers mirror thinking_parser.py's
// ALL_TEXT_MARKERS / ALL_THOUGHT_MARKERS tuples (checked in this order --
// order does not affect correctness here since callers scan for the
// earliest match across the whole slice, matching Python).
var allTextMarkers = []string{channelTextStart, altTextStart, altChannelText, channelThoughtEnd}
var allThoughtMarkers = []string{channelThoughtStart, altThoughtStart}

// allRawMarkers mirrors thinking_parser.py's _ALL_RAW_MARKERS -- every
// marker stripped by clean_thinking_markers.
var allRawMarkers = []string{channelThoughtStart, channelTextStart, channelThoughtEnd, altThoughtStart, altTextStart, altChannelText}

var (
	reasoningBlockRe = regexp.MustCompile(`(?s)\[reasoning\]\s*(.*?)\s*\[/reasoning\]`)
	thoughtTagRe     = regexp.MustCompile(`(?s)<thought>\s*(.*?)\s*</thought>`)
	thinkTagRe       = regexp.MustCompile(`(?s)<think>(.*?)</think>`)
)

// ParseReasoningBlocks normalises any raw thinking markers in text into
// <think>...</think> form, porting sidecar/src/ai/reasoning.py's
// parse_reasoning_blocks. Handles, in order:
//  1. Already-normalised text (contains both <think> and </think>) --
//     returned unchanged.
//  2. [reasoning]...[/reasoning] blocks.
//  3. <thought>...</thought> tags.
//  4. Gemma-style inline channel-switching markers, via
//     parseChannelMarkerResponse.
func ParseReasoningBlocks(text string) string {
	if strings.Contains(text, ThinkOpen) && strings.Contains(text, ThinkClose) {
		return text
	}

	text = reasoningBlockRe.ReplaceAllString(text, ThinkOpen+"$1"+ThinkClose)
	text = thoughtTagRe.ReplaceAllString(text, ThinkOpen+"$1"+ThinkClose)

	if containsAnyMarker(text, allThoughtMarkers) {
		return parseChannelMarkerResponse(text)
	}

	return strings.TrimSpace(text)
}

// ExtractThinkingContent extracts the thinking block and final answer from
// a normalised <think>...</think> string, porting
// sidecar/src/ai/reasoning.py's extract_thinking_content. hasThinking is
// false when no <think> block was found, matching Python's `thinking is
// None` sentinel.
func ExtractThinkingContent(content string) (thinking string, hasThinking bool, answer string) {
	loc := thinkTagRe.FindStringSubmatchIndex(content)
	if loc == nil {
		return "", false, strings.TrimSpace(content)
	}
	full := content[loc[0]:loc[1]]
	inner := content[loc[2]:loc[3]]
	thinking = strings.TrimSpace(inner)
	answer = strings.TrimSpace(strings.Replace(content, full, "", 1))
	return thinking, true, answer
}

// parseChannelMarkerResponse converts a fully-accumulated Gemma
// channel-marker response into <think>...</think>+answer form, porting
// thinking_parser.py's parse_completed_response(raw, CHANNEL_MARKERS) +
// _parse_channel_marker_response.
func parseChannelMarkerResponse(raw string) string {
	if strings.Contains(raw, ThinkOpen) && strings.Contains(raw, ThinkClose) {
		return raw
	}

	thoughtIdx, thoughtMarker := earliestMarker(raw, 0, allThoughtMarkers)
	if thoughtIdx == -1 {
		return cleanThinkingMarkers(raw)
	}

	searchFrom := thoughtIdx + len(thoughtMarker)
	textIdx, textMarker := earliestMarker(raw, searchFrom, allTextMarkers)

	if textIdx != -1 {
		thinking := cleanThinkingMarkers(raw[thoughtIdx+len(thoughtMarker) : textIdx])
		response := cleanThinkingMarkers(raw[textIdx+len(textMarker):])
		return ThinkOpen + thinking + ThinkClose + response
	}

	thinking := cleanThinkingMarkers(raw[thoughtIdx+len(thoughtMarker):])
	return ThinkOpen + thinking + ThinkClose
}

// cleanThinkingMarkers strips <think>...</think> blocks and any raw channel
// markers from text, porting thinking_parser.py's clean_thinking_markers.
func cleanThinkingMarkers(text string) string {
	text = thinkTagRe.ReplaceAllString(text, "")
	for _, m := range allRawMarkers {
		text = strings.ReplaceAll(text, m, "")
	}
	return strings.TrimSpace(text)
}

// earliestMarker returns the index (relative to s, at or after from) and
// text of whichever marker in markers occurs earliest in s, or (-1, "") if
// none are found -- mirroring the repeated
// "find earliest marker across a small fixed set" loops in
// thinking_parser.py's _parse_channel_marker_response.
func earliestMarker(s string, from int, markers []string) (int, string) {
	if from > len(s) {
		return -1, ""
	}
	best := -1
	bestMarker := ""
	for _, m := range markers {
		idx := strings.Index(s[from:], m)
		if idx == -1 {
			continue
		}
		abs := idx + from
		if best == -1 || abs < best {
			best = abs
			bestMarker = m
		}
	}
	return best, bestMarker
}

func containsAnyMarker(s string, markers []string) bool {
	for _, m := range markers {
		if strings.Contains(s, m) {
			return true
		}
	}
	return false
}
