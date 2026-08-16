package rpc

import (
	"encoding/json"
	"testing"

	"loglensai/backend-go/internal/models"
)

// dispatchOK is a small helper that dispatches req against reg and fails the
// test immediately if the response carries an RPC error.
func dispatchOK(t *testing.T, reg *Registry, method string, params any, id int) any {
	t.Helper()
	raw, err := json.Marshal(params)
	if err != nil {
		t.Fatalf("marshaling params for %s: %v", method, err)
	}
	resp := reg.Dispatch(models.JSONRPCRequest{JSONRPC: "2.0", ID: id, Method: method, Params: raw})
	if resp.Error != nil {
		t.Fatalf("%s returned error: %+v", method, resp.Error)
	}
	return resp.Result
}

func newSettingsTestRegistry(t *testing.T) (*Registry, func()) {
	t.Helper()
	a := newTestApp(t)
	reg := NewRegistry()
	RegisterStubs(reg)
	RegisterSettingsMethods(reg, a)
	return reg, func() {}
}

func TestGetSettings_GlobalOnly(t *testing.T) {
	reg, _ := newSettingsTestRegistry(t)

	// A fresh in-memory DB seeds default global settings (mirrors db.py's
	// default-settings seed) -- just assert the call succeeds and returns a
	// map, without hard-coding the default keys/values here.
	result := dispatchOK(t, reg, "get_settings", map[string]any{}, 1)
	if _, ok := result.(map[string]string); !ok {
		t.Fatalf("expected map[string]string result, got %T: %+v", result, result)
	}
}

func TestUpdateSettings_GlobalRoundTrip(t *testing.T) {
	reg, _ := newSettingsTestRegistry(t)

	updateResult := dispatchOK(t, reg, "update_settings", models.UpdateSettingsRequest{
		Settings: map[string]any{
			"ai_model":     "gpt-5",
			"ai_max_calls": float64(7),
			"ai_enabled":   true,
			"ai_masks":     []any{"a", "b"},
		},
	}, 1)
	status, _ := updateResult.(map[string]any)["status"].(string)
	if status != "success" {
		t.Fatalf("update_settings status = %q, want %q", status, "success")
	}

	got := dispatchOK(t, reg, "get_settings", map[string]any{}, 2).(map[string]string)
	if got["ai_model"] != "gpt-5" {
		t.Errorf("ai_model = %v, want gpt-5", got["ai_model"])
	}
	if got["ai_max_calls"] != "7" {
		t.Errorf("ai_max_calls = %v, want \"7\" (whole float rendered without decimal)", got["ai_max_calls"])
	}
	if got["ai_enabled"] != "True" {
		t.Errorf("ai_enabled = %v, want \"True\" (Python str(bool) parity)", got["ai_enabled"])
	}
	if got["ai_masks"] != `["a","b"]` {
		t.Errorf("ai_masks = %v, want JSON-encoded list", got["ai_masks"])
	}

	// Update again to prove the ON CONFLICT upsert path (not just insert).
	dispatchOK(t, reg, "update_settings", models.UpdateSettingsRequest{
		Settings: map[string]any{"ai_model": "gpt-6"},
	}, 3)
	got2 := dispatchOK(t, reg, "get_settings", map[string]any{}, 4).(map[string]string)
	if got2["ai_model"] != "gpt-6" {
		t.Errorf("ai_model after second update = %v, want gpt-6", got2["ai_model"])
	}
}

func TestUpdateSettings_WorkspaceOverridesGlobal(t *testing.T) {
	reg, _ := newSettingsTestRegistry(t)
	ws := "ws1"

	dispatchOK(t, reg, "update_settings", models.UpdateSettingsRequest{
		Settings: map[string]any{"theme": "dark"},
	}, 1)
	dispatchOK(t, reg, "update_settings", models.UpdateSettingsRequest{
		Settings:    map[string]any{"theme": "light"},
		WorkspaceID: &ws,
	}, 2)

	// Global view: unaffected by the workspace override.
	global := dispatchOK(t, reg, "get_settings", map[string]any{}, 3).(map[string]string)
	if global["theme"] != "dark" {
		t.Errorf("global theme = %v, want dark", global["theme"])
	}

	// Workspace-scoped view: workspace value wins.
	scoped := dispatchOK(t, reg, "get_settings", map[string]any{"workspace_id": ws}, 4).(map[string]string)
	if scoped["theme"] != "light" {
		t.Errorf("workspace-scoped theme = %v, want light (workspace override should win)", scoped["theme"])
	}
}

func TestResetWorkspaceSettings(t *testing.T) {
	reg, _ := newSettingsTestRegistry(t)
	ws := "ws1"

	dispatchOK(t, reg, "update_settings", models.UpdateSettingsRequest{
		Settings:    map[string]any{"theme": "light"},
		WorkspaceID: &ws,
	}, 1)
	scoped := dispatchOK(t, reg, "get_settings", map[string]any{"workspace_id": ws}, 2).(map[string]string)
	if scoped["theme"] != "light" {
		t.Fatalf("precondition failed: workspace theme = %v, want light", scoped["theme"])
	}

	resetResult := dispatchOK(t, reg, "reset_workspace_settings", map[string]any{"workspace_id": ws}, 3).(map[string]any)
	if resetResult["status"] != "ok" {
		t.Errorf("reset_workspace_settings status = %v, want ok", resetResult["status"])
	}

	after := dispatchOK(t, reg, "get_settings", map[string]any{"workspace_id": ws}, 4).(map[string]string)
	if _, present := after["theme"]; present {
		t.Errorf("theme still present after reset: %v", after["theme"])
	}
}

func TestResetWorkspaceSettings_RequiresWorkspaceID(t *testing.T) {
	reg, _ := newSettingsTestRegistry(t)

	result := dispatchOK(t, reg, "reset_workspace_settings", map[string]any{}, 1).(map[string]any)
	if result["status"] != "error" {
		t.Errorf("status = %v, want error when workspace_id is missing", result["status"])
	}
}

func TestTemplates_SaveGetDelete(t *testing.T) {
	reg, _ := newSettingsTestRegistry(t)
	ws := "ws1"

	saveResult := dispatchOK(t, reg, "save_template", map[string]any{
		"workspace_id": ws, "name": "errors-only", "config_json": `{"filters":[]}`,
	}, 1).(map[string]any)
	if saveResult["status"] != "ok" {
		t.Fatalf("save_template status = %v, want ok", saveResult["status"])
	}

	list := dispatchOK(t, reg, "get_templates", map[string]any{"workspace_id": ws}, 2).([]map[string]any)
	if len(list) != 1 {
		t.Fatalf("expected 1 template, got %d: %+v", len(list), list)
	}
	if list[0]["name"] != "errors-only" {
		t.Errorf("template name = %v, want errors-only", list[0]["name"])
	}
	if list[0]["config"] != `{"filters":[]}` {
		t.Errorf("template config = %v", list[0]["config"])
	}
	id, ok := list[0]["id"].(int64)
	if !ok {
		t.Fatalf("template id not int64: %T %v", list[0]["id"], list[0]["id"])
	}

	// Different workspace should not see it.
	otherList := dispatchOK(t, reg, "get_templates", map[string]any{"workspace_id": "ws2"}, 3).([]map[string]any)
	if len(otherList) != 0 {
		t.Errorf("expected 0 templates for ws2, got %d", len(otherList))
	}

	delResult := dispatchOK(t, reg, "delete_template", map[string]any{"id": id}, 4).(map[string]any)
	if delResult["status"] != "ok" {
		t.Errorf("delete_template status = %v, want ok", delResult["status"])
	}
	afterDelete := dispatchOK(t, reg, "get_templates", map[string]any{"workspace_id": ws}, 5).([]map[string]any)
	if len(afterDelete) != 0 {
		t.Errorf("expected 0 templates after delete, got %d", len(afterDelete))
	}
}

func TestResetTemplates_ClearsDrainState(t *testing.T) {
	reg, _ := newSettingsTestRegistry(t)

	// reset_templates resets Drain3 clustering state (not the
	// settings_templates table -- matches Python's method_reset_templates,
	// see handlers_settings.go's doc comment). With no prior clustering
	// activity there's no miner cache or state file yet; the call should
	// still succeed cleanly (mirrors Python's os.path.exists guard).
	result := dispatchOK(t, reg, "reset_templates", map[string]any{"workspace_id": "ws1"}, 1).(map[string]any)
	if result["status"] != "success" {
		t.Errorf("reset_templates status = %v, want success", result["status"])
	}
	if result["scope"] != "global" {
		t.Errorf("reset_templates scope = %v, want global (default drain_template_scope)", result["scope"])
	}
}

func TestLogStreams_CreateGetDelete(t *testing.T) {
	reg, _ := newSettingsTestRegistry(t)
	ws := "ws1"

	createResult := dispatchOK(t, reg, "create_log_stream", models.CreateLogStreamRequest{
		WorkspaceID: ws, Name: "syslog-in", Type: "syslog", Port: 5514,
	}, 1).(map[string]any)
	if createResult["status"] != "success" {
		t.Fatalf("create_log_stream status = %v, want success", createResult["status"])
	}

	list := dispatchOK(t, reg, "get_log_streams", models.GetLogStreamsRequest{WorkspaceID: ws}, 2).([]map[string]any)
	if len(list) != 1 {
		t.Fatalf("expected 1 log stream, got %d: %+v", len(list), list)
	}
	if list[0]["name"] != "syslog-in" || list[0]["type"] != "syslog" {
		t.Errorf("unexpected stream row: %+v", list[0])
	}
	port, ok := list[0]["port"].(int64)
	if !ok || port != 5514 {
		t.Errorf("port = %v (%T), want int64(5514)", list[0]["port"], list[0]["port"])
	}
	if list[0]["enabled"] != true {
		t.Errorf("enabled = %v, want true (schema default)", list[0]["enabled"])
	}
	id, ok := list[0]["id"].(int64)
	if !ok {
		t.Fatalf("stream id not int64: %T %v", list[0]["id"], list[0]["id"])
	}

	delResult := dispatchOK(t, reg, "delete_log_stream", models.DeleteLogStreamRequest{ID: int(id)}, 3).(map[string]any)
	if delResult["status"] != "success" {
		t.Errorf("delete_log_stream status = %v, want success", delResult["status"])
	}
	afterDelete := dispatchOK(t, reg, "get_log_streams", models.GetLogStreamsRequest{WorkspaceID: ws}, 4).([]map[string]any)
	if len(afterDelete) != 0 {
		t.Errorf("expected 0 log streams after delete, got %d", len(afterDelete))
	}
}

func TestTemporalOffsets_UpdateAndGet(t *testing.T) {
	reg, _ := newSettingsTestRegistry(t)
	ws := "ws1"

	updateResult := dispatchOK(t, reg, "update_temporal_offsets", models.UpdateTemporalOffsetsRequest{
		WorkspaceID: ws,
		Offsets:     map[string]int{"source-a": 3600, "source-b": -1800},
	}, 1).(map[string]any)
	if updateResult["status"] != "ok" {
		t.Fatalf("update_temporal_offsets status = %v, want ok", updateResult["status"])
	}

	got := dispatchOK(t, reg, "get_temporal_offsets", models.GetTemporalOffsetsRequest{WorkspaceID: ws}, 2).(map[string]any)
	offsets, ok := got["offsets"].(map[string]int64)
	if !ok {
		t.Fatalf("offsets not map[string]int64: %T %v", got["offsets"], got["offsets"])
	}
	if offsets["source-a"] != 3600 {
		t.Errorf("source-a offset = %d, want 3600", offsets["source-a"])
	}
	if offsets["source-b"] != -1800 {
		t.Errorf("source-b offset = %d, want -1800", offsets["source-b"])
	}

	// Upsert path: updating the same source_id again should overwrite, not duplicate.
	dispatchOK(t, reg, "update_temporal_offsets", models.UpdateTemporalOffsetsRequest{
		WorkspaceID: ws,
		Offsets:     map[string]int{"source-a": 100},
	}, 3)
	got2 := dispatchOK(t, reg, "get_temporal_offsets", models.GetTemporalOffsetsRequest{WorkspaceID: ws}, 4).(map[string]any)
	offsets2 := got2["offsets"].(map[string]int64)
	if len(offsets2) != 2 {
		t.Errorf("expected 2 offsets after upsert (source-a, source-b), got %d: %+v", len(offsets2), offsets2)
	}
	if offsets2["source-a"] != 100 {
		t.Errorf("source-a offset after upsert = %d, want 100", offsets2["source-a"])
	}
}

func TestSettingsMethods_RegisteredWiring(t *testing.T) {
	reg, _ := newSettingsTestRegistry(t)

	methods := []string{
		"get_settings", "update_settings", "reset_workspace_settings",
		"save_template", "get_templates", "delete_template", "reset_templates",
		"get_log_streams", "create_log_stream", "delete_log_stream",
		"update_temporal_offsets", "get_temporal_offsets",
	}
	for _, m := range methods {
		if !reg.Has(m) {
			t.Errorf("method %q not registered", m)
		}
	}
}
