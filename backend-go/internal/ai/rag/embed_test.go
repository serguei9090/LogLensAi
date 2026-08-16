package rag

import (
	"context"
	"math"
	"testing"
)

// cosineSimilarity assumes both vectors are already L2-normalized (which
// Embed guarantees), so this is just the dot product.
func cosineSimilarity(a, b []float32) float64 {
	var dot float64
	for i := range a {
		dot += float64(a[i]) * float64(b[i])
	}
	return dot
}

func vectorNorm(v []float32) float64 {
	var sumSq float64
	for _, f := range v {
		sumSq += float64(f) * float64(f)
	}
	return math.Sqrt(sumSq)
}

// TestEmbedProducesNormalizedVectors checks the mechanical properties Embed
// promises regardless of semantic content: correct dimensionality and unit
// L2 norm (rag_service.py's `_embed` explicitly normalizes -- see its
// `normalized = pooled / norm` step).
func TestEmbedProducesNormalizedVectors(t *testing.T) {
	e := newTestEmbedder(t)

	v, err := e.Embed(context.Background(), "disk usage at 95% on /var partition", false)
	if err != nil {
		t.Fatalf("Embed: %v", err)
	}
	if len(v) != EmbeddingDim {
		t.Fatalf("got %d-dim vector, want %d", len(v), EmbeddingDim)
	}
	if n := vectorNorm(v); math.Abs(n-1.0) > 1e-3 {
		t.Errorf("vector norm = %v, want ~1.0 (L2-normalized)", n)
	}
}

// TestEmbedSimilarSentencesAreCloserThanUnrelatedOnes is the real proof this
// embedding pipeline (tokenizer + ONNX model + pooling/normalization) is
// producing semantically meaningful vectors and not just "code that
// compiles and returns 768 numbers." It embeds two paraphrases of the same
// underlying issue, and one clearly unrelated sentence, and checks the
// paraphrases land closer together (higher cosine similarity / lower
// cosine distance) than either does to the unrelated sentence.
func TestEmbedSimilarSentencesAreCloserThanUnrelatedOnes(t *testing.T) {
	e := newTestEmbedder(t)
	ctx := context.Background()

	embed := func(text string) []float32 {
		v, err := e.Embed(ctx, text, false)
		if err != nil {
			t.Fatalf("Embed(%q): %v", text, err)
		}
		return v
	}

	a := embed("NullPointerException thrown in OrderService.processPayment when the customer address is null")
	b := embed("OrderService.processPayment crashes with a NullPointerException because customer address is null")
	c := embed("Quarterly sales report shows a 12% increase in revenue for the northeast region")

	simAB := cosineSimilarity(a, b)
	simAC := cosineSimilarity(a, c)
	simBC := cosineSimilarity(b, c)

	t.Logf("sim(a,b)=%.4f sim(a,c)=%.4f sim(b,c)=%.4f", simAB, simAC, simBC)

	if simAB <= simAC {
		t.Errorf("expected the two paraphrased NPE reports to be more similar to each other (%.4f) than to the unrelated sales report (%.4f)", simAB, simAC)
	}
	if simAB <= simBC {
		t.Errorf("expected the two paraphrased NPE reports to be more similar to each other (%.4f) than to the unrelated sales report (%.4f)", simAB, simBC)
	}
}

// TestEmbedQueryVsDocumentPrefixesDiffer checks the Nomic-specific
// query/document instruction prefixing is actually wired up: embedding the
// same raw text as a query vs. as a document must not silently collapse to
// identical output (which would indicate the prefix isn't being applied).
func TestEmbedQueryVsDocumentPrefixesDiffer(t *testing.T) {
	e := newTestEmbedder(t)
	ctx := context.Background()

	text := "disk usage at 95% on /var partition"
	asQuery, err := e.Embed(ctx, text, true)
	if err != nil {
		t.Fatalf("Embed(query): %v", err)
	}
	asDocument, err := e.Embed(ctx, text, false)
	if err != nil {
		t.Fatalf("Embed(document): %v", err)
	}

	sim := cosineSimilarity(asQuery, asDocument)
	if sim > 0.9999 {
		t.Errorf("query- and document-prefixed embeddings of the same text are nearly identical (sim=%.6f); expected the search_query:/search_document: prefixes to produce distinguishable embeddings", sim)
	}
}
