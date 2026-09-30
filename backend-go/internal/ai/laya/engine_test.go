// Assume Role: The Backend Engineer (@backend)

package laya

import (
	"context"
	"math"
	"strings"
	"testing"
)

// TestSoftmax tests numerical stability, temperature scaling effect, and normalization.
func TestSoftmax(t *testing.T) {
	t.Run("sums_to_one", func(t *testing.T) {
		logits := []float32{1.0, 2.0, 3.0, 4.0}
		probs := Softmax(logits, 1.0)
		if len(probs) != len(logits) {
			t.Fatalf("expected length %d, got %d", len(logits), len(probs))
		}

		var sum float64
		for _, p := range probs {
			sum += float64(p)
		}
		if math.Abs(sum-1.0) > 1e-5 {
			t.Errorf("expected probabilities to sum to 1.0, got %f", sum)
		}
	})

	t.Run("numerical_stability_large_positive", func(t *testing.T) {
		// Extremely large logits that would overflow naive exp() to +Inf or NaN
		logits := []float32{1000.0, 1001.0, 1002.0}
		probs := Softmax(logits, 1.0)

		var sum float64
		for i, p := range probs {
			if math.IsNaN(float64(p)) || math.IsInf(float64(p), 0) {
				t.Fatalf("probability at index %d is invalid: %v", i, p)
			}
			sum += float64(p)
		}
		if math.Abs(sum-1.0) > 1e-4 {
			t.Errorf("expected sum 1.0, got %f", sum)
		}
		// Highest logit (1002.0) should have the highest probability
		if probs[2] <= probs[1] || probs[1] <= probs[0] {
			t.Errorf("expected monotonic probabilities matching logits, got %v", probs)
		}
	})

	t.Run("numerical_stability_large_negative", func(t *testing.T) {
		logits := []float32{-1000.0, -999.0, -998.0}
		probs := Softmax(logits, 1.0)

		var sum float64
		for i, p := range probs {
			if math.IsNaN(float64(p)) || math.IsInf(float64(p), 0) {
				t.Fatalf("probability at index %d is invalid: %v", i, p)
			}
			sum += float64(p)
		}
		if math.Abs(sum-1.0) > 1e-4 {
			t.Errorf("expected sum 1.0, got %f", sum)
		}
		if probs[2] <= probs[1] || probs[1] <= probs[0] {
			t.Errorf("expected monotonic probabilities, got %v", probs)
		}
	})

	t.Run("temperature_scaling_effect", func(t *testing.T) {
		logits := []float32{1.0, 4.0}

		pStandard := Softmax(logits, 1.0)
		pHighTemp := Softmax(logits, 5.0) // higher temp = smoother, more uniform
		pLowTemp := Softmax(logits, 0.2)  // lower temp = peakier

		// Standard differences
		stdDiff := pStandard[1] - pStandard[0]
		highDiff := pHighTemp[1] - pHighTemp[0]
		lowDiff := pLowTemp[1] - pLowTemp[0]

		if highDiff >= stdDiff {
			t.Errorf("expected higher temperature to be more uniform (diff %f < std %f)", highDiff, stdDiff)
		}
		if lowDiff <= stdDiff {
			t.Errorf("expected lower temperature to be peakier (diff %f > std %f)", lowDiff, stdDiff)
		}
		if pLowTemp[1] < 0.99 {
			t.Errorf("expected low temperature to peak near 1.0, got %f", pLowTemp[1])
		}
	})

	t.Run("temperature_zero_or_negative_fallback", func(t *testing.T) {
		logits := []float32{1.0, 2.0}
		pZero := Softmax(logits, 0.0)
		pNeg := Softmax(logits, -2.5)
		pDefault := Softmax(logits, 1.0)

		for i := range logits {
			if math.Abs(float64(pZero[i]-pDefault[i])) > 1e-5 {
				t.Errorf("temperature 0 should default to 1.0, got %v vs %v", pZero, pDefault)
			}
			if math.Abs(float64(pNeg[i]-pDefault[i])) > 1e-5 {
				t.Errorf("negative temperature should default to 1.0, got %v vs %v", pNeg, pDefault)
			}
		}
	})

	t.Run("single_element", func(t *testing.T) {
		logits := []float32{42.0}
		probs := Softmax(logits, 1.0)
		if len(probs) != 1 || probs[0] != 1.0 {
			t.Errorf("expected [1.0], got %v", probs)
		}
	})

	t.Run("empty_input", func(t *testing.T) {
		probs := Softmax(nil, 1.0)
		if probs != nil {
			t.Errorf("expected nil for empty logits, got %v", probs)
		}
	})
}

// TestDecisionResult_Choice verifies argmax selection and confidence calculation.
func TestDecisionResult_Choice(t *testing.T) {
	options := []string{"search_logs", "get_clusters", "search_memory"}
	probs := []float32{0.10, 0.70, 0.20}

	res := ComputeDecisionResult(QuestionTypeChoice, options, probs, nil)

	if res.QuestionType != QuestionTypeChoice {
		t.Errorf("expected QuestionTypeChoice, got %v", res.QuestionType)
	}
	if res.SelectedLabel != "get_clusters" {
		t.Errorf("expected SelectedLabel 'get_clusters', got %q", res.SelectedLabel)
	}
	if res.Confidence != 0.70 {
		t.Errorf("expected Confidence 0.70, got %f", res.Confidence)
	}
	if res.SelectedScore != 0.70 {
		t.Errorf("expected SelectedScore 0.70, got %f", res.SelectedScore)
	}
	if len(res.Labels) != len(options) {
		t.Errorf("expected %d labels, got %d", len(options), len(res.Labels))
	}
	if len(res.Probabilities) != len(probs) {
		t.Errorf("expected %d probabilities, got %d", len(probs), len(res.Probabilities))
	}
}

// TestDecisionResult_Score verifies expectation and rubric calculations.
func TestDecisionResult_Score(t *testing.T) {
	rubric := []int{1, 2, 3, 4, 5}
	labels := []string{"1", "2", "3", "4", "5"}
	probs := []float32{0.05, 0.15, 0.50, 0.20, 0.10}

	// Mathematical expectation: 1*0.05 + 2*0.15 + 3*0.50 + 4*0.20 + 5*0.10
	// = 0.05 + 0.30 + 1.50 + 0.80 + 0.50 = 3.15
	expectedExpectation := float32(3.15)

	res := ComputeDecisionResult(QuestionTypeScore, labels, probs, rubric)

	if res.QuestionType != QuestionTypeScore {
		t.Errorf("expected QuestionTypeScore, got %v", res.QuestionType)
	}
	// Highest prob is 0.50 at index 2 (rubric value 3)
	if res.SelectedLabel != "3" {
		t.Errorf("expected SelectedLabel '3', got %q", res.SelectedLabel)
	}
	if math.Abs(float64(res.SelectedScore-expectedExpectation)) > 1e-4 {
		t.Errorf("expected SelectedScore %f, got %f", expectedExpectation, res.SelectedScore)
	}
	if res.Confidence != 0.50 {
		t.Errorf("expected Confidence 0.50, got %f", res.Confidence)
	}
}

// TestDecisionResult_Noul verifies boolean thresholding and confidence.
func TestDecisionResult_Noul(t *testing.T) {
	labels := []string{"true", "false"}

	t.Run("threshold_true", func(t *testing.T) {
		probs := []float32{0.78, 0.22}
		res := ComputeDecisionResult(QuestionTypeNoul, labels, probs, nil)

		if res.QuestionType != QuestionTypeNoul {
			t.Errorf("expected QuestionTypeNoul, got %v", res.QuestionType)
		}
		if res.SelectedLabel != "true" {
			t.Errorf("expected SelectedLabel 'true', got %q", res.SelectedLabel)
		}
		if res.Confidence != 0.78 {
			t.Errorf("expected Confidence 0.78, got %f", res.Confidence)
		}
		if res.SelectedScore != 0.78 {
			t.Errorf("expected SelectedScore 0.78, got %f", res.SelectedScore)
		}
	})

	t.Run("threshold_boundary_half", func(t *testing.T) {
		probs := []float32{0.50, 0.50}
		res := ComputeDecisionResult(QuestionTypeNoul, labels, probs, nil)

		if res.SelectedLabel != "true" {
			t.Errorf("expected SelectedLabel 'true' at p=0.5, got %q", res.SelectedLabel)
		}
		if res.Confidence != 0.50 {
			t.Errorf("expected Confidence 0.50, got %f", res.Confidence)
		}
	})

	t.Run("threshold_false", func(t *testing.T) {
		probs := []float32{0.18, 0.82}
		res := ComputeDecisionResult(QuestionTypeNoul, labels, probs, nil)

		if res.SelectedLabel != "false" {
			t.Errorf("expected SelectedLabel 'false', got %q", res.SelectedLabel)
		}
		if res.Confidence != 0.18 {
			t.Errorf("expected Confidence 0.18 (prob_true), got %f", res.Confidence)
		}
		if res.SelectedScore != 0.18 {
			t.Errorf("expected SelectedScore 0.18, got %f", res.SelectedScore)
		}
	})
}

// TestMockEngine_Predict tests single question prediction on sample log lines.
func TestMockEngine_Predict(t *testing.T) {
	ctx := context.Background()
	engine := NewMockEngine()

	t.Run("choice_tool_intent_search", func(t *testing.T) {
		q := Question{
			Type:         QuestionTypeChoice,
			Instructions: "Classify user intent into tool",
			Options:      []string{"search_logs", "get_clusters", "search_memory"},
		}
		state := "search error logs for timeout"
		res, err := engine.Predict(ctx, q, state)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if res.SelectedLabel != "search_logs" {
			t.Errorf("expected 'search_logs', got %q", res.SelectedLabel)
		}
		if res.Confidence <= 0.33 {
			t.Errorf("expected confidence > 0.33, got %f", res.Confidence)
		}
	})

	t.Run("choice_tool_intent_clusters", func(t *testing.T) {
		q := Question{
			Type:         QuestionTypeChoice,
			Instructions: "Classify user intent into tool",
			Options:      []string{"search_logs", "get_clusters", "search_memory"},
		}
		state := "show me common log cluster templates"
		res, err := engine.Predict(ctx, q, state)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if res.SelectedLabel != "get_clusters" {
			t.Errorf("expected 'get_clusters', got %q", res.SelectedLabel)
		}
	})

	t.Run("score_severity_fatal", func(t *testing.T) {
		q := Question{
			Type:         QuestionTypeScore,
			Instructions: "Rate severity of the event",
			Rubric:       []int{1, 2, 3, 4, 5},
		}
		state := "FATAL: kernel panic - not syncing: VFS: Unable to mount root fs"
		res, err := engine.Predict(ctx, q, state)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if res.SelectedLabel != "5" {
			t.Errorf("expected SelectedLabel '5', got %q", res.SelectedLabel)
		}
		if res.SelectedScore < 4.0 {
			t.Errorf("expected high SelectedScore >= 4.0, got %f", res.SelectedScore)
		}
	})

	t.Run("score_severity_info", func(t *testing.T) {
		q := Question{
			Type:         QuestionTypeScore,
			Instructions: "Rate severity of the event",
			Rubric:       []int{1, 2, 3, 4, 5},
		}
		state := "INFO: HTTP server listening on port 8080, health ok"
		res, err := engine.Predict(ctx, q, state)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if res.SelectedLabel != "2" {
			t.Errorf("expected SelectedLabel '2', got %q", res.SelectedLabel)
		}
		if res.SelectedScore > 3.0 {
			t.Errorf("expected low SelectedScore <= 3.0, got %f", res.SelectedScore)
		}
	})

	t.Run("noul_outage_true", func(t *testing.T) {
		q := Question{
			Type:         QuestionTypeNoul,
			Instructions: "Does this indicate an outage?",
		}
		state := "CRITICAL: major customer-facing outage reported across all regions"
		res, err := engine.Predict(ctx, q, state)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if res.SelectedLabel != "true" {
			t.Errorf("expected SelectedLabel 'true', got %q", res.SelectedLabel)
		}
		if res.Confidence < 0.5 {
			t.Errorf("expected Confidence >= 0.5, got %f", res.Confidence)
		}
	})

	t.Run("noul_outage_false", func(t *testing.T) {
		q := Question{
			Type:         QuestionTypeNoul,
			Instructions: "Does this indicate an outage?",
		}
		state := "DEBUG: periodic heartbeat received from worker 3"
		res, err := engine.Predict(ctx, q, state)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if res.SelectedLabel != "false" {
			t.Errorf("expected SelectedLabel 'false', got %q", res.SelectedLabel)
		}
		if res.Confidence >= 0.5 {
			t.Errorf("expected Confidence < 0.5, got %f", res.Confidence)
		}
	})
}

// TestMockEngine_PredictBatch tests batch prediction across all baseline questions.
func TestMockEngine_PredictBatch(t *testing.T) {
	ctx := context.Background()
	engine := NewMockEngine()
	baseline := DefaultBaselineQuestions()

	state := "2026-09-30T12:00:00Z ERROR database connection refused on port 5432 - active service outage"

	results, err := engine.PredictBatch(ctx, baseline, state)
	if err != nil {
		t.Fatalf("PredictBatch returned error: %v", err)
	}

	if len(results) != len(baseline) {
		t.Fatalf("expected %d results, got %d", len(baseline), len(results))
	}

	// 1. tool_intent
	intentRes, ok := results["tool_intent"]
	if !ok || intentRes == nil {
		t.Fatalf("missing tool_intent result")
	}
	if intentRes.QuestionType != QuestionTypeChoice {
		t.Errorf("expected choice type for tool_intent, got %v", intentRes.QuestionType)
	}
	if intentRes.SelectedLabel == "" {
		t.Errorf("empty SelectedLabel for tool_intent")
	}

	// 2. severity
	sevRes, ok := results["severity"]
	if !ok || sevRes == nil {
		t.Fatalf("missing severity result")
	}
	if sevRes.QuestionType != QuestionTypeScore {
		t.Errorf("expected score type for severity, got %v", sevRes.QuestionType)
	}
	if sevRes.SelectedScore <= 0 {
		t.Errorf("expected positive score, got %f", sevRes.SelectedScore)
	}

	// 3. category
	catRes, ok := results["category"]
	if !ok || catRes == nil {
		t.Fatalf("missing category result")
	}
	if catRes.QuestionType != QuestionTypeChoice {
		t.Errorf("expected choice type for category, got %v", catRes.QuestionType)
	}
	if catRes.SelectedLabel != "database" {
		t.Errorf("expected category 'database', got %q", catRes.SelectedLabel)
	}

	// 4. is_outage
	outageRes, ok := results["is_outage"]
	if !ok || outageRes == nil {
		t.Fatalf("missing is_outage result")
	}
	if outageRes.QuestionType != QuestionTypeNoul {
		t.Errorf("expected noul type for is_outage, got %v", outageRes.QuestionType)
	}
	if outageRes.SelectedLabel != "true" {
		t.Errorf("expected is_outage 'true', got %q", outageRes.SelectedLabel)
	}
}

// TestEngine_SetDevice tests switching device between "cpu" and "gpu".
func TestEngine_SetDevice(t *testing.T) {
	t.Run("mock_engine_device_switching", func(t *testing.T) {
		mock := NewMockEngine()
		if mock.Device() != "cpu" {
			t.Errorf("expected default device 'cpu', got %q", mock.Device())
		}

		if err := mock.SetDevice("gpu"); err != nil {
			t.Fatalf("failed to set gpu: %v", err)
		}
		if mock.Device() != "gpu" {
			t.Errorf("expected device 'gpu', got %q", mock.Device())
		}

		if err := mock.SetDevice("cpu"); err != nil {
			t.Fatalf("failed to set cpu: %v", err)
		}
		if mock.Device() != "cpu" {
			t.Errorf("expected device 'cpu', got %q", mock.Device())
		}

		if err := mock.SetDevice("invalid_device"); err == nil {
			t.Errorf("expected error for invalid device, got nil")
		}
	})

	t.Run("onnx_engine_device_switching", func(t *testing.T) {
		// Test ONNXEngine in simulated fallback mode
		onnxEng, err := NewONNXEngine(ONNXEngineConfig{
			FallbackToMock: true,
		})
		if err != nil {
			t.Fatalf("failed to create fallback ONNXEngine: %v", err)
		}
		defer func() { _ = onnxEng.Close() }()

		if onnxEng.Device() != "cpu" {
			t.Errorf("expected default device 'cpu', got %q", onnxEng.Device())
		}

		if err := onnxEng.SetDevice("gpu"); err != nil {
			t.Fatalf("failed to set device to gpu: %v", err)
		}
		if onnxEng.Device() != "gpu" {
			t.Errorf("expected device 'gpu', got %q", onnxEng.Device())
		}

		if err := onnxEng.SetDevice("cpu"); err != nil {
			t.Fatalf("failed to set device to cpu: %v", err)
		}
		if onnxEng.Device() != "cpu" {
			t.Errorf("expected device 'cpu', got %q", onnxEng.Device())
		}

		if err := onnxEng.SetDevice("tpu"); err == nil {
			t.Errorf("expected error for unknown device 'tpu', got nil")
		}
	})
}

// TestMockEngine_CustomResponse tests registering custom overrides in MockEngine.
func TestMockEngine_CustomResponse(t *testing.T) {
	ctx := context.Background()
	engine := NewMockEngine()

	customQuestion := Question{
		Type:         QuestionTypeChoice,
		Instructions: "Custom question instructions",
		Options:      []string{"optA", "optB"},
	}

	customResult := &DecisionResult{
		QuestionType:  QuestionTypeChoice,
		Labels:        []string{"optA", "optB"},
		Probabilities: []float32{0.05, 0.95},
		SelectedLabel: "optB",
		SelectedScore: 0.95,
		Confidence:    0.95,
	}

	engine.SetMockResponse(customQuestion.Instructions, customResult)

	res, err := engine.Predict(ctx, customQuestion, "arbitrary state text")
	if err != nil {
		t.Fatalf("Predict returned error: %v", err)
	}

	if res.SelectedLabel != "optB" || res.Confidence != 0.95 {
		t.Errorf("expected mocked response with optB/0.95, got %+v", res)
	}

	// Verify mutating res does not affect subsequent calls
	res.SelectedLabel = "mutated"
	res2, err := engine.Predict(ctx, customQuestion, "arbitrary state text")
	if err != nil {
		t.Fatalf("Predict 2 returned error: %v", err)
	}
	if res2.SelectedLabel != "optB" {
		t.Errorf("expected cloned copy unaffected by mutation, got %q", res2.SelectedLabel)
	}

	// Clear responses
	engine.ClearMockResponses()
	res3, err := engine.Predict(ctx, customQuestion, "optA match text")
	if err != nil {
		t.Fatalf("Predict 3 returned error: %v", err)
	}
	if res3.SelectedLabel != "optA" {
		t.Errorf("expected heuristic match after clear, got %q", res3.SelectedLabel)
	}
}

// TestEngine_Close tests closing behavior.
func TestEngine_Close(t *testing.T) {
	ctx := context.Background()
	mock := NewMockEngine()
	if err := mock.Close(); err != nil {
		t.Fatalf("Close failed: %v", err)
	}

	q := Question{
		Type:         QuestionTypeNoul,
		Instructions: "Is outage?",
	}
	if _, err := mock.Predict(ctx, q, "state"); err == nil {
		t.Errorf("expected error on Predict after Close, got nil")
	}
	if _, err := mock.PredictBatch(ctx, map[string]Question{"q": q}, "state"); err == nil {
		t.Errorf("expected error on PredictBatch after Close, got nil")
	}

	// Test ONNXEngine Close
	onnxEng, err := NewONNXEngine(ONNXEngineConfig{FallbackToMock: true})
	if err != nil {
		t.Fatalf("failed to create ONNXEngine: %v", err)
	}
	if err := onnxEng.Close(); err != nil {
		t.Fatalf("ONNXEngine Close failed: %v", err)
	}
	if _, err := onnxEng.Predict(ctx, q, "state"); err == nil {
		t.Errorf("expected error on Predict after Close on ONNXEngine, got nil")
	}
}

// TestONNXEngine_MissingModelsError tests error reporting when FallbackToMock is false and models are missing.
func TestONNXEngine_MissingModelsError(t *testing.T) {
	_, err := NewONNXEngine(ONNXEngineConfig{
		EncoderPath:    "/nonexistent/encoder.onnx",
		HeadPath:       "/nonexistent/head.onnx",
		FallbackToMock: false,
	})
	if err == nil {
		t.Fatalf("expected error when model files are missing and FallbackToMock is false, got nil")
	}
	if !strings.Contains(err.Error(), "model files not found") {
		t.Errorf("expected descriptive error about missing model files, got %q", err.Error())
	}
}

// TestONNXEngine_SimulatedFallback tests fallback initialization and inference.
func TestONNXEngine_SimulatedFallback(t *testing.T) {
	ctx := context.Background()
	onnxEng, err := NewONNXEngine(ONNXEngineConfig{
		FallbackToMock: true,
	})
	if err != nil {
		t.Fatalf("unexpected error creating simulated engine: %v", err)
	}
	defer func() { _ = onnxEng.Close() }()

	if !onnxEng.IsSimulated() {
		t.Errorf("expected IsSimulated to be true")
	}

	q := Question{
		Type:         QuestionTypeChoice,
		Instructions: "intent",
		Options:      []string{"search_logs", "get_clusters"},
	}
	res, err := onnxEng.Predict(ctx, q, "search logs for errors")
	if err != nil {
		t.Fatalf("Predict returned error: %v", err)
	}
	if res.SelectedLabel != "search_logs" {
		t.Errorf("expected 'search_logs', got %q", res.SelectedLabel)
	}
}

// TestDecisionResult_Clone tests deep cloning.
func TestDecisionResult_Clone(t *testing.T) {
	orig := &DecisionResult{
		QuestionType:  QuestionTypeChoice,
		Labels:        []string{"a", "b"},
		Probabilities: []float32{0.4, 0.6},
		SelectedLabel: "b",
		SelectedScore: 0.6,
		Confidence:    0.6,
	}

	cloned := orig.Clone()
	if cloned == nil {
		t.Fatalf("Clone returned nil")
	}

	cloned.Labels[0] = "mutated"
	cloned.Probabilities[0] = 0.99

	if orig.Labels[0] == "mutated" {
		t.Errorf("mutating clone modified original labels")
	}
	if orig.Probabilities[0] == 0.99 {
		t.Errorf("mutating clone modified original probabilities")
	}

	var nilResult *DecisionResult
	if nilResult.Clone() != nil {
		t.Errorf("expected nil for nilResult.Clone()")
	}
}
