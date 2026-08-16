package rag

// Embedding backend selection
// ----------------------------
// Python's rag_service.py embeds text with nomic-ai/nomic-embed-text-v1.5,
// loaded as an int8-quantized ONNX model via onnxruntime.InferenceSession.
// Three options were considered for the Go port (see the task's research
// spike brief):
//
//  1. An ONNX Runtime Go binding calling the *same* model_int8.onnx file --
//     best semantic parity with existing saved memories, but needs the
//     onnxruntime native shared library at runtime.
//  2. A sidecar embedding subprocess (Python or llama.cpp server) -- avoids
//     cgo/ONNX entirely but adds a process-management dependency for one
//     function.
//  3. A pure-Go/simplified embedding scheme -- easiest to ship, but degrades
//     semantic search quality versus Python.
//
// Option 1 was tried first and works in this environment, so it's what
// shipped: github.com/yalue/onnxruntime_go (a cgo binding that *dynamically*
// loads onnxruntime.dll/.so at runtime rather than link-time, specifically so
// it doesn't need the onnxruntime source/import libraries at build time --
// see its README). Concretely confirmed during this pass:
//
//   - This machine already has onnxruntime.dll on disk, bundled by the
//     Python `onnxruntime` pip package at
//     ../.venv/Lib/site-packages/onnxruntime/capi/onnxruntime.dll (version
//     1.26.0). resolveOnnxRuntimeLibrary in modelfiles.go looks for exactly
//     this kind of path.
//   - The model files (tokenizer.json, onnx/model_int8.onnx) are already
//     present in the standard Hugging Face cache
//     (~/.cache/huggingface/hub/models--nomic-ai--nomic-embed-text-v1.5/...),
//     populated by the Python sidecar's `huggingface_hub.snapshot_download`.
//     resolveModelFiles in modelfiles.go reuses that cache directly, and
//     falls back to downloading the same two files straight from
//     huggingface.co over plain net/http if the cache is empty (e.g. a
//     from-scratch Go-only deployment that never ran the Python sidecar).
//   - onnxruntime_go's *latest* release (v1.33.0) requests C API version 29,
//     which this machine's onnxruntime.dll (1.26.0, API version 26) refused
//     ("requested API version [29] is not available, only API versions
//     [1, 26] are supported"). Pinning go.mod to onnxruntime_go v1.31.0
//     (C API version 26 -- confirmed by inspecting its vendored
//     onnxruntime_c_api.h across several tagged versions) fixed this. This
//     is a real, easy-to-hit version-skew trap: the Go binding's C-API
//     version must be <= the actually-installed onnxruntime shared library's
//     supported version, and there is no automatic negotiation.
//
// Real deployment caveat (flagged per the task brief, not silently papered
// over): unlike a pure-Go dependency, this requires an onnxruntime native
// shared library to be present on the target machine/container at runtime.
// During this migration that's satisfied for free because the Python
// sidecar's venv already ships one, but a standalone Go-only deployment (the
// eventual Phase 6 end state) will need to either vendor onnxruntime.dll/.so
// alongside the Go binary or install the onnxruntime C/C++ runtime package
// for the target OS. That's a genuine, non-trivial packaging item for
// whichever phase handles final packaging -- it is the one concrete downside
// of choosing option 1 over a pure-Go embedding model.

import (
	"context"
	"fmt"
	"math"
	"sync"

	ort "github.com/yalue/onnxruntime_go"
)

// EmbeddingDim is the output vector width of nomic-embed-text-v1.5
// (confirmed from the model's own config.json: "hidden_size": 768, and from
// the ONNX graph's last_hidden_state output shape [-1, -1, 768]). This
// matches the 768-dim vector column Python's LanceDB schema already used, so
// no dimension migration is needed for saved memories.
const EmbeddingDim = 768

// Nomic-specific instruction prefixes: nomic-embed-text-v1.5 was trained
// with task prefixes prepended to the raw text, and produces meaningfully
// different (and worse, if omitted) embeddings without them. Ported verbatim
// from rag_service.py's `_embed`.
const (
	queryPrefix    = "search_query: "
	documentPrefix = "search_document: "
)

// Embedder loads the nomic-embed-text-v1.5 ONNX model once and produces
// mean-pooled, L2-normalized 768-dim embeddings from text, matching
// rag_service.py's `_embed` method exactly (same prefixing, same pooling,
// same normalization -- only the runtime differs).
//
// Not safe for concurrent Run() calls with itself (onnxruntime sessions in
// this binding are not documented as thread-safe for concurrent Run), so all
// access is serialized with a mutex; RAG save/search is not a hot path.
type Embedder struct {
	mu        sync.Mutex
	session   *ort.DynamicAdvancedSession
	tokenizer *Tokenizer
}

// NewEmbedder initializes the ONNX Runtime environment (process-global,
// safe to call once) and loads the model + tokenizer from the given paths.
// sharedLibPath may be empty to fall back to onnxruntime_go's own default
// search behavior (e.g. "onnxruntime.dll" next to the executable or on
// PATH).
func NewEmbedder(sharedLibPath, modelPath, tokenizerPath string) (*Embedder, error) {
	if sharedLibPath != "" {
		ort.SetSharedLibraryPath(sharedLibPath)
	}
	if !ort.IsInitialized() {
		if err := ort.InitializeEnvironment(); err != nil {
			return nil, fmt.Errorf("rag: initializing onnxruntime environment: %w", err)
		}
	}

	tok, err := LoadTokenizer(tokenizerPath)
	if err != nil {
		return nil, fmt.Errorf("rag: loading tokenizer %s: %w", tokenizerPath, err)
	}

	session, err := ort.NewDynamicAdvancedSession(
		modelPath,
		[]string{"input_ids", "token_type_ids", "attention_mask"},
		[]string{"last_hidden_state"},
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("rag: loading ONNX model %s: %w", modelPath, err)
	}

	return &Embedder{session: session, tokenizer: tok}, nil
}

// Close releases the ONNX session. It does not tear down the process-global
// onnxruntime environment (other Embedders / callers may still be using it).
func (e *Embedder) Close() error {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.session == nil {
		return nil
	}
	err := e.session.Destroy()
	e.session = nil
	return err
}

// Embed tokenizes text (with the Nomic-specific "search_query: " or
// "search_document: " prefix depending on isQuery), runs it through the
// model, mean-pools the token embeddings using the attention mask, and
// L2-normalizes the result -- the exact sequence of rag_service.py's
// `_embed`.
func (e *Embedder) Embed(ctx context.Context, text string, isQuery bool) ([]float32, error) {
	prefix := documentPrefix
	if isQuery {
		prefix = queryPrefix
	}
	ids := e.tokenizer.Encode(prefix + text)
	seqLen := len(ids)
	if seqLen == 0 {
		return nil, fmt.Errorf("rag: tokenizer produced an empty sequence for input")
	}

	tokenTypeIDs := make([]int64, seqLen)
	attentionMask := make([]int64, seqLen)
	for i := range attentionMask {
		attentionMask[i] = 1
	}

	shape := ort.NewShape(1, int64(seqLen))
	inputIDsTensor, err := ort.NewTensor(shape, ids)
	if err != nil {
		return nil, fmt.Errorf("rag: creating input_ids tensor: %w", err)
	}
	defer inputIDsTensor.Destroy()
	tokenTypeTensor, err := ort.NewTensor(shape, tokenTypeIDs)
	if err != nil {
		return nil, fmt.Errorf("rag: creating token_type_ids tensor: %w", err)
	}
	defer tokenTypeTensor.Destroy()
	attentionTensor, err := ort.NewTensor(shape, attentionMask)
	if err != nil {
		return nil, fmt.Errorf("rag: creating attention_mask tensor: %w", err)
	}
	defer attentionTensor.Destroy()

	outputShape := ort.NewShape(1, int64(seqLen), EmbeddingDim)
	outputTensor, err := ort.NewEmptyTensor[float32](outputShape)
	if err != nil {
		return nil, fmt.Errorf("rag: creating output tensor: %w", err)
	}
	defer outputTensor.Destroy()

	e.mu.Lock()
	runErr := e.session.Run(
		[]ort.Value{inputIDsTensor, tokenTypeTensor, attentionTensor},
		[]ort.Value{outputTensor},
	)
	e.mu.Unlock()
	if runErr != nil {
		return nil, fmt.Errorf("rag: running embedding model: %w", runErr)
	}

	return meanPoolAndNormalize(outputTensor.GetData(), attentionMask, seqLen, EmbeddingDim), nil
}

// meanPoolAndNormalize ports rag_service.py's numpy mean-pooling + L2
// normalization: average the per-token hidden states weighted by the
// attention mask (all 1s here, since we never pad/batch -- each Embed call
// handles exactly one string, matching Python), then divide by the L2 norm.
func meanPoolAndNormalize(hidden []float32, attentionMask []int64, seqLen, dim int) []float32 {
	sum := make([]float64, dim)
	var maskSum float64
	for t := 0; t < seqLen; t++ {
		m := float64(attentionMask[t])
		maskSum += m
		if m == 0 {
			continue
		}
		base := t * dim
		for d := 0; d < dim; d++ {
			sum[d] += float64(hidden[base+d]) * m
		}
	}
	if maskSum < 1e-9 {
		maskSum = 1e-9
	}

	var normSq float64
	pooled := make([]float64, dim)
	for d := 0; d < dim; d++ {
		pooled[d] = sum[d] / maskSum
		normSq += pooled[d] * pooled[d]
	}
	norm := math.Sqrt(normSq)
	if norm < 1e-12 {
		norm = 1e-12
	}

	out := make([]float32, dim)
	for d := 0; d < dim; d++ {
		out[d] = float32(pooled[d] / norm)
	}
	return out
}
