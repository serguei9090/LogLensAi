// Assume Role: The Backend Engineer (@backend)

package laya

import (
	"strings"
	"testing"
)

func newSampleTokenizer() *Tokenizer {
	vocab := map[string]int64{
		"choice":     1000,
		"score":      1001,
		"noul":       1002,
		"question":   1003,
		":":          1004,
		"classify":   1005,
		"the":        1006,
		"user":       1007,
		"intent":     1008,
		"search":     1009,
		"_":          1010,
		"logs":       1011,
		"get":        1012,
		"clusters":   1013,
		"memory":     1014,
		"rate":       1015,
		"severity":   1016,
		"1":          1017,
		"2":          1018,
		"3":          1019,
		"4":          1020,
		"5":          1021,
		"true":       1022,
		"false":      1023,
		"is":         1024,
		"outage":     1025,
		"error":      1026,
		"database":   1027,
		"failed":     1028,
		"connection": 1029,
		"refused":    1030,
		"long":       1031,
		"state":      1032,
		"test":       1033,
	}
	return NewTokenizer(vocab)
}

func TestSequenceBuilder_ChoiceQuestion(t *testing.T) {
	tok := newSampleTokenizer()
	builder := NewSequenceBuilder(tok, 512)

	q := Question{
		Type:         QuestionTypeChoice,
		Instructions: "Classify the user intent into a tool.",
		Options: []string{
			"search_logs",
			"get_clusters",
			"search_memory",
		},
	}

	state := "error: database connection refused"
	seq, err := builder.BuildSequence(q, state)
	if err != nil {
		t.Fatalf("BuildSequence returned unexpected error: %v", err)
	}

	if seq.QuestionType != QuestionTypeChoice {
		t.Errorf("expected QuestionTypeChoice, got %v", seq.QuestionType)
	}

	// Verify options labels
	if len(seq.OptionLabels) != len(q.Options) {
		t.Fatalf("expected %d option labels, got %d", len(q.Options), len(seq.OptionLabels))
	}
	for i, opt := range q.Options {
		if seq.OptionLabels[i] != opt {
			t.Errorf("option label[%d]: expected %q, got %q", i, opt, seq.OptionLabels[i])
		}
	}

	// Verify MaskIndices count matches OptionLabels
	if len(seq.MaskIndices) != len(seq.OptionLabels) {
		t.Errorf("len(MaskIndices) (%d) != len(OptionLabels) (%d)", len(seq.MaskIndices), len(seq.OptionLabels))
	}

	// Verify each mask index points to MaskTokenID (103)
	for i, maskIdx := range seq.MaskIndices {
		if maskIdx < 0 || int(maskIdx) >= len(seq.InputIDs) {
			t.Fatalf("mask index %d is out of range (%d >= %d)", i, maskIdx, len(seq.InputIDs))
		}
		if seq.InputIDs[maskIdx] != builder.MaskID() {
			t.Errorf("InputIDs[maskIndices[%d]] is %d, expected %d", i, seq.InputIDs[maskIdx], builder.MaskID())
		}
	}

	// Verify start and end tokens
	if seq.InputIDs[0] != builder.ClsID() {
		t.Errorf("first token is %d, expected ClsID %d", seq.InputIDs[0], builder.ClsID())
	}
	if seq.InputIDs[len(seq.InputIDs)-1] != builder.SepID() {
		t.Errorf("last token is %d, expected SepID %d", seq.InputIDs[len(seq.InputIDs)-1], builder.SepID())
	}

	// Verify attention mask matches length and is all 1s
	if len(seq.AttentionMask) != len(seq.InputIDs) {
		t.Errorf("AttentionMask length (%d) != InputIDs length (%d)", len(seq.AttentionMask), len(seq.InputIDs))
	}
	for i, val := range seq.AttentionMask {
		if val != 1 {
			t.Errorf("AttentionMask[%d] = %d, expected 1", i, val)
		}
	}
}

func TestSequenceBuilder_ScoreQuestion(t *testing.T) {
	tok := newSampleTokenizer()
	builder := NewSequenceBuilder(tok, 512)

	q := Question{
		Type:         QuestionTypeScore,
		Instructions: "Rate the operational impact and severity.",
		Rubric:       []int{1, 2, 3, 4, 5},
	}

	state := "database connection failed"
	seq, err := builder.BuildSequence(q, state)
	if err != nil {
		t.Fatalf("BuildSequence returned unexpected error: %v", err)
	}

	if seq.QuestionType != QuestionTypeScore {
		t.Errorf("expected QuestionTypeScore, got %v", seq.QuestionType)
	}

	expectedLabels := []string{"1", "2", "3", "4", "5"}
	if len(seq.OptionLabels) != len(expectedLabels) {
		t.Fatalf("expected %d option labels, got %d", len(expectedLabels), len(seq.OptionLabels))
	}
	for i, exp := range expectedLabels {
		if seq.OptionLabels[i] != exp {
			t.Errorf("OptionLabels[%d] = %q, expected %q", i, seq.OptionLabels[i], exp)
		}
	}

	if len(seq.MaskIndices) != 5 {
		t.Fatalf("expected 5 mask indices, got %d", len(seq.MaskIndices))
	}

	for i, idx := range seq.MaskIndices {
		if seq.InputIDs[idx] != builder.MaskID() {
			t.Errorf("InputIDs[%d] at mask index %d is %d, expected MaskID %d", idx, i, seq.InputIDs[idx], builder.MaskID())
		}
	}
}

func TestSequenceBuilder_NoulQuestion(t *testing.T) {
	tok := newSampleTokenizer()
	builder := NewSequenceBuilder(tok, 512)

	q := Question{
		Type:         QuestionTypeNoul,
		Instructions: "Does this log message indicate an active customer-facing outage?",
	}

	state := "server response timeout on port 80"
	seq, err := builder.BuildSequence(q, state)
	if err != nil {
		t.Fatalf("BuildSequence returned unexpected error: %v", err)
	}

	if seq.QuestionType != QuestionTypeNoul {
		t.Errorf("expected QuestionTypeNoul, got %v", seq.QuestionType)
	}

	expectedLabels := []string{"true", "false"}
	if len(seq.OptionLabels) != len(expectedLabels) {
		t.Fatalf("expected %d option labels, got %d", len(expectedLabels), len(seq.OptionLabels))
	}
	for i, exp := range expectedLabels {
		if seq.OptionLabels[i] != exp {
			t.Errorf("OptionLabels[%d] = %q, expected %q", i, seq.OptionLabels[i], exp)
		}
	}

	if len(seq.MaskIndices) != 2 {
		t.Fatalf("expected 2 mask indices, got %d", len(seq.MaskIndices))
	}

	for i, idx := range seq.MaskIndices {
		if seq.InputIDs[idx] != builder.MaskID() {
			t.Errorf("InputIDs[%d] at mask index %d is %d, expected MaskID %d", idx, i, seq.InputIDs[idx], builder.MaskID())
		}
	}
}

func TestSequenceBuilder_MaskTokensMonotonicAndUnique(t *testing.T) {
	tok := newSampleTokenizer()
	builder := NewSequenceBuilder(tok, 512)

	q := Question{
		Type:         QuestionTypeChoice,
		Instructions: "Classify subsystem category",
		Options:      []string{"database", "network", "auth", "application"},
	}

	seq, err := builder.BuildSequence(q, "error in auth token")
	if err != nil {
		t.Fatalf("BuildSequence failed: %v", err)
	}

	// Verify mask indices are strictly increasing
	for i := 1; i < len(seq.MaskIndices); i++ {
		if seq.MaskIndices[i] <= seq.MaskIndices[i-1] {
			t.Errorf("MaskIndices not strictly increasing: idx[%d]=%d <= idx[%d]=%d",
				i, seq.MaskIndices[i], i-1, seq.MaskIndices[i-1])
		}
	}

	// Verify each mask index is followed by the option's tokens
	for i, maskIdx := range seq.MaskIndices {
		if seq.InputIDs[maskIdx] != builder.MaskID() {
			t.Errorf("at maskIndex %d: expected maskID %d, got %d", maskIdx, builder.MaskID(), seq.InputIDs[maskIdx])
		}
		// Token immediately after mask should be the start of option
		if int(maskIdx)+1 < len(seq.InputIDs) {
			nextTok := seq.InputIDs[maskIdx+1]
			optTokens := tok.Tokenize(seq.OptionLabels[i])
			if len(optTokens) > 0 && nextTok != optTokens[0] {
				t.Errorf("option %q first token expected %d, got %d", seq.OptionLabels[i], optTokens[0], nextTok)
			}
		}
	}
}

func TestSequenceBuilder_Truncation(t *testing.T) {
	tok := newSampleTokenizer()
	maxLen := 25
	builder := NewSequenceBuilder(tok, maxLen)

	q := Question{
		Type:         QuestionTypeChoice,
		Instructions: "Classify intent",
		Options:      []string{"search_logs", "get_clusters"},
	}

	// Create very long state text that will exceed maxLen
	longState := strings.Repeat("database connection refused error ", 50)

	seq, err := builder.BuildSequence(q, longState)
	if err != nil {
		t.Fatalf("BuildSequence failed on long text: %v", err)
	}

	if len(seq.InputIDs) != maxLen {
		t.Errorf("expected sequence length to be exactly %d, got %d", maxLen, len(seq.InputIDs))
	}

	if len(seq.AttentionMask) != maxLen {
		t.Errorf("expected attention mask length %d, got %d", maxLen, len(seq.AttentionMask))
	}

	// Ensure final token is [SEP]
	if seq.InputIDs[len(seq.InputIDs)-1] != builder.SepID() {
		t.Errorf("final token is %d, expected SepID %d", seq.InputIDs[len(seq.InputIDs)-1], builder.SepID())
	}

	// Ensure all mask indices are intact and within bounds
	if len(seq.MaskIndices) != len(q.Options) {
		t.Errorf("expected %d mask indices, got %d", len(q.Options), len(seq.MaskIndices))
	}
	for _, idx := range seq.MaskIndices {
		if int(idx) >= maxLen {
			t.Errorf("mask index %d is outside sequence length %d", idx, maxLen)
		}
		if seq.InputIDs[idx] != builder.MaskID() {
			t.Errorf("InputIDs[%d] is %d, expected mask token %d", idx, seq.InputIDs[idx], builder.MaskID())
		}
	}
}

func TestSequenceBuilder_PrefixExceedsMaxLen(t *testing.T) {
	tok := newSampleTokenizer()
	// Set maxLen ridiculously small so Segment 1 + Segment 2 cannot fit
	builder := NewSequenceBuilder(tok, 5)

	q := Question{
		Type:         QuestionTypeChoice,
		Instructions: "Very long instructions that definitely take more than five tokens",
		Options:      []string{"option1", "option2"},
	}

	_, err := builder.BuildSequence(q, "state")
	if err == nil {
		t.Errorf("expected error when prefix exceeds maxLen, got nil")
	}
}

func TestSequenceBuilder_Validation(t *testing.T) {
	tok := newSampleTokenizer()
	builder := NewSequenceBuilder(tok, 512)

	tests := []struct {
		name      string
		question  Question
		state     string
		wantError string
	}{
		{
			name: "empty instructions",
			question: Question{
				Type:         QuestionTypeChoice,
				Instructions: "   ",
				Options:      []string{"opt1"},
			},
			state:     "some log",
			wantError: "instructions cannot be empty",
		},
		{
			name: "empty options in choice",
			question: Question{
				Type:         QuestionTypeChoice,
				Instructions: "Valid instructions",
				Options:      []string{},
			},
			state:     "some log",
			wantError: "requires non-empty options",
		},
		{
			name: "empty rubric in score",
			question: Question{
				Type:         QuestionTypeScore,
				Instructions: "Valid instructions",
				Rubric:       []int{},
			},
			state:     "some log",
			wantError: "requires non-empty rubric",
		},
		{
			name: "unsupported question type",
			question: Question{
				Type:         QuestionType("unknown_type"),
				Instructions: "Valid instructions",
			},
			state:     "some log",
			wantError: "unsupported question type",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := builder.BuildSequence(tc.question, tc.state)
			if err == nil {
				t.Fatalf("expected error containing %q, got nil", tc.wantError)
			}
			if !strings.Contains(err.Error(), tc.wantError) {
				t.Errorf("expected error containing %q, got %q", tc.wantError, err.Error())
			}
		})
	}

	// Test nil tokenizer
	nilBuilder := NewSequenceBuilder(nil, 512)
	_, err := nilBuilder.BuildSequence(Question{
		Type:         QuestionTypeNoul,
		Instructions: "Valid instructions",
	}, "state")
	if err == nil || !strings.Contains(err.Error(), "tokenizer cannot be nil") {
		t.Errorf("expected nil tokenizer error, got %v", err)
	}
}

func TestSequenceBuilder_DefaultBaselineQuestions(t *testing.T) {
	tok := newSampleTokenizer()
	builder := NewSequenceBuilder(tok, 1024)

	baseline := DefaultBaselineQuestions()
	state := "2026-09-30T12:00:00Z ERROR database connection refused on port 5432"

	for name, q := range baseline {
		t.Run("baseline_"+name, func(t *testing.T) {
			seq, err := builder.BuildSequence(q, state)
			if err != nil {
				t.Fatalf("failed to build sequence for baseline %q: %v", name, err)
			}
			if seq.QuestionType != q.Type {
				t.Errorf("expected question type %q, got %q", q.Type, seq.QuestionType)
			}
			if len(seq.MaskIndices) != len(seq.OptionLabels) {
				t.Errorf("len(MaskIndices)=%d != len(OptionLabels)=%d", len(seq.MaskIndices), len(seq.OptionLabels))
			}
			for i, maskIdx := range seq.MaskIndices {
				if seq.InputIDs[maskIdx] != builder.MaskID() {
					t.Errorf("mask token at index %d is %d, expected %d", maskIdx, seq.InputIDs[maskIdx], builder.MaskID())
				}
				_ = i
			}
		})
	}
}

func TestSequenceBuilder_SpecialTokenSetters(t *testing.T) {
	tok := newSampleTokenizer()
	builder := NewSequenceBuilder(tok, 0) // Test default maxLen fallback

	if builder.MaxLen() != 8192 {
		t.Errorf("expected default maxLen 8192, got %d", builder.MaxLen())
	}

	builder.SetSpecialTokens(201, 202, 203, 200)
	if builder.ClsID() != 201 || builder.SepID() != 202 || builder.MaskID() != 203 || builder.PadID() != 200 {
		t.Errorf("SetSpecialTokens failed to update IDs")
	}

	q := Question{
		Type:         QuestionTypeNoul,
		Instructions: "Check outage",
	}

	seq, err := builder.BuildSequence(q, "log")
	if err != nil {
		t.Fatalf("BuildSequence failed: %v", err)
	}

	if seq.InputIDs[0] != 201 {
		t.Errorf("expected custom ClsID 201, got %d", seq.InputIDs[0])
	}
	if seq.InputIDs[len(seq.InputIDs)-1] != 202 {
		t.Errorf("expected custom SepID 202, got %d", seq.InputIDs[len(seq.InputIDs)-1])
	}
	for _, idx := range seq.MaskIndices {
		if seq.InputIDs[idx] != 203 {
			t.Errorf("expected custom MaskID 203, got %d", seq.InputIDs[idx])
		}
	}
}

func TestTokenizer_WordPieceBasic(t *testing.T) {
	tok := newSampleTokenizer()

	// Test Tokenize
	tokens := tok.Tokenize("database connection")
	if len(tokens) != 2 || tokens[0] != 1027 || tokens[1] != 1029 {
		t.Errorf("expected [1027, 1029], got %v", tokens)
	}

	// Test Encode
	enc := tok.Encode("database connection")
	if len(enc) != 4 || enc[0] != ClsTokenID || enc[1] != 1027 || enc[2] != 1029 || enc[3] != SepTokenID {
		t.Errorf("expected [101, 1027, 1029, 102], got %v", enc)
	}

	// Test unknown word
	unkTokens := tok.Tokenize("unknownwordxyz")
	if len(unkTokens) != 1 || unkTokens[0] != UnkTokenID {
		t.Errorf("expected [100], got %v", unkTokens)
	}

	// Test empty text
	emptyTokens := tok.Tokenize("")
	if len(emptyTokens) != 0 {
		t.Errorf("expected empty tokens, got %v", emptyTokens)
	}

	// Test Vocab copy
	v := tok.Vocab()
	if v["database"] != 1027 {
		t.Errorf("vocab copy missing expected entry")
	}
}
