package rpc

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"loglensai/backend-go/internal/models"
)

func TestHTTPHandlerRPCRoundTrip(t *testing.T) {
	r := newTestRegistry()
	srv := httptest.NewServer(NewHTTPHandler(r))
	defer srv.Close()

	body := []byte(`{"jsonrpc":"2.0","id":1,"method":"get_health","params":{}}`)
	resp, err := http.Post(srv.URL+"/rpc", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("POST /rpc failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	if got := resp.Header.Get("Access-Control-Allow-Origin"); got != "*" {
		t.Errorf("Access-Control-Allow-Origin = %q, want \"*\"", got)
	}

	var decoded models.JSONRPCResponse
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if decoded.Error != nil {
		t.Fatalf("unexpected error: %+v", decoded.Error)
	}
	// JSON numbers decode as float64 in Go's encoding/json.
	if idFloat, ok := decoded.ID.(float64); !ok || idFloat != 1 {
		t.Errorf("id = %v (%T), want 1", decoded.ID, decoded.ID)
	}
}

func TestHTTPHandlerMalformedJSONBody(t *testing.T) {
	r := newTestRegistry()
	srv := httptest.NewServer(NewHTTPHandler(r))
	defer srv.Close()

	resp, err := http.Post(srv.URL+"/rpc", "application/json", bytes.NewReader([]byte(`{not valid json`)))
	if err != nil {
		t.Fatalf("POST /rpc failed: %v", err)
	}
	defer resp.Body.Close()

	// Mirrors aiohttp_handler: a JSON decode failure is caught by the
	// generic `except Exception` branch -> 500 / -32603, not -32600.
	if resp.StatusCode != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", resp.StatusCode)
	}
	var decoded models.JSONRPCResponse
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
		t.Fatalf("failed to decode error response: %v", err)
	}
	if decoded.Error == nil || decoded.Error.Code != CodeInternalError {
		t.Fatalf("error = %+v, want code %d", decoded.Error, CodeInternalError)
	}
}

func TestHTTPHandlerMissingMethodField(t *testing.T) {
	r := newTestRegistry()
	srv := httptest.NewServer(NewHTTPHandler(r))
	defer srv.Close()

	// Valid JSON, but missing the required "method" field -> shape/validation
	// error, mirrored as -32600/400 (Python: pydantic ValidationError).
	resp, err := http.Post(srv.URL+"/rpc", "application/json", bytes.NewReader([]byte(`{"jsonrpc":"2.0","id":1}`)))
	if err != nil {
		t.Fatalf("POST /rpc failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", resp.StatusCode)
	}
	var decoded models.JSONRPCResponse
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
		t.Fatalf("failed to decode error response: %v", err)
	}
	if decoded.Error == nil || decoded.Error.Code != CodeInvalidRequest {
		t.Fatalf("error = %+v, want code %d", decoded.Error, CodeInvalidRequest)
	}
}

func TestHTTPHandlerMethodNotFound(t *testing.T) {
	r := newTestRegistry()
	srv := httptest.NewServer(NewHTTPHandler(r))
	defer srv.Close()

	body := []byte(`{"jsonrpc":"2.0","id":5,"method":"nope"}`)
	resp, err := http.Post(srv.URL+"/rpc", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("POST /rpc failed: %v", err)
	}
	defer resp.Body.Close()

	var decoded models.JSONRPCResponse
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if decoded.Error == nil || decoded.Error.Code != CodeMethodNotFound {
		t.Fatalf("error = %+v, want code %d", decoded.Error, CodeMethodNotFound)
	}
}
