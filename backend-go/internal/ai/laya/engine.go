// Assume Role: The Backend Engineer (@backend)

package laya

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sync"
)

// Engine defines the evaluation interface for the Laya System 1 decision engine.
type Engine interface {
	Predict(ctx context.Context, q Question, stateText string) (*DecisionResult, error)
	PredictBatch(ctx context.Context, questions map[string]Question, stateText string) (map[string]*DecisionResult, error)
	SetDevice(device string) error // "cpu" or "gpu"
	Close() error
}

// onnxSessionRunner abstracts raw ONNX Runtime sessions to isolate cgo dependencies.
type onnxSessionRunner interface {
	RunEncoder(inputIDs, attentionMask []int64, seqLen int, hiddenDim int64) ([]float32, error)
	RunHead(maskEmbeddings []float32, numMasks int, hiddenDim int64) ([]float32, error)
	Destroy() error
}

// ONNXEngineConfig provides initialization settings for ONNXEngine.
type ONNXEngineConfig struct {
	SharedLibPath   string           // Optional path to onnxruntime shared library
	EncoderPath     string           // Path to encoder_q8.onnx
	HeadPath        string           // Path to head_q8.onnx
	TokenizerPath   string           // Path to tokenizer.json
	Tokenizer       *Tokenizer       // Pre-loaded Tokenizer instance (optional)
	SequenceBuilder *SequenceBuilder // Pre-constructed SequenceBuilder (optional)
	Device          string           // "cpu" or "gpu" (default "cpu")
	Temperature     float32          // Softmax temperature (default 1.0)
	HiddenDim       int64            // Model hidden dimension (default 1024)
	FallbackToMock  bool             // Fall back to heuristic MockEngine if model files missing
}

// ONNXEngine executes Laya ModernBERT System 1 classification using ONNX Runtime.
type ONNXEngine struct {
	mu           sync.Mutex
	device       string
	temperature  float32
	hiddenDim    int64
	seqBuilder   *SequenceBuilder
	runner       onnxSessionRunner
	simulated    bool
	mockFallback *MockEngine
	closed       bool
}

// NewONNXEngine initializes an ONNXEngine with the specified configuration.
func NewONNXEngine(cfg ONNXEngineConfig) (*ONNXEngine, error) {
	if cfg.Device == "" {
		cfg.Device = "cpu"
	}
	if cfg.Device != "cpu" && cfg.Device != "gpu" {
		return nil, fmt.Errorf("invalid device %q: must be 'cpu' or 'gpu'", cfg.Device)
	}
	if cfg.Temperature <= 0 {
		cfg.Temperature = 1.0
	}
	if cfg.HiddenDim <= 0 {
		cfg.HiddenDim = 1024
	}

	seqBuilder := cfg.SequenceBuilder
	if seqBuilder == nil {
		tok := cfg.Tokenizer
		if tok == nil && cfg.TokenizerPath != "" && fileExists(cfg.TokenizerPath) {
			var err error
			tok, err = LoadTokenizer(cfg.TokenizerPath)
			if err != nil && !cfg.FallbackToMock {
				return nil, fmt.Errorf("laya: loading tokenizer %s: %w", cfg.TokenizerPath, err)
			}
		}
		if tok == nil {
			tok = NewTokenizer(makeDefaultVocab())
		}
		seqBuilder = NewSequenceBuilder(tok, 8192)
	}

	encoderPath := cfg.EncoderPath
	if encoderPath == "" {
		encoderPath = os.Getenv("LOGLENS_LAYA_ENCODER_PATH")
	}
	headPath := cfg.HeadPath
	if headPath == "" {
		headPath = os.Getenv("LOGLENS_LAYA_HEAD_PATH")
	}

	modelsAvailable := fileExists(encoderPath) && fileExists(headPath)

	if !modelsAvailable {
		if cfg.FallbackToMock {
			return &ONNXEngine{
				device:       cfg.Device,
				temperature:  cfg.Temperature,
				hiddenDim:    cfg.HiddenDim,
				seqBuilder:   seqBuilder,
				simulated:    true,
				mockFallback: NewMockEngine(),
			}, nil
		}
		return nil, fmt.Errorf("laya: ONNX model files not found (encoder: %q, head: %q); enable FallbackToMock or provide valid paths", encoderPath, headPath)
	}

	runner, err := newONNXSessionRunner(cfg, encoderPath, headPath)
	if err != nil {
		if cfg.FallbackToMock {
			return &ONNXEngine{
				device:       cfg.Device,
				temperature:  cfg.Temperature,
				hiddenDim:    cfg.HiddenDim,
				seqBuilder:   seqBuilder,
				simulated:    true,
				mockFallback: NewMockEngine(),
			}, nil
		}
		return nil, fmt.Errorf("laya: initializing ONNX sessions: %w", err)
	}

	return &ONNXEngine{
		device:       cfg.Device,
		temperature:  cfg.Temperature,
		hiddenDim:    cfg.HiddenDim,
		seqBuilder:   seqBuilder,
		runner:       runner,
		simulated:    false,
		mockFallback: NewMockEngine(),
	}, nil
}

// Device returns the configured hardware execution device.
func (e *ONNXEngine) Device() string {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.device
}

// IsSimulated reports whether the engine is running in fallback simulated mode.
func (e *ONNXEngine) IsSimulated() bool {
	return e.simulated
}

// SetDevice switches the hardware device between "cpu" and "gpu".
func (e *ONNXEngine) SetDevice(device string) error {
	if device != "cpu" && device != "gpu" {
		return fmt.Errorf("invalid device %q: must be 'cpu' or 'gpu'", device)
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	e.device = device
	if e.simulated && e.mockFallback != nil {
		return e.mockFallback.SetDevice(device)
	}
	return nil
}

// Predict executes forward inference for a question against stateText.
func (e *ONNXEngine) Predict(ctx context.Context, q Question, stateText string) (*DecisionResult, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	if e.closed {
		return nil, fmt.Errorf("laya: ONNX engine is closed")
	}

	if e.simulated || e.runner == nil {
		return e.mockFallback.Predict(ctx, q, stateText)
	}

	seq, err := e.seqBuilder.BuildSequence(q, stateText)
	if err != nil {
		return nil, fmt.Errorf("laya: building input sequence: %w", err)
	}

	seqLen := len(seq.InputIDs)
	numMasks := len(seq.MaskIndices)
	if numMasks == 0 {
		return nil, fmt.Errorf("laya: no mask tokens present in sequence")
	}

	hiddenData, err := e.runner.RunEncoder(seq.InputIDs, seq.AttentionMask, seqLen, e.hiddenDim)
	if err != nil {
		return nil, fmt.Errorf("running encoder: %w", err)
	}

	maskEmbeddings := make([]float32, int64(numMasks)*e.hiddenDim)
	for i, maskIdx := range seq.MaskIndices {
		start := maskIdx * e.hiddenDim
		end := start + e.hiddenDim
		if int(end) > len(hiddenData) {
			return nil, fmt.Errorf("mask index %d exceeds hidden data bounds", maskIdx)
		}
		copy(maskEmbeddings[int64(i)*e.hiddenDim:], hiddenData[start:end])
	}

	logits, err := e.runner.RunHead(maskEmbeddings, numMasks, e.hiddenDim)
	if err != nil {
		return nil, fmt.Errorf("running head session: %w", err)
	}

	probs := Softmax(logits, e.temperature)

	return ComputeDecisionResult(q.Type, seq.OptionLabels, probs, q.Rubric), nil
}

// PredictBatch executes forward inference over a collection of questions.
func (e *ONNXEngine) PredictBatch(ctx context.Context, questions map[string]Question, stateText string) (map[string]*DecisionResult, error) {
	if e.closed {
		return nil, fmt.Errorf("laya: ONNX engine is closed")
	}

	results := make(map[string]*DecisionResult, len(questions))
	for name, q := range questions {
		res, err := e.Predict(ctx, q, stateText)
		if err != nil {
			return nil, fmt.Errorf("predicting question %q: %w", name, err)
		}
		results[name] = res
	}
	return results, nil
}

// Close destroys open ONNX sessions and frees associated native resources.
func (e *ONNXEngine) Close() error {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.closed = true
	var err error
	if e.runner != nil {
		err = e.runner.Destroy()
		e.runner = nil
	}
	if e.mockFallback != nil {
		_ = e.mockFallback.Close()
	}
	return err
}

func fileExists(path string) bool {
	if path == "" {
		return false
	}
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func resolveSharedLibPath() string {
	if p := os.Getenv("LOGLENS_ONNXRUNTIME_PATH"); p != "" && fileExists(p) {
		return p
	}

	libName := "onnxruntime.so"
	if runtime.GOOS == "windows" {
		libName = "onnxruntime.dll"
	} else if runtime.GOOS == "darwin" {
		libName = "onnxruntime.dylib"
	}

	exe, err := os.Executable()
	if err == nil {
		cand := filepath.Join(filepath.Dir(exe), libName)
		if fileExists(cand) {
			return cand
		}
	}

	cwd, err := os.Getwd()
	if err == nil {
		curr := cwd
		for range 8 {
			cand := filepath.Join(curr, ".venv", "Lib", "site-packages", "onnxruntime", "capi", libName)
			if fileExists(cand) {
				return cand
			}
			cand2 := filepath.Join(curr, ".venv", "lib", "python3", "site-packages", "onnxruntime", "capi", libName)
			if fileExists(cand2) {
				return cand2
			}
			parent := filepath.Dir(curr)
			if parent == curr {
				break
			}
			curr = parent
		}
	}

	return ""
}

func makeDefaultVocab() map[string]int64 {
	return map[string]int64{
		"choice":      1000,
		"score":       1001,
		"noul":        1002,
		"question":    1003,
		":":           1004,
		"classify":    1005,
		"the":         1006,
		"user":        1007,
		"intent":      1008,
		"search":      1009,
		"_":           1010,
		"logs":        1011,
		"get":         1012,
		"clusters":    1013,
		"memory":      1014,
		"rate":        1015,
		"severity":    1016,
		"1":           1017,
		"2":           1018,
		"3":           1019,
		"4":           1020,
		"5":           1021,
		"true":        1022,
		"false":       1023,
		"is":          1024,
		"outage":      1025,
		"database":    1026,
		"network":     1027,
		"auth":        1028,
		"disk_io":     1029,
		"application": 1030,
		"third_party": 1031,
	}
}
