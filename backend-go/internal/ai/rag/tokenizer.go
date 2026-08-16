// Package rag implements the Go replacement for sidecar/src/services/rag_service.py:
// a semantic long-term memory store (issue signature -> resolution) backed by
// DuckDB's VSS extension instead of LanceDB, with embeddings produced by the
// same nomic-ai/nomic-embed-text-v1.5 ONNX model Python uses (see embed.go's
// doc comment for why the ONNX route was chosen over pure-Go alternatives).
//
// This file is a from-scratch, pure-Go port of the BERT/WordPiece tokenizer
// that Python's `tokenizers.Tokenizer.from_file(tokenizer.json)` implements in
// Rust. nomic-embed-text-v1.5 uses the stock bert-base-uncased tokenizer
// (confirmed by reading its tokenizer.json: model.type == "WordPiece", 30522
// vocab entries, BertNormalizer{lowercase:true, clean_text:true,
// handle_chinese_chars:true, strip_accents:null}, BertPreTokenizer, and a
// TemplateProcessing post-processor that wraps a single sequence in
// [CLS] ... [SEP]). Reimplementing this in pure Go (rather than reaching for
// a cgo tokenizers binding) keeps the tokenizer dependency-free; the only
// non-trivial subtlety is that HF's BertNormalizer strips accents whenever
// lowercase=true even though the JSON's strip_accents field is literally
// null -- confirmed empirically against the real Python `tokenizers` library
// (see the cross-validation test in tokenizer_test.go), not just by reading
// docs.
package rag

import (
	"encoding/json"
	"os"
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

// Special token ids, fixed by the bert-base-uncased vocabulary that
// nomic-embed-text-v1.5 reuses (confirmed against the real tokenizer.json:
// [PAD]=0, [UNK]=100, [CLS]=101, [SEP]=102, [MASK]=103).
const (
	padTokenID = 0
	unkTokenID = 100
	clsTokenID = 101
	sepTokenID = 102
)

const (
	unkToken                = "[UNK]"
	continuingSubwordPrefix = "##"
	maxInputCharsPerWord    = 100
)

// Tokenizer is a minimal pure-Go reimplementation of the WordPiece tokenizer
// described by a HuggingFace `tokenizers` tokenizer.json file, scoped to
// exactly the configuration nomic-embed-text-v1.5 ships (BertNormalizer +
// BertPreTokenizer + WordPiece model + single-sequence [CLS]/[SEP] wrapping).
// It is not a general tokenizer.json interpreter.
type Tokenizer struct {
	vocab map[string]int64
}

// tokenizerJSON captures only the fields of tokenizer.json this package
// relies on; everything else (normalizer/pre_tokenizer/post_processor
// configuration) is asserted by convention rather than parsed, since
// nomic-embed-text-v1.5's tokenizer.json is known (and tested) to match the
// stock bert-base-uncased configuration this file hand-implements.
type tokenizerJSON struct {
	Model struct {
		Type  string           `json:"type"`
		Vocab map[string]int64 `json:"vocab"`
	} `json:"model"`
}

// LoadTokenizer reads and parses a HuggingFace tokenizer.json file.
func LoadTokenizer(path string) (*Tokenizer, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var parsed tokenizerJSON
	if err := json.Unmarshal(data, &parsed); err != nil {
		return nil, err
	}
	return &Tokenizer{vocab: parsed.Model.Vocab}, nil
}

// Encode tokenizes text into the input_ids sequence a NomicBert ONNX session
// expects: [CLS] <wordpiece ids...> [SEP]. There is no truncation (Python's
// rag_service.py doesn't truncate either), so callers embedding very long
// strings are responsible for any length limits.
func (t *Tokenizer) Encode(text string) []int64 {
	pretokens := preTokenize(normalizeText(text))

	ids := make([]int64, 0, len(pretokens)+2)
	ids = append(ids, clsTokenID)
	for _, pt := range pretokens {
		ids = append(ids, t.wordpiece(pt)...)
	}
	ids = append(ids, sepTokenID)
	return ids
}

// wordpiece implements the greedy longest-match-first WordPiece algorithm
// (google-research/bert's tokenization.WordpieceTokenizer, mirrored by HF's
// Rust `tokenizers` WordPiece model): repeatedly take the longest vocabulary
// entry (prefixed with "##" once we're past the first piece) that matches a
// prefix of the remaining runes; if no entry matches at some position, the
// *whole word* becomes a single [UNK], not just the unmatched piece.
func (t *Tokenizer) wordpiece(word string) []int64 {
	runes := []rune(word)
	if len(runes) == 0 {
		return nil
	}
	if len(runes) > maxInputCharsPerWord {
		return []int64{unkTokenID}
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
			return []int64{unkTokenID}
		}
		out = append(out, matchedID)
		start = end
	}
	return out
}

// normalizeText ports HF's BertNormalizer: strip/replace control and
// whitespace characters, pad CJK characters with spaces so they tokenize as
// individual characters, lowercase, and strip accents (NFD-decompose then
// drop combining marks).
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

// stripAccents NFD-decomposes the string and drops nonspacing marks (Unicode
// category Mn), matching transformers.BasicTokenizer._run_strip_accents.
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

// preTokenize ports HF's BertPreTokenizer: split on whitespace, then split
// again around every punctuation rune, with each punctuation rune becoming
// its own token.
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

// isControl mirrors transformers._is_control: \t/\n/\r are treated as
// whitespace (handled separately), not control characters, even though
// unicode.IsControl would also match them.
func isControl(r rune) bool {
	switch r {
	case '\t', '\n', '\r':
		return false
	}
	return unicode.IsControl(r)
}

// isPunctuation mirrors transformers._is_punctuation: the ASCII punctuation
// ranges that Unicode oddly classifies outside category P (e.g. '$', '+',
// '<'), unioned with anything in Unicode general category P.
func isPunctuation(r rune) bool {
	if (r >= 33 && r <= 47) || (r >= 58 && r <= 64) || (r >= 91 && r <= 96) || (r >= 123 && r <= 126) {
		return true
	}
	return unicode.IsPunct(r)
}

// isChineseChar mirrors transformers._is_chinese_char's CJK block ranges.
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
