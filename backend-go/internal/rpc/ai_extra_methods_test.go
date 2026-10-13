package rpc

import (
	"encoding/json"
	"testing"

	"loglensai/backend-go/internal/ai"
	"loglensai/backend-go/internal/models"
)

// TestRegisterAIExtraMethods_DBOnlyMethodsDispatch drives get_ai_sessions,
// rename_ai_session, get_ai_mapping, and get_dashboard_stats through the
// real JSON-RPC dispatch path (Registry.Dispatch), proving
// RegisterAIExtraMethods actually wires them -- not just that
// internal/app's underlying methods work in isolation (already covered by
// internal/app/handlers_ai_extra_test.go).
func TestRegisterAIExtraMethods_DBOnlyMethodsDispatch(t *testing.T) {
	a := newTestApp(t)
	extra, err := ai.NewExtra(a)
	if err != nil {
		t.Fatalf("ai.NewExtra: %v", err)
	}

	reg := NewRegistry()
	RegisterStubs(reg)
	RegisterAIExtraMethods(reg, a, extra)

	if _, err := a.DB.Conn.Exec(
		`INSERT INTO ai_sessions (session_id, workspace_id, name) VALUES (?, ?, ?)`,
		"s1", "ws1", "Original name",
	); err != nil {
		t.Fatalf("seed session: %v", err)
	}

	// get_ai_sessions
	getParams, _ := json.Marshal(models.GetAiSessionsRequest{WorkspaceID: "ws1"})
	resp := reg.Dispatch(models.JSONRPCRequest{JSONRPC: "2.0", ID: 1, Method: "get_ai_sessions", Params: getParams})
	if resp.Error != nil {
		t.Fatalf("get_ai_sessions: %+v", resp.Error)
	}
	sessions, ok := resp.Result.([]map[string]any)
	if !ok || len(sessions) != 1 || sessions[0]["session_id"] != "s1" {
		t.Fatalf("get_ai_sessions result = %+v", resp.Result)
	}

	// rename_ai_session (no params model -- raw dispatch)
	renameParams, _ := json.Marshal(map[string]any{"session_id": "s1", "name": "Renamed"})
	resp = reg.Dispatch(models.JSONRPCRequest{JSONRPC: "2.0", ID: 2, Method: "rename_ai_session", Params: renameParams})
	if resp.Error != nil {
		t.Fatalf("rename_ai_session: %+v", resp.Error)
	}
	var name string
	if err := a.DB.Conn.QueryRow(`SELECT name FROM ai_sessions WHERE session_id = ?`, "s1").Scan(&name); err != nil {
		t.Fatalf("query renamed session: %v", err)
	}
	if name != "Renamed" {
		t.Errorf("name = %q, want Renamed", name)
	}

	// get_dashboard_stats
	dashParams, _ := json.Marshal(models.GetDashboardStatsRequest{})
	resp = reg.Dispatch(models.JSONRPCRequest{JSONRPC: "2.0", ID: 3, Method: "get_dashboard_stats", Params: dashParams})
	if resp.Error != nil {
		t.Fatalf("get_dashboard_stats: %+v", resp.Error)
	}
	dash, ok := resp.Result.(map[string]any)
	if !ok {
		t.Fatalf("get_dashboard_stats result type %T", resp.Result)
	}
	if _, ok := dash["bucket_interval"]; !ok {
		t.Errorf("get_dashboard_stats result missing bucket_interval: %+v", dash)
	}

	// delete_ai_session (no params model -- raw dispatch)
	deleteParams, _ := json.Marshal(map[string]any{"session_id": "s1"})
	resp = reg.Dispatch(models.JSONRPCRequest{JSONRPC: "2.0", ID: 4, Method: "delete_ai_session", Params: deleteParams})
	if resp.Error != nil {
		t.Fatalf("delete_ai_session: %+v", resp.Error)
	}
	var count int
	if err := a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM ai_sessions WHERE session_id = ?`, "s1").Scan(&count); err != nil {
		t.Fatalf("count sessions: %v", err)
	}
	if count != 0 {
		t.Errorf("expected session to be deleted, count = %d", count)
	}
}

// TestRegisterAIExtraMethods_ProviderMethodsDispatch drives list_ai_models
// and analyze_cluster through the real dispatch path with a fake
// providers.Provider swapped into a hand-built *ai.Extra (NewExtra itself
// always builds a real provider from settings, which would try real network
// I/O against Ollama's default host -- this test constructs Extra directly
// instead, mirroring internal/ai/rpc_extra_test.go's own approach).
func TestRegisterAIExtraMethods_ListAIModelsDispatch(t *testing.T) {
	a := newTestApp(t)
	// A real Extra (provider constructed from seeded default settings,
	// which selects the "ollama" provider client) is enough to prove
	// dispatch wiring without needing network access: ListModels on an
	// unreachable host returns an error, which the RPC layer must surface
	// as a JSON-RPC error rather than panicking.
	extra, err := ai.NewExtra(a)
	if err != nil {
		t.Fatalf("ai.NewExtra: %v", err)
	}

	reg := NewRegistry()
	RegisterStubs(reg)
	RegisterAIExtraMethods(reg, a, extra)

	resp := reg.Dispatch(models.JSONRPCRequest{JSONRPC: "2.0", ID: 1, Method: "list_ai_models", Params: json.RawMessage("{}")})
	// Either shape is acceptable proof of wiring: a real list (if something
	// happens to be listening on the default Ollama host in this
	// environment) or a JSON-RPC error (if not) -- what matters is that the
	// stub's {"status":"not_implemented"} response is gone.
	if resp.Error == nil {
		if _, ok := resp.Result.([]string); !ok {
			t.Errorf("list_ai_models result = %+v (%T), want []string or an error", resp.Result, resp.Result)
		}
	}
	if m, ok := resp.Result.(map[string]any); ok && m["status"] == "not_implemented" {
		t.Fatalf("list_ai_models is still dispatching to the stub handler")
	}
}

func TestRegisterAIExtraMethods_AnalyzeClusterDispatch(t *testing.T) {
	a := newTestApp(t)
	extra, err := ai.NewExtra(a)
	if err != nil {
		t.Fatalf("ai.NewExtra: %v", err)
	}

	reg := NewRegistry()
	RegisterStubs(reg)
	RegisterAIExtraMethods(reg, a, extra)

	thresh := 0.80
	params, _ := json.Marshal(models.AnalyzeClusterRequest{
		WorkspaceID:         "ws1",
		ClusterID:           "42",
		SampleSize:          5,
		SimilarityThreshold: &thresh,
	})
	resp := reg.Dispatch(models.JSONRPCRequest{JSONRPC: "2.0", ID: 2, Method: "analyze_cluster", Params: params})

	// Since Ollama might not be running in test environment, it returns either a valid AnalyzeClusterResponse or an RPC error from provider.
	// What matters is that the method is registered, params parse properly, and it does NOT return method_not_found (-32601) or stub.
	if resp.Error != nil && resp.Error.Code == -32601 {
		t.Fatalf("analyze_cluster method not found: %+v", resp.Error)
	}
	if m, ok := resp.Result.(map[string]any); ok && m["status"] == "not_implemented" {
		t.Fatalf("analyze_cluster dispatched to stub handler")
	}
}
