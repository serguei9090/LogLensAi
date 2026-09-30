// Assume Role: The Backend Engineer (@backend)

package laya

import (
	"context"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
)

// DecisionResult represents the calculated outcome of evaluating a question against state text.
type DecisionResult struct {
	QuestionType  QuestionType `json:"question_type"`
	Labels        []string     `json:"labels"`
	Probabilities []float32    `json:"probabilities"`
	SelectedLabel string       `json:"selected_label"`
	SelectedScore float32      `json:"selected_score"`
	Confidence    float32      `json:"confidence"`
}

// Clone creates a deep copy of DecisionResult.
func (r *DecisionResult) Clone() *DecisionResult {
	if r == nil {
		return nil
	}
	cp := *r
	if r.Labels != nil {
		cp.Labels = make([]string, len(r.Labels))
		copy(cp.Labels, r.Labels)
	}
	if r.Probabilities != nil {
		cp.Probabilities = make([]float32, len(r.Probabilities))
		copy(cp.Probabilities, r.Probabilities)
	}
	return &cp
}

// Engine defines the evaluation interface for the Laya System 1 decision engine.
type Engine interface {
	Predict(ctx context.Context, q Question, stateText string) (*DecisionResult, error)
	PredictBatch(ctx context.Context, questions map[string]Question, stateText string) (map[string]*DecisionResult, error)
	SetDevice(device string) error // "cpu" or "gpu"
	Close() error
}

// Softmax computes numerically stable softmax probabilities with max subtraction.
// Temperature scales the logits before exponentiation:
//   - T > 1.0 yields a smoother, more uniform distribution.
//   - 0 < T < 1.0 yields a peakier distribution.
//   - T <= 0 defaults to T = 1.0.
func Softmax(logits []float32, temperature float32) []float32 {
	if len(logits) == 0 {
		return nil
	}
	if temperature <= 0 {
		temperature = 1.0
	}

	// 1. Scale logits and compute maximum for numerical stability
	maxVal := logits[0] / temperature
	scaled := make([]float32, len(logits))
	scaled[0] = maxVal
	for i := 1; i < len(logits); i++ {
		s := logits[i] / temperature
		scaled[i] = s
		if s > maxVal {
			maxVal = s
		}
	}

	// 2. Exponentiate with max subtraction and sum
	var sum float64
	exps := make([]float64, len(logits))
	for i, s := range scaled {
		e := math.Exp(float64(s - maxVal))
		exps[i] = e
		sum += e
	}

	// 3. Normalize into probabilities
	probs := make([]float32, len(logits))
	if sum <= 0 || math.IsNaN(sum) {
		uniform := float32(1.0 / float64(len(logits)))
		for i := range probs {
			probs[i] = uniform
		}
		return probs
	}

	for i, e := range exps {
		probs[i] = float32(e / sum)
	}
	return probs
}

// ComputeDecisionResult calculates labels, scores, and confidence based on question type:
//   - QuestionTypeChoice: SelectedLabel is the option with max probability; Confidence is max(probabilities).
//   - QuestionTypeScore: SelectedScore is the mathematical expectation sum(rubric[i] * p[i]);
//     SelectedLabel is string representation of top scoring rubric.
//   - QuestionTypeNoul: Confidence is probabilities[0] (p_true); SelectedLabel is "true" if p >= 0.5 else "false".
func ComputeDecisionResult(qType QuestionType, labels []string, probs []float32, rubric []int) *DecisionResult {
	res := &DecisionResult{
		QuestionType:  qType,
		Labels:        labels,
		Probabilities: probs,
	}
	if len(probs) == 0 {
		return res
	}

	topIdx := 0
	maxProb := probs[0]
	for i := 1; i < len(probs); i++ {
		if probs[i] > maxProb {
			maxProb = probs[i]
			topIdx = i
		}
	}

	switch qType {
	case QuestionTypeChoice:
		if topIdx < len(labels) {
			res.SelectedLabel = labels[topIdx]
		}
		res.Confidence = maxProb
		res.SelectedScore = maxProb

	case QuestionTypeScore:
		var expectedScore float32
		for i, p := range probs {
			val := float32(i + 1)
			if i < len(rubric) {
				val = float32(rubric[i])
			}
			expectedScore += val * p
		}
		res.SelectedScore = expectedScore
		if topIdx < len(rubric) {
			res.SelectedLabel = strconv.Itoa(rubric[topIdx])
		} else if topIdx < len(labels) {
			res.SelectedLabel = labels[topIdx]
		}
		res.Confidence = maxProb

	case QuestionTypeNoul:
		probTrue := probs[0]
		res.Confidence = probTrue
		res.SelectedScore = probTrue
		if probTrue >= 0.5 {
			res.SelectedLabel = "true"
		} else {
			res.SelectedLabel = "false"
		}

	default:
		if topIdx < len(labels) {
			res.SelectedLabel = labels[topIdx]
		}
		res.Confidence = maxProb
		res.SelectedScore = maxProb
	}

	return res
}

// ComputeDecision wraps ComputeDecisionResult extracting rubric and options from Question.
func ComputeDecision(q Question, labels []string, probs []float32) *DecisionResult {
	return ComputeDecisionResult(q.Type, labels, probs, q.Rubric)
}

// -------------------------------------------------------------------------
// MockEngine: In-Memory Engine for Fast Testing, Dry Runs, and Fallbacks
// -------------------------------------------------------------------------

// MockEngine provides deterministic, keyword-based decisions without requiring ONNX models on disk.
type MockEngine struct {
	mu            sync.RWMutex
	device        string
	mockResponses map[string]*DecisionResult
	closed        bool
}

// NewMockEngine constructs an in-memory MockEngine initialized to "cpu" device mode.
func NewMockEngine() *MockEngine {
	return &MockEngine{
		device:        "cpu",
		mockResponses: make(map[string]*DecisionResult),
	}
}

// SetMockResponse registers an explicit mock result for a given question instruction or identifier.
func (m *MockEngine) SetMockResponse(key string, res *DecisionResult) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.mockResponses[key] = res
}

// ClearMockResponses removes all custom mock responses.
func (m *MockEngine) ClearMockResponses() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.mockResponses = make(map[string]*DecisionResult)
}

// Device returns the currently configured hardware device ("cpu" or "gpu").
func (m *MockEngine) Device() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.device
}

// SetDevice updates the execution device setting.
func (m *MockEngine) SetDevice(device string) error {
	if device != "cpu" && device != "gpu" {
		return fmt.Errorf("invalid device %q: must be 'cpu' or 'gpu'", device)
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.device = device
	return nil
}

// Predict evaluates a single question against stateText using registered mock responses or rule heuristics.
func (m *MockEngine) Predict(ctx context.Context, q Question, stateText string) (*DecisionResult, error) {
	m.mu.RLock()
	if m.closed {
		m.mu.RUnlock()
		return nil, fmt.Errorf("laya: mock engine is closed")
	}
	if res, ok := m.mockResponses[q.Instructions]; ok {
		m.mu.RUnlock()
		return res.Clone(), nil
	}
	m.mu.RUnlock()

	return mockPredictQuestion(q, stateText), nil
}

// PredictBatch evaluates a batch of questions against stateText.
func (m *MockEngine) PredictBatch(ctx context.Context, questions map[string]Question, stateText string) (map[string]*DecisionResult, error) {
	m.mu.RLock()
	if m.closed {
		m.mu.RUnlock()
		return nil, fmt.Errorf("laya: mock engine is closed")
	}
	m.mu.RUnlock()

	results := make(map[string]*DecisionResult, len(questions))
	for name, q := range questions {
		res, err := m.Predict(ctx, q, stateText)
		if err != nil {
			return nil, fmt.Errorf("predicting question %q: %w", name, err)
		}
		results[name] = res
	}
	return results, nil
}

// Close marks the mock engine as closed.
func (m *MockEngine) Close() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.closed = true
	return nil
}

// mockPredictQuestion implements deterministic keyword-based heuristics for log triage.
func mockPredictQuestion(q Question, stateText string) *DecisionResult {
	lowerState := strings.ToLower(stateText)
	lowerInstructions := strings.ToLower(q.Instructions)

	switch q.Type {
	case QuestionTypeChoice:
		options := q.Options
		if len(options) == 0 {
			return &DecisionResult{QuestionType: QuestionTypeChoice}
		}

		scores := make([]float32, len(options))
		for i := range scores {
			scores[i] = 1.0
		}

		if strings.Contains(lowerInstructions, "intent") || strings.Contains(lowerInstructions, "tool") {
			switch {
			case containsAny(lowerState, "cluster", "clustering", "template", "templates", "group"):
				boostOption(options, scores, "get_clusters", 5.0)
			case containsAny(lowerState, "memory", "rag", "historical", "previous", "remember", "context"):
				boostOption(options, scores, "search_memory", 5.0)
			case containsAny(lowerState, "facet", "field", "distribution", "breakdown", "count", "stats"):
				boostOption(options, scores, "get_facets", 5.0)
			case containsAny(lowerState, "why", "what is", "how do", "explain", "help", "hello", "hi"):
				boostOption(options, scores, "conversational_qa", 5.0)
			default:
				boostOption(options, scores, "search_logs", 4.0)
			}
		} else if strings.Contains(lowerInstructions, "category") || strings.Contains(lowerInstructions, "subsystem") {
			switch {
			case containsAny(lowerState, "db", "database", "sql", "postgres", "mysql", "duckdb", "redis", "query", "table"):
				boostOption(options, scores, "database", 5.0)
			case containsAny(lowerState, "network", "socket", "dns", "connection", "port", "http", "tcp", "udp", "ip", "connect", "refused"):
				boostOption(options, scores, "network", 5.0)
			case containsAny(lowerState, "auth", "jwt", "token", "login", "password", "permission", "denied", "unauthorized", "oauth"):
				boostOption(options, scores, "auth", 5.0)
			case containsAny(lowerState, "disk", "io", "filesystem", "file", "storage", "inode", "enospc"):
				boostOption(options, scores, "disk_io", 5.0)
			case containsAny(lowerState, "stripe", "aws", "gcp", "azure", "webhook", "vendor", "third_party"):
				boostOption(options, scores, "third_party", 5.0)
			default:
				boostOption(options, scores, "application", 3.0)
			}
		} else {
			for i, opt := range options {
				optLower := strings.ToLower(opt)
				if strings.Contains(lowerState, optLower) {
					scores[i] += 4.0
				}
				parts := strings.FieldsFunc(optLower, func(r rune) bool { return r == '_' || r == '-' || r == ' ' })
				for _, p := range parts {
					if len(p) > 2 && strings.Contains(lowerState, p) {
						scores[i] += 1.5
					}
				}
			}
		}

		probs := Softmax(scores, 1.0)
		return ComputeDecisionResult(q.Type, options, probs, q.Rubric)

	case QuestionTypeScore:
		rubric := q.Rubric
		if len(rubric) == 0 {
			rubric = []int{1, 2, 3, 4, 5}
		}
		labels := make([]string, len(rubric))
		for i, r := range rubric {
			labels[i] = strconv.Itoa(r)
		}

		targetLevel := 2
		if containsAny(lowerState, "fatal", "panic", "emergency", "catastrophic", "data loss", "deadlock", "segfault") {
			targetLevel = 5
		} else if containsAny(lowerState, "error", "failed", "refused", "timeout", "exception", "broken", "unavailable", "500", "503") {
			targetLevel = 4
		} else if containsAny(lowerState, "warn", "warning", "slow", "retry", "degraded", "404", "401") {
			targetLevel = 3
		} else if containsAny(lowerState, "info", "notice", "start", "complete", "connected", "ready", "received", "success", "ok") {
			targetLevel = 2
		} else if containsAny(lowerState, "debug", "trace", "verbose", "heartbeat", "ping") {
			targetLevel = 1
		}

		bestIdx := 0
		minDiff := 999
		for i, r := range rubric {
			diff := absInt(r - targetLevel)
			if diff < minDiff {
				minDiff = diff
				bestIdx = i
			}
		}

		scores := make([]float32, len(rubric))
		for i := range scores {
			dist := absInt(i - bestIdx)
			val := float32(5 - dist)
			if val < 0.5 {
				val = 0.5
			}
			scores[i] = val
		}

		probs := Softmax(scores, 1.0)
		return ComputeDecisionResult(q.Type, labels, probs, rubric)

	case QuestionTypeNoul:
		labels := []string{"true", "false"}
		isTrue := containsAny(lowerState, "outage", "down", "crash", "fatal", "dead", "unreachable", "panic", "blackout", "incident", "emergency", "unavailable")

		var probs []float32
		if isTrue {
			probs = []float32{0.88, 0.12}
		} else {
			probs = []float32{0.12, 0.88}
		}
		return ComputeDecisionResult(q.Type, labels, probs, nil)

	default:
		return &DecisionResult{QuestionType: q.Type}
	}
}

func containsAny(s string, keywords ...string) bool {
	for _, kw := range keywords {
		if strings.Contains(s, kw) {
			return true
		}
	}
	return false
}

func boostOption(options []string, scores []float32, targetOpt string, boost float32) {
	for i, opt := range options {
		if opt == targetOpt {
			scores[i] += boost
			return
		}
	}
}

func absInt(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

// -------------------------------------------------------------------------
// ONNXEngine: Production ONNX Runtime Engine with Fallback Support
// -------------------------------------------------------------------------

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
// If model files cannot be found or initialized, and FallbackToMock is true,
// it logs and switches to simulated fallback mode without requiring model weights.
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

	// 1. Resolve Tokenizer & SequenceBuilder
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

	// 2. Resolve Model Paths
	encoderPath := cfg.EncoderPath
	if encoderPath == "" {
		encoderPath = os.Getenv("LOGLENS_LAYA_ENCODER_PATH")
	}
	headPath := cfg.HeadPath
	if headPath == "" {
		headPath = os.Getenv("LOGLENS_LAYA_HEAD_PATH")
	}

	modelsAvailable := fileExists(encoderPath) && fileExists(headPath)

	// Fallback path when models are not available
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

	// 3. Try to initialize real ONNX runner
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

	// 1. Build sequence
	seq, err := e.seqBuilder.BuildSequence(q, stateText)
	if err != nil {
		return nil, fmt.Errorf("laya: building input sequence: %w", err)
	}

	seqLen := len(seq.InputIDs)
	numMasks := len(seq.MaskIndices)
	if numMasks == 0 {
		return nil, fmt.Errorf("laya: no mask tokens present in sequence")
	}

	// 2. Encoder forward pass
	hiddenData, err := e.runner.RunEncoder(seq.InputIDs, seq.AttentionMask, seqLen, e.hiddenDim)
	if err != nil {
		return nil, fmt.Errorf("running encoder: %w", err)
	}

	// 3. Extract hidden states at MaskIndices
	maskEmbeddings := make([]float32, int64(numMasks)*e.hiddenDim)
	for i, maskIdx := range seq.MaskIndices {
		start := maskIdx * e.hiddenDim
		end := start + e.hiddenDim
		if int(end) > len(hiddenData) {
			return nil, fmt.Errorf("mask index %d exceeds hidden data bounds", maskIdx)
		}
		copy(maskEmbeddings[int64(i)*e.hiddenDim:], hiddenData[start:end])
	}

	// 4. Head forward pass
	logits, err := e.runner.RunHead(maskEmbeddings, numMasks, e.hiddenDim)
	if err != nil {
		return nil, fmt.Errorf("running head session: %w", err)
	}

	// 5. Softmax & Decision
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

// -------------------------------------------------------------------------
// Helpers: File Resolution & Fallback Vocab
// -------------------------------------------------------------------------

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

	// Check python venv directory if present
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
