package rpc

import (
	"encoding/json"
	"path/filepath"
	"testing"

	"loglensai/backend-go/internal/app"
	"loglensai/backend-go/internal/models"
)

// newLogOpsRPCTestApp mirrors newTestApp (ai_methods_test.go, same package)
// but uses a temp-file DB rather than db.MemoryDB, since log_trace exercises
// a.DataDir()-relative file writes that would otherwise land under a
// relative "data/" directory next to the test binary.
func newLogOpsRPCTestApp(t *testing.T) *app.App {
	t.Helper()
	a, err := app.NewApp(filepath.Join(t.TempDir(), "test.duckdb"))
	if err != nil {
		t.Fatalf("app.NewApp: %v", err)
	}
	t.Cleanup(func() { _ = a.Close() })
	return a
}

// TestRegisterLogOpsMethods_DispatchEndToEnd verifies RegisterLogOpsMethods
// actually wires every method it claims to through the real Registry/Dispatch
// path (JSON param decode + optional paramModels validation gate), not just
// that the underlying *app.App methods work in isolation -- internal/app's
// own tests call those directly and never exercise this registration
// function or the JSON-RPC envelope at all.
func TestRegisterLogOpsMethods_DispatchEndToEnd(t *testing.T) {
	a := newLogOpsRPCTestApp(t)

	reg := NewRegistry()
	RegisterStubs(reg)
	RegisterLogOpsMethods(reg, a)

	for _, method := range []string{
		"delete_logs", "export_logs", "get_sample_lines", "update_source_parser",
		"get_fusion_config", "update_fusion_config", "get_fused_logs", "get_sample_logs",
		"update_log_comment", "read_file", "start_ssh_tail", "log_trace",
		"cleanup_ingestion_jobs", "get_ingestion_jobs", "get_log_distribution",
	} {
		if !reg.Has(method) {
			t.Errorf("method %q was not registered", method)
		}
	}

	// delete_logs: validated via paramModels["delete_logs"] (DeleteLogsRequest).
	params, _ := json.Marshal(models.DeleteLogsRequest{WorkspaceID: "ws-dispatch-test"})
	resp := reg.Dispatch(models.JSONRPCRequest{JSONRPC: "2.0", ID: 1, Method: "delete_logs", Params: params})
	if resp.Error != nil {
		t.Fatalf("delete_logs dispatch error: %+v", resp.Error)
	}
	m, ok := resp.Result.(map[string]any)
	if !ok || m["status"] != "success" {
		t.Fatalf("delete_logs result = %+v", resp.Result)
	}

	// get_sample_logs: no paramModels entry (matches Python having no
	// RPC_MODELS entry either) -- still must decode via Register + appHandler.
	params, _ = json.Marshal(models.GetSampleLogsRequest{WorkspaceID: "ws-dispatch-test", Limit: 5})
	resp = reg.Dispatch(models.JSONRPCRequest{JSONRPC: "2.0", ID: 2, Method: "get_sample_logs", Params: params})
	if resp.Error != nil {
		t.Fatalf("get_sample_logs dispatch error: %+v", resp.Error)
	}
	m, ok = resp.Result.(map[string]any)
	if !ok {
		t.Fatalf("get_sample_logs result type = %T", resp.Result)
	}
	if _, hasSamples := m["samples"]; !hasSamples {
		t.Errorf("get_sample_logs result missing 'samples' key: %+v", m)
	}

	// A malformed params payload on a paramModels-validated method must be
	// rejected with -32602 before the handler ever runs, exactly like every
	// other RegisterWithModel-wired method (see app_methods.go's doc
	// comment) -- confirms this registration reused the shared paramModels
	// map rather than skipping validation.
	resp = reg.Dispatch(models.JSONRPCRequest{JSONRPC: "2.0", ID: 3, Method: "delete_logs", Params: json.RawMessage(`{"workspace_id": 123}`)})
	if resp.Error == nil || resp.Error.Code != CodeInvalidParams {
		t.Fatalf("expected invalid-params error, got %+v", resp.Error)
	}
}
