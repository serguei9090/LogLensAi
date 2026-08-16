package rag

import "testing"

// findTestTokenizerPath locates the real nomic-embed-text-v1.5 tokenizer.json
// via the same resolution this package uses at runtime (env override, then
// the Hugging Face cache). Tests that need it call t.Skip if it can't be
// found, rather than failing the whole suite in environments where the
// model hasn't been downloaded (e.g. a clean CI box with no network and no
// pre-seeded HF cache).
func findTestTokenizerPath(t *testing.T) string {
	t.Helper()
	_, tokenizerPath, err := resolveModelFiles(t.TempDir())
	if err != nil {
		t.Skipf("nomic-embed-text-v1.5 tokenizer.json not available (%v) -- skipping", err)
	}
	return tokenizerPath
}

// newTestEmbedder builds a real Embedder against the same on-disk
// dependencies (onnxruntime shared library + ONNX model + tokenizer) the
// production code resolves, skipping the test if any of them aren't
// present in this environment.
func newTestEmbedder(t *testing.T) *Embedder {
	t.Helper()
	e, err := NewEmbedderFromEnv(t.TempDir())
	if err != nil {
		t.Skipf("embedding backend not available in this environment (%v) -- skipping", err)
	}
	t.Cleanup(func() { _ = e.Close() })
	return e
}
