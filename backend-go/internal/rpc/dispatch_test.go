package rpc

import (
	"encoding/json"
	"testing"

	"loglensai/backend-go/internal/models"
)

func newTestRegistry() *Registry {
	r := NewRegistry()
	RegisterStubs(r)
	return r
}

func TestRegisterStubsCoversAllMethods(t *testing.T) {
	r := newTestRegistry()
	if got, want := r.Len(), 68; got != want {
		t.Fatalf("registered method count = %d, want %d", got, want)
	}
	for _, m := range allMethods {
		if !r.Has(m) {
			t.Errorf("method %q from allMethods was not registered", m)
		}
	}
}

func TestDispatchMethodNotFound(t *testing.T) {
	r := newTestRegistry()
	resp := r.Dispatch(models.JSONRPCRequest{JSONRPC: "2.0", ID: 1, Method: "does_not_exist"})
	if resp.Error == nil {
		t.Fatal("expected an error response, got none")
	}
	if resp.Error.Code != CodeMethodNotFound {
		t.Errorf("code = %d, want %d", resp.Error.Code, CodeMethodNotFound)
	}
	if resp.Result != nil {
		t.Errorf("result should be nil on error, got %v", resp.Result)
	}
	if resp.ID != 1 {
		t.Errorf("id = %v, want 1 (id must be echoed back)", resp.ID)
	}
}

func TestDispatchInvalidParams(t *testing.T) {
	r := newTestRegistry()
	// get_logs requires an object; sending a JSON array must fail to decode
	// into GetLogsRequest and come back as -32602.
	resp := r.Dispatch(models.JSONRPCRequest{
		JSONRPC: "2.0",
		ID:      "abc",
		Method:  "get_logs",
		Params:  json.RawMessage(`[1,2,3]`),
	})
	if resp.Error == nil {
		t.Fatal("expected an error response, got none")
	}
	if resp.Error.Code != CodeInvalidParams {
		t.Errorf("code = %d, want %d", resp.Error.Code, CodeInvalidParams)
	}
	if resp.ID != "abc" {
		t.Errorf("id = %v, want \"abc\"", resp.ID)
	}
}

func TestDispatchStubMethodSuccess(t *testing.T) {
	r := newTestRegistry()
	resp := r.Dispatch(models.JSONRPCRequest{
		JSONRPC: "2.0",
		ID:      42,
		Method:  "get_health",
		Params:  json.RawMessage(`{}`),
	})
	if resp.Error != nil {
		t.Fatalf("unexpected error: %+v", resp.Error)
	}
	m, ok := resp.Result.(map[string]any)
	if !ok {
		t.Fatalf("result type = %T, want map[string]any", resp.Result)
	}
	if m["status"] != "not_implemented" {
		t.Errorf("status = %v, want not_implemented", m["status"])
	}
	if resp.ID != 42 {
		t.Errorf("id = %v, want 42", resp.ID)
	}
}

func TestDispatchStubWithValidParams(t *testing.T) {
	r := newTestRegistry()
	resp := r.Dispatch(models.JSONRPCRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "get_logs",
		Params:  json.RawMessage(`{"workspace_id":"ws1","offset":0,"limit":50}`),
	})
	if resp.Error != nil {
		t.Fatalf("unexpected error: %+v", resp.Error)
	}
}

func TestDispatchMethodWithoutModelPassesRawParams(t *testing.T) {
	r := newTestRegistry()
	// get_health has no params model (mirrors RPC_MODELS["get_health"] = None);
	// arbitrary params must not be rejected.
	resp := r.Dispatch(models.JSONRPCRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "get_health",
		Params:  json.RawMessage(`{"whatever":"you want"}`),
	})
	if resp.Error != nil {
		t.Fatalf("unexpected error for unvalidated method: %+v", resp.Error)
	}
}

func TestDispatchRecoversHandlerPanic(t *testing.T) {
	r := NewRegistry()
	r.Register("boom", func(params json.RawMessage) (any, *models.RPCError) {
		panic("kaboom")
	})
	resp := r.Dispatch(models.JSONRPCRequest{JSONRPC: "2.0", ID: 7, Method: "boom"})
	if resp.Error == nil {
		t.Fatal("expected panic to be converted into an error response")
	}
	if resp.Error.Code != CodeInternalError {
		t.Errorf("code = %d, want %d", resp.Error.Code, CodeInternalError)
	}
	if resp.ID != 7 {
		t.Errorf("id = %v, want 7", resp.ID)
	}
}

func TestDispatchHandlerReturnedError(t *testing.T) {
	r := NewRegistry()
	r.Register("fails", func(params json.RawMessage) (any, *models.RPCError) {
		return nil, &models.RPCError{Code: CodeInternalError, Message: "boom"}
	})
	resp := r.Dispatch(models.JSONRPCRequest{JSONRPC: "2.0", ID: 1, Method: "fails"})
	if resp.Error == nil || resp.Error.Message != "boom" {
		t.Fatalf("expected handler error to propagate, got %+v", resp.Error)
	}
}

func TestDispatchEmptyParamsTreatedAsEmptyObject(t *testing.T) {
	r := newTestRegistry()
	// get_settings has all-optional fields; nil Params must decode cleanly.
	resp := r.Dispatch(models.JSONRPCRequest{JSONRPC: "2.0", ID: 1, Method: "get_settings"})
	if resp.Error != nil {
		t.Fatalf("unexpected error with nil params: %+v", resp.Error)
	}
}
