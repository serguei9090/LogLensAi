package rag

import (
	"reflect"
	"testing"
)

// TestTokenizerCrossValidatesAgainstPython pins the pure-Go WordPiece
// tokenizer's output against ids captured from the *real* HuggingFace
// `tokenizers` Python library loading nomic-embed-text-v1.5's actual
// tokenizer.json (via ./.venv/Scripts/python.exe -c "... Tokenizer.from_file(...)
// ... tok.encode(text).ids"). This is the load-bearing correctness check for
// the whole embedding pipeline: if tokenization drifts from what the model
// was fed in Python, embeddings (and therefore saved-memory search quality)
// silently degrade without any test failing elsewhere.
func TestTokenizerCrossValidatesAgainstPython(t *testing.T) {
	tokenizerPath := findTestTokenizerPath(t)
	tok, err := LoadTokenizer(tokenizerPath)
	if err != nil {
		t.Fatalf("LoadTokenizer: %v", err)
	}

	cases := []struct {
		text string
		want []int64
	}{
		{
			"search_query: NullPointerException at com.example.Service.process line 42",
			[]int64{101, 3945, 1035, 23032, 1024, 19701, 8400, 7869, 2595, 24422, 2012, 4012, 1012, 2742, 1012, 2326, 1012, 2832, 2240, 4413, 102},
		},
		{
			"search_document: Connection refused: could not connect to database on port 5432",
			[]int64{101, 3945, 1035, 6254, 1024, 4434, 4188, 1024, 2071, 2025, 7532, 2000, 7809, 2006, 3417, 5139, 16703, 102},
		},
		{
			"search_query: café résumé naïve",
			[]int64{101, 3945, 1035, 23032, 1024, 7668, 13746, 15743, 102},
		},
		{
			"search_query: don't stop-believing_now 123.456",
			[]int64{101, 3945, 1035, 23032, 1024, 2123, 1005, 1056, 2644, 1011, 8929, 1035, 2085, 13138, 1012, 3429, 2575, 102},
		},
		{
			"search_document: Hello, World! This is a TEST.",
			[]int64{101, 3945, 1035, 6254, 1024, 7592, 1010, 2088, 999, 2023, 2003, 1037, 3231, 1012, 102},
		},
		{
			"search_query: multi   space\ttab\nnewline",
			[]int64{101, 3945, 1035, 23032, 1024, 4800, 2686, 21628, 2047, 4179, 102},
		},
	}

	for _, c := range cases {
		got := tok.Encode(c.text)
		if !reflect.DeepEqual(got, c.want) {
			t.Errorf("Encode(%q):\n got  %v\n want %v", c.text, got, c.want)
		}
	}
}
