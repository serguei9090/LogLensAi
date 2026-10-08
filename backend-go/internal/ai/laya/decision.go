// Assume Role: The Backend Engineer (@backend)

package laya

import (
	"math"
	"strconv"
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
