// Package rpc implements the JSON-RPC 2.0 dispatch engine shared by the
// stdio and HTTP transports, mirroring sidecar/src/api.py's App.dispatch()
// and App.RPC_MODELS.
package rpc

import (
	"encoding/json"

	"loglensai/backend-go/internal/models"
)

// JSON-RPC 2.0 standard error codes, plus the same codes api.py uses.
const (
	CodeParseError     = -32700 // malformed JSON on the wire
	CodeInvalidRequest = -32600 // request envelope failed validation (bad jsonrpc/method shape)
	CodeMethodNotFound = -32601 // no handler registered for the method
	CodeInvalidParams  = -32602 // params failed to decode into the method's model
	CodeInternalError  = -32603 // handler returned an error, or panicked
)

// Handler executes one RPC method. It receives the raw (still-encoded)
// params so real implementations (added in later migration phases) can
// decode them into whatever typed struct Dispatch validated against.
// Returning a non-nil *models.RPCError short-circuits to an error response.
type Handler func(params json.RawMessage) (any, *models.RPCError)

// ParamsFactory returns a pointer to a new zero-value instance of a method's
// params struct, used by Dispatch purely for JSON-shape validation (the Go
// analogue of Python's `model(**req.params)` Pydantic validation step).
// A nil factory means the method takes params directly, unvalidated --
// mirroring methods absent from (or explicitly `None` in) api.py's
// RPC_MODELS dict.
type ParamsFactory func() any

type methodEntry struct {
	handler Handler
	model   ParamsFactory
}

// Registry maps JSON-RPC method names (without the Python "method_" prefix)
// to their handler and optional params model factory.
type Registry struct {
	methods map[string]methodEntry
}

// NewRegistry returns an empty registry.
func NewRegistry() *Registry {
	return &Registry{methods: make(map[string]methodEntry)}
}

// Register wires a method name to a handler with no params validation model
// (equivalent to a `None` or absent entry in Python's RPC_MODELS).
func (r *Registry) Register(method string, h Handler) {
	r.methods[method] = methodEntry{handler: h}
}

// RegisterWithModel wires a method name to a handler along with a params
// factory used to validate incoming params before the handler runs.
func (r *Registry) RegisterWithModel(method string, model ParamsFactory, h Handler) {
	r.methods[method] = methodEntry{handler: h, model: model}
}

// Methods returns the sorted-by-caller-irrelevant set of registered method
// names. Primarily useful for tests and introspection.
func (r *Registry) Methods() []string {
	names := make([]string, 0, len(r.methods))
	for name := range r.methods {
		names = append(names, name)
	}
	return names
}

// Has reports whether a method is registered.
func (r *Registry) Has(method string) bool {
	_, ok := r.methods[method]
	return ok
}

// Len returns the number of registered methods.
func (r *Registry) Len() int {
	return len(r.methods)
}
