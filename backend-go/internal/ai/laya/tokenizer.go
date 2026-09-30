// Assume Role: The Backend Engineer (@backend)

package laya

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

// Special token IDs fixed by standard BERT / ModernBERT vocabularies.
const (
	PadTokenID  int64 = 0
	UnkTokenID  int64 = 100
	ClsTokenID  int64 = 101
	SepTokenID  int64 = 102
	MaskTokenID int64 = 103
)

const (
	unkToken                = "[UNK]"
	continuingSubwordPrefix = "##"
	maxInputCharsPerWord    = 100
)

// Tokenizer is a pure-Go WordPiece tokenizer compatible with ModernBERT and BERT vocabulary tables.
type Tokenizer struct {
	vocab map[string]int64
}

type tokenizerJSON struct {
	Model struct {
		Type  string           `json:"type"`
		Vocab map[string]int64 `json:"vocab"`
	} `json:"model"`
}

// NewTokenizer creates a Tokenizer instance directly from an in-memory vocabulary map.
func NewTokenizer(vocab map[string]int64) *Tokenizer {
	copied := make(map[string]int64, len(vocab))
	for k, v := range vocab {
		copied[k] = v
	}
	return &Tokenizer{vocab: copied}
}

// LoadTokenizer reads and parses a HuggingFace tokenizer.json file.
func LoadTokenizer(path string) (*Tokenizer, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading tokenizer file %s: %w", path, err)
	}
	var parsed tokenizerJSON
	if err := json.Unmarshal(data, &parsed); err != nil {
		return nil, fmt.Errorf("parsing tokenizer json %s: %w", path, err)
	}
	if parsed.Model.Vocab == nil {
		return nil, fmt.Errorf("tokenizer file %s contains no model.vocab", path)
	}
	return &Tokenizer{vocab: parsed.Model.Vocab}, nil
}

// Tokenize segments text into subwords and returns their vocabulary IDs without special tokens.
func (t *Tokenizer) Tokenize(text string) []int64 {
	if t == nil || len(t.vocab) == 0 {
		return nil
	}
	pretokens := preTokenize(normalizeText(text))
	var ids []int64
	for _, pt := range pretokens {
		ids = append(ids, t.wordpiece(pt)...)
	}
	return ids
}

// Encode tokenizes text and wraps it with [CLS] and [SEP] special tokens.
func (t *Tokenizer) Encode(text string) []int64 {
	subwords := t.Tokenize(text)
	ids := make([]int64, 0, len(subwords)+2)
	ids = append(ids, ClsTokenID)
	ids = append(ids, subwords...)
	ids = append(ids, SepTokenID)
	return ids
}

// Vocab returns a copy of the underlying vocabulary mapping.
func (t *Tokenizer) Vocab() map[string]int64 {
	if t == nil {
		return nil
	}
	out := make(map[string]int64, len(t.vocab))
	for k, v := range t.vocab {
		out[k] = v
	}
	return out
}

// wordpiece implements greedy longest-match-first WordPiece tokenization.
func (t *Tokenizer) wordpiece(word string) []int64 {
	runes := []rune(word)
	if len(runes) == 0 {
		return nil
	}
	if len(runes) > maxInputCharsPerWord {
		return []int64{UnkTokenID}
	}

	var out []int64
	start := 0
	for start < len(runes) {
		end := len(runes)
		var matchedID int64 = -1
		for start < end {
			substr := string(runes[start:end])
			if start > 0 {
				substr = continuingSubwordPrefix + substr
			}
			if id, ok := t.vocab[substr]; ok {
				matchedID = id
				break
			}
			end--
		}
		if matchedID == -1 {
			return []int64{UnkTokenID}
		}
		out = append(out, matchedID)
		start = end
	}
	return out
}

func normalizeText(text string) string {
	text = cleanText(text)
	text = padChineseChars(text)
	text = strings.ToLower(text)
	text = stripAccents(text)
	return text
}

func cleanText(text string) string {
	var b strings.Builder
	b.Grow(len(text))
	for _, r := range text {
		if r == 0 || r == 0xFFFD || isControl(r) {
			continue
		}
		if isWhitespace(r) {
			b.WriteRune(' ')
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

func padChineseChars(text string) string {
	var b strings.Builder
	b.Grow(len(text) + 8)
	for _, r := range text {
		if isChineseChar(r) {
			b.WriteRune(' ')
			b.WriteRune(r)
			b.WriteRune(' ')
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

func stripAccents(text string) string {
	decomposed := norm.NFD.String(text)
	var b strings.Builder
	b.Grow(len(decomposed))
	for _, r := range decomposed {
		if unicode.Is(unicode.Mn, r) {
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

func preTokenize(text string) []string {
	var out []string
	var buf strings.Builder
	flush := func() {
		if buf.Len() > 0 {
			out = append(out, buf.String())
			buf.Reset()
		}
	}
	for _, field := range strings.FieldsFunc(text, isWhitespace) {
		for _, r := range field {
			if isPunctuation(r) {
				flush()
				out = append(out, string(r))
				continue
			}
			buf.WriteRune(r)
		}
		flush()
	}
	return out
}

func isWhitespace(r rune) bool {
	switch r {
	case ' ', '\t', '\n', '\r':
		return true
	}
	return unicode.Is(unicode.Zs, r)
}

func isControl(r rune) bool {
	switch r {
	case '\t', '\n', '\r':
		return false
	}
	return unicode.IsControl(r)
}

func isPunctuation(r rune) bool {
	if (r >= 33 && r <= 47) || (r >= 58 && r <= 64) || (r >= 91 && r <= 96) || (r >= 123 && r <= 126) {
		return true
	}
	return unicode.IsPunct(r)
}

func isChineseChar(r rune) bool {
	return (r >= 0x4E00 && r <= 0x9FFF) ||
		(r >= 0x3400 && r <= 0x4DBF) ||
		(r >= 0x20000 && r <= 0x2A6DF) ||
		(r >= 0x2A700 && r <= 0x2B73F) ||
		(r >= 0x2B740 && r <= 0x2B81F) ||
		(r >= 0x2B820 && r <= 0x2CEAF) ||
		(r >= 0xF900 && r <= 0xFAFF) ||
		(r >= 0x2F800 && r <= 0x2FA1F)
}
