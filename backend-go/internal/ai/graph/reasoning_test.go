package graph

import "testing"

func TestParseReasoningBlocks_AlreadyNormalised(t *testing.T) {
	in := "<think>already done</think>The answer"
	if got := ParseReasoningBlocks(in); got != in {
		t.Errorf("expected already-normalised text to pass through unchanged, got %q", got)
	}
}

func TestParseReasoningBlocks_BracketReasoningFormat(t *testing.T) {
	in := "[reasoning]\nLet me think about this.\n[/reasoning]\nThe final answer is 42."
	got := ParseReasoningBlocks(in)
	want := ThinkOpen + "Let me think about this." + ThinkClose + "\nThe final answer is 42."
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestParseReasoningBlocks_ThoughtTagFormat(t *testing.T) {
	in := "<thought>\n  pondering the problem  \n</thought>\nHere is my answer."
	got := ParseReasoningBlocks(in)
	want := ThinkOpen + "pondering the problem" + ThinkClose + "\nHere is my answer."
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestParseReasoningBlocks_GemmaChannelMarkers(t *testing.T) {
	in := "<|channel>thoughtI should check the logs first<|channel>textThe logs show an error."
	got := ParseReasoningBlocks(in)
	want := ThinkOpen + "I should check the logs first" + ThinkClose + "The logs show an error."
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestParseReasoningBlocks_GemmaChannelMarkers_AltForm(t *testing.T) {
	in := "<|thought|>reasoning here<|text|>final text"
	got := ParseReasoningBlocks(in)
	want := ThinkOpen + "reasoning here" + ThinkClose + "final text"
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestParseReasoningBlocks_ChannelMarkers_ThoughtOnly(t *testing.T) {
	// No text-transition marker yet -- still mid-thought.
	in := "<|channel>thoughtstill thinking..."
	got := ParseReasoningBlocks(in)
	want := ThinkOpen + "still thinking..." + ThinkClose
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestParseReasoningBlocks_PlainText(t *testing.T) {
	in := "  just a plain answer, no markers  "
	got := ParseReasoningBlocks(in)
	if got != "just a plain answer, no markers" {
		t.Errorf("got %q", got)
	}
}

func TestExtractThinkingContent_WithThinkBlock(t *testing.T) {
	content := ThinkOpen + "my reasoning" + ThinkClose + "the answer"
	thinking, has, answer := ExtractThinkingContent(content)
	if !has {
		t.Fatal("expected hasThinking=true")
	}
	if thinking != "my reasoning" {
		t.Errorf("thinking = %q, want %q", thinking, "my reasoning")
	}
	if answer != "the answer" {
		t.Errorf("answer = %q, want %q", answer, "the answer")
	}
}

func TestExtractThinkingContent_NoThinkBlock(t *testing.T) {
	content := "  just an answer  "
	thinking, has, answer := ExtractThinkingContent(content)
	if has {
		t.Fatal("expected hasThinking=false")
	}
	if thinking != "" {
		t.Errorf("thinking = %q, want empty", thinking)
	}
	if answer != "just an answer" {
		t.Errorf("answer = %q, want %q", answer, "just an answer")
	}
}
