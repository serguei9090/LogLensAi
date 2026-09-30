// Assume Role: The Backend Engineer (@backend)

package graph

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"loglensai/backend-go/internal/ai/laya"
	"loglensai/backend-go/internal/app"
)

func TestUpdateLayaRulesTool(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "laya_graph_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	rulePath := filepath.Join(tempDir, "laya_rules.json")
	rm, err := laya.NewRuleManager(rulePath)
	if err != nil {
		t.Fatalf("failed to init rule manager: %v", err)
	}

	appInstance := &app.App{
		LayaManager: rm,
		LayaEngine:  laya.NewMockEngine(),
	}

	reg := &ToolRegistry{
		app:     appInstance,
		tools:   make(map[string]ToolFunc),
		schemas: make(map[string]ToolSchema),
	}
	reg.registerBuiltins()

	// 1. Verify update_laya_rules is registered
	if !reg.Has("update_laya_rules") {
		t.Fatal("expected update_laya_rules to be registered in ToolRegistry")
	}

	// 2. Execute update_laya_rules tool call
	payload := map[string]any{
		"rationale":     "Refining database error categories",
		"question_name": "category",
		"type":          "choice",
		"instructions":  "Select the infrastructure component",
		"options":       []string{"database_deadlock", "network_timeout", "auth_failure"},
	}
	args, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal error: %v", err)
	}

	res, err := reg.Execute(context.Background(), "update_laya_rules", args)
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}

	resMap, ok := res.(map[string]any)
	if !ok {
		t.Fatalf("expected map[string]any result, got %T", res)
	}

	if resMap["status"] != "checkpoint_created" {
		t.Fatalf("expected status checkpoint_created, got %v", resMap["status"])
	}

	chkID, ok := resMap["checkpoint_id"].(string)
	if !ok || chkID == "" {
		t.Fatalf("expected valid checkpoint_id, got %v", resMap["checkpoint_id"])
	}

	// 3. Verify rule was updated in active questions
	activeQ := rm.GetActiveQuestions()
	catQ, exists := activeQ["category"]
	if !exists {
		t.Fatal("category question not found in active questions")
	}
	if len(catQ.Options) != 3 || catQ.Options[0] != "database_deadlock" {
		t.Fatalf("unexpected options in active category rule: %v", catQ.Options)
	}
}

func TestRouteWithLaya(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "laya_route_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	rulePath := filepath.Join(tempDir, "laya_rules.json")
	rm, err := laya.NewRuleManager(rulePath)
	if err != nil {
		t.Fatalf("failed to init rule manager: %v", err)
	}

	// Enabled = true
	if err := rm.UpdateSettings(true, "cpu"); err != nil {
		t.Fatalf("failed to update settings: %v", err)
	}

	mockEng := laya.NewMockEngine()
	appInstance := &app.App{
		LayaManager: rm,
		LayaEngine:  mockEng,
	}

	reg := &ToolRegistry{
		app:     appInstance,
		tools:   make(map[string]ToolFunc),
		schemas: make(map[string]ToolSchema),
	}

	// Route user query
	res, err := RouteWithLaya(context.Background(), reg, "search all logs for 500 error")
	if err != nil {
		t.Fatalf("RouteWithLaya failed: %v", err)
	}
	if res == nil {
		t.Fatal("expected non-nil DecisionResult from RouteWithLaya")
	}
	if res.SelectedLabel == "" {
		t.Fatal("expected non-empty SelectedLabel")
	}
	if res.Confidence <= 0 {
		t.Fatalf("expected positive confidence, got %f", res.Confidence)
	}

	// Test disabled state
	if err := rm.UpdateSettings(false, "cpu"); err != nil {
		t.Fatalf("failed to update settings: %v", err)
	}
	resDisabled, err := RouteWithLaya(context.Background(), reg, "search logs")
	if err != nil {
		t.Fatalf("RouteWithLaya failed when disabled: %v", err)
	}
	if resDisabled != nil {
		t.Fatalf("expected nil DecisionResult when Laya is disabled, got %v", resDisabled)
	}
}
