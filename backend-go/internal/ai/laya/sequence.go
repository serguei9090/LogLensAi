// Assume Role: The Backend Engineer (@backend)

package laya

import (
	"fmt"
	"strconv"
	"strings"
)

// LayaSequence holds the tokenized and formatted inputs required for Laya ModernBERT inference.
type LayaSequence struct {
	InputIDs      []int64      `json:"input_ids"`      // Full token sequence with special tokens
	AttentionMask []int64      `json:"attention_mask"` // All 1s, same length as InputIDs
	MaskIndices   []int64      `json:"mask_indices"`   // Exact indices of [MASK] tokens corresponding to each option
	OptionLabels  []string     `json:"option_labels"`  // String label for each mask position
	QuestionType  QuestionType `json:"question_type"`  // Type of question being evaluated
}

// SequenceBuilder builds formatted LayaSequence for inference.
type SequenceBuilder struct {
	tokenizer *Tokenizer // Dedicated tokenizer instance
	clsID     int64
	sepID     int64
	maskID    int64
	padID     int64
	maxLen    int
}

// NewSequenceBuilder constructs a SequenceBuilder with standard ModernBERT token IDs and length limits.
func NewSequenceBuilder(tokenizer *Tokenizer, maxLen int) *SequenceBuilder {
	if maxLen <= 0 {
		maxLen = 8192 // Default ModernBERT native context window
	}
	return &SequenceBuilder{
		tokenizer: tokenizer,
		clsID:     ClsTokenID,
		sepID:     SepTokenID,
		maskID:    MaskTokenID,
		padID:     PadTokenID,
		maxLen:    maxLen,
	}
}

// SetSpecialTokens overrides special token IDs if needed for non-standard vocabularies.
func (b *SequenceBuilder) SetSpecialTokens(clsID, sepID, maskID, padID int64) {
	b.clsID = clsID
	b.sepID = sepID
	b.maskID = maskID
	b.padID = padID
}

// MaxLen returns the configured maximum sequence length.
func (b *SequenceBuilder) MaxLen() int {
	return b.maxLen
}

// ClsID returns the [CLS] token ID.
func (b *SequenceBuilder) ClsID() int64 {
	return b.clsID
}

// SepID returns the [SEP] token ID.
func (b *SequenceBuilder) SepID() int64 {
	return b.sepID
}

// MaskID returns the [MASK] token ID.
func (b *SequenceBuilder) MaskID() int64 {
	return b.maskID
}

// PadID returns the [PAD] token ID.
func (b *SequenceBuilder) PadID() int64 {
	return b.padID
}

// BuildSequence constructs a formatted LayaSequence following the official ModernBERT specification:
// [CLS] <type> question: <instructions> [SEP] [MASK] opt0 [MASK] opt1 ... [SEP] <state> [SEP]
func (b *SequenceBuilder) BuildSequence(q Question, stateText string) (*LayaSequence, error) {
	if b.tokenizer == nil {
		return nil, fmt.Errorf("tokenizer cannot be nil")
	}

	instructions := strings.TrimSpace(q.Instructions)
	if instructions == "" {
		return nil, fmt.Errorf("question instructions cannot be empty")
	}

	var options []string
	switch q.Type {
	case QuestionTypeChoice:
		if len(q.Options) == 0 {
			return nil, fmt.Errorf("question of type %q requires non-empty options", q.Type)
		}
		options = make([]string, len(q.Options))
		copy(options, q.Options)
	case QuestionTypeScore:
		if len(q.Rubric) == 0 {
			return nil, fmt.Errorf("question of type %q requires non-empty rubric", q.Type)
		}
		options = make([]string, len(q.Rubric))
		for i, val := range q.Rubric {
			options[i] = strconv.Itoa(val)
		}
	case QuestionTypeNoul:
		options = []string{"true", "false"}
	default:
		return nil, fmt.Errorf("invalid or unsupported question type %q", q.Type)
	}

	// Segment 1: [CLS] <type> question: <instructions> [SEP]
	headerText := fmt.Sprintf("%s question: %s", q.Type, instructions)
	headerTokens := b.tokenizer.Tokenize(headerText)

	inputIDs := make([]int64, 0, len(headerTokens)+len(options)*4+32)
	inputIDs = append(inputIDs, b.clsID)
	inputIDs = append(inputIDs, headerTokens...)
	inputIDs = append(inputIDs, b.sepID)

	// Segment 2: [MASK] opt0 [MASK] opt1 ... [SEP]
	maskIndices := make([]int64, 0, len(options))
	optionLabels := make([]string, len(options))

	for i, opt := range options {
		optionLabels[i] = opt
		maskIndex := int64(len(inputIDs))
		maskIndices = append(maskIndices, maskIndex)
		inputIDs = append(inputIDs, b.maskID)

		optTokens := b.tokenizer.Tokenize(opt)
		inputIDs = append(inputIDs, optTokens...)
	}
	inputIDs = append(inputIDs, b.sepID)

	// Segment 3: <state> [SEP] with maxLen truncation
	stateTokens := b.tokenizer.Tokenize(stateText)

	if b.maxLen > 0 {
		availableForState := b.maxLen - 1 - len(inputIDs)
		if availableForState < 0 {
			return nil, fmt.Errorf("prompt header and options exceed maximum sequence length (%d > %d)", len(inputIDs)+1, b.maxLen)
		}
		if len(stateTokens) > availableForState {
			stateTokens = stateTokens[:availableForState]
		}
	}

	inputIDs = append(inputIDs, stateTokens...)
	inputIDs = append(inputIDs, b.sepID)

	// Generate attention mask (all 1s)
	attentionMask := make([]int64, len(inputIDs))
	for i := range attentionMask {
		attentionMask[i] = 1
	}

	return &LayaSequence{
		InputIDs:      inputIDs,
		AttentionMask: attentionMask,
		MaskIndices:   maskIndices,
		OptionLabels:  optionLabels,
		QuestionType:  q.Type,
	}, nil
}
