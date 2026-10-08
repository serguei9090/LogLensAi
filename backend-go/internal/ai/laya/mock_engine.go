// Assume Role: The Backend Engineer (@backend)

package laya

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
)

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
