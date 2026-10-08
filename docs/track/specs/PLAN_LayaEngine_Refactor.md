# Refactoring Plan: Decompose `backend-go/internal/ai/laya/engine.go` (756 lines)

## 1. Context & Motivation
- **File**: `backend-go/internal/ai/laya/engine.go` (756 lines)
- **Goal**: Decompose into cohesive domain modules under `backend-go/internal/ai/laya/` adhering to the Backend 400–500 line limit.
- **Problem**: `engine.go` bundles 3 distinct concerns:
  1. Math, decision scoring & result calculation (`DecisionResult`, `Softmax`, `ComputeDecisionResult`, `ComputeDecision`).
  2. Mock/heuristic decision engine (`MockEngine`, `mockPredictQuestion`, keyword heuristics, option boosting).
  3. Production ONNX runtime engine orchestration (`ONNXEngine`, sequence building, mask embedding extraction, device switching, file path resolution, and default vocabularies).

---

## 2. Target File Structure (`backend-go/internal/ai/laya/`)

```
backend-go/internal/ai/laya/
├── decision.go     (~175 lines) - DecisionResult, Softmax, ComputeDecisionResult, ComputeDecision
├── mock_engine.go  (~245 lines) - MockEngine, mockPredictQuestion, rule-based heuristics & boosting
├── engine.go       (~280 lines) - Engine interface, ONNXEngine, Predict, PredictBatch, Close, path resolution
├── engine_onnx.go  (147 lines)  - (Existing) realONNXRunner cgo session execution
└── engine_nocgo.go (12 lines)   - (Existing) non-cgo fallback stub
```

---

## 3. Sub-Module Responsibilities
1. **`decision.go`**:
   - `DecisionResult` struct and `Clone()`.
   - `Softmax` calculation with temperature and numerical stability.
   - `ComputeDecisionResult` and `ComputeDecision` logic across Choice, Score, and Noul questions.
2. **`mock_engine.go`**:
   - `MockEngine` struct and state methods (`NewMockEngine`, `SetMockResponse`, `ClearMockResponses`, `Device`, `SetDevice`, `Close`).
   - `mockPredictQuestion` with keyword triage for categories, intents, severities, and outages.
   - Helpers: `containsAny`, `boostOption`, `absInt`.
3. **`engine.go`**:
   - `Engine` interface.
   - `ONNXEngineConfig`, `onnxSessionRunner` interface.
   - `ONNXEngine` struct and methods (`NewONNXEngine`, `Device`, `IsSimulated`, `SetDevice`, `Predict`, `PredictBatch`, `Close`).
   - Helpers: `fileExists`, `resolveSharedLibPath`, `makeDefaultVocab`.

---

## 4. Verification Plan
1. Ensure all files remain in `package laya`.
2. Run `go vet ./...` in `backend-go/`.
3. Run `go test ./...` in `backend-go/`.
4. Update `docs/track/CodeDebt_Monolith_Refactor.md`.
