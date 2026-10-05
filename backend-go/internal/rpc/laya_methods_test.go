// Assume Role: The Backend Engineer (@backend)

package rpc

import (
	"encoding/json"
	"path/filepath"
	"testing"

	"loglensai/backend-go/internal/ai/laya"
	"loglensai/backend-go/internal/app"
	"loglensai/backend-go/internal/models"
)

func newLayaRPCTestApp(t *testing.T) *app.App {
	t.Helper()
	a, err := app.NewApp(filepath.Join(t.TempDir(), "test.duckdb"))
	if err != nil {
		t.Fatalf("app.NewApp: %v", err)
	}
	t.Cleanup(func() { _ = a.Close() })
	return a
}

func TestRegisterApp_LayaMethodsDispatchEndToEnd(t *testing.T) {
	a := newLayaRPCTestApp(t)

	reg := NewRegistry()
	RegisterStubs(reg)
	RegisterApp(reg, a)

	layaMethods := []string{
		"get_laya_settings",
		"update_laya_settings",
		"get_laya_checkpoints",
		"rollback_laya_checkpoint",
		"save_laya_rules",
		"test_laya_rule",
	}

	for _, method := range layaMethods {
		if !reg.Has(method) {
			t.Errorf("expected method %q to be registered in Registry", method)
		}
	}

	// 1. get_laya_settings dispatch
	getParams, _ := json.Marshal(models.GetLayaSettingsRequest{})
	resp := reg.Dispatch(models.JSONRPCRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "get_laya_settings",
		Params:  getParams,
	})
	if resp.Error != nil {
		t.Fatalf("get_laya_settings dispatch error: %+v", resp.Error)
	}
	settings, ok := resp.Result.(laya.LayaSettings)
	if !ok {
		t.Fatalf("expected laya.LayaSettings, got %T", resp.Result)
	}
	if settings.ActiveCheckpoint != "chk_init" {
		t.Errorf("expected active checkpoint 'chk_init', got %q", settings.ActiveCheckpoint)
	}

	// 2. update_laya_settings dispatch
	enabledTrue := true
	deviceGPU := "gpu"
	updateParams, _ := json.Marshal(models.UpdateLayaSettingsRequest{
		Enabled: &enabledTrue,
		Device:  &deviceGPU,
	})
	resp = reg.Dispatch(models.JSONRPCRequest{
		JSONRPC: "2.0",
		ID:      2,
		Method:  "update_laya_settings",
		Params:  updateParams,
	})
	if resp.Error != nil {
		t.Fatalf("update_laya_settings dispatch error: %+v", resp.Error)
	}
	switch v := resp.Result.(type) {
	case laya.LayaSettings:
		if !v.Enabled || v.Device != "gpu" {
			t.Fatalf("unexpected update_laya_settings result: %+v", v)
		}
	case map[string]any:
		if v["enabled"] != true || v["device"] != "gpu" {
			t.Fatalf("unexpected update_laya_settings result: %+v", v)
		}
	default:
		t.Fatalf("unexpected update_laya_settings result type %T: %+v", resp.Result, resp.Result)
	}

	// 3. get_laya_checkpoints dispatch
	resp = reg.Dispatch(models.JSONRPCRequest{
		JSONRPC: "2.0",
		ID:      3,
		Method:  "get_laya_checkpoints",
		Params:  json.RawMessage(`{}`),
	})
	if resp.Error != nil {
		t.Fatalf("get_laya_checkpoints dispatch error: %+v", resp.Error)
	}
	cps, ok := resp.Result.([]laya.Checkpoint)
	if !ok || len(cps) == 0 {
		t.Fatalf("expected []laya.Checkpoint, got %T (%+v)", resp.Result, resp.Result)
	}

	// 4. save_laya_rules dispatch
	customQuestions := map[string]laya.Question{
		"urgent_flag": {
			Type:         laya.QuestionTypeNoul,
			Instructions: "Is this event urgent?",
		},
	}
	saveParams, _ := json.Marshal(models.SaveLayaRulesRequest{
		Author:      "QA Engineer",
		Description: "Smoke test rules",
		Questions:   customQuestions,
	})
	resp = reg.Dispatch(models.JSONRPCRequest{
		JSONRPC: "2.0",
		ID:      4,
		Method:  "save_laya_rules",
		Params:  saveParams,
	})
	if resp.Error != nil {
		t.Fatalf("save_laya_rules dispatch error: %+v", resp.Error)
	}
	savedCP, ok := resp.Result.(*laya.Checkpoint)
	if !ok || savedCP.Author != "QA Engineer" {
		t.Fatalf("unexpected save_laya_rules result: %+v", resp.Result)
	}

	// 5. rollback_laya_checkpoint dispatch
	rollbackParams, _ := json.Marshal(models.RollbackLayaCheckpointRequest{
		CheckpointID: "chk_init",
	})
	resp = reg.Dispatch(models.JSONRPCRequest{
		JSONRPC: "2.0",
		ID:      5,
		Method:  "rollback_laya_checkpoint",
		Params:  rollbackParams,
	})
	if resp.Error != nil {
		t.Fatalf("rollback_laya_checkpoint dispatch error: %+v", resp.Error)
	}
	rbMap, ok := resp.Result.(map[string]any)
	if !ok || rbMap["status"] != "success" || rbMap["active_checkpoint"] != "chk_init" {
		t.Fatalf("unexpected rollback_laya_checkpoint result: %+v", resp.Result)
	}

	// 6. test_laya_rule dispatch
	qName := "severity"
	testParams, _ := json.Marshal(models.TestLayaRuleRequest{
		StateText:    "FATAL EXCEPTION: out of memory",
		QuestionName: &qName,
	})
	resp = reg.Dispatch(models.JSONRPCRequest{
		JSONRPC: "2.0",
		ID:      6,
		Method:  "test_laya_rule",
		Params:  testParams,
	})
	if resp.Error != nil {
		t.Fatalf("test_laya_rule dispatch error: %+v", resp.Error)
	}
	dec, ok := resp.Result.(*laya.DecisionResult)
	if !ok || dec.Confidence <= 0 {
		t.Fatalf("unexpected test_laya_rule result: %+v", resp.Result)
	}

	// 7. Invalid parameters shape returns CodeInvalidParams (-32602)
	badResp := reg.Dispatch(models.JSONRPCRequest{
		JSONRPC: "2.0",
		ID:      7,
		Method:  "update_laya_settings",
		Params:  json.RawMessage(`["not", "an", "object"]`),
	})
	if badResp.Error == nil || badResp.Error.Code != CodeInvalidParams {
		t.Fatalf("expected CodeInvalidParams for array params, got: %+v", badResp.Error)
	}
}
