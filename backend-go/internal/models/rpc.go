// Package models contains the JSON-RPC envelope types and all request/response
// structs used by the LogLensAi sidecar RPC surface. Field names and JSON tags
// mirror sidecar/src/models.py and api.py exactly (snake_case wire format) so
// the Go backend is a drop-in replacement for the Python sidecar.
package models

import "encoding/json"

// JSONRPCRequest is the envelope for an incoming JSON-RPC 2.0 request.
// Mirrors models.py JSONRPCRequest.
type JSONRPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      any             `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

// RPCError mirrors the {"code", "message", "data"} error object the Python
// sidecar emits (JSON-RPC 2.0 + custom codes used by api.py).
type RPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

// JSONRPCResponse is the envelope for an outgoing JSON-RPC 2.0 response.
// Mirrors models.py JSONRPCResponse.
type JSONRPCResponse struct {
	JSONRPC string    `json:"jsonrpc"`
	ID      any       `json:"id"`
	Result  any       `json:"result,omitempty"`
	Error   *RPCError `json:"error,omitempty"`
}

// NewResponse builds a successful JSON-RPC response for the given request id.
func NewResponse(id any, result any) JSONRPCResponse {
	return JSONRPCResponse{JSONRPC: "2.0", ID: id, Result: result}
}

// NewErrorResponse builds an error JSON-RPC response for the given request id.
func NewErrorResponse(id any, err *RPCError) JSONRPCResponse {
	return JSONRPCResponse{JSONRPC: "2.0", ID: id, Error: err}
}
