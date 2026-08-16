package rpc

import (
	"encoding/json"
	"fmt"
	"log"

	"loglensai/backend-go/internal/models"
)

// Dispatch routes a decoded JSON-RPC request to its registered handler,
// mirroring sidecar/src/api.py's App.dispatch():
//  1. method not found -> -32601
//  2. params fail to decode into the method's registered model -> -32602
//  3. handler returns an error, or panics -> -32603
//  4. otherwise -> success envelope wrapping the handler's result
//
// Unlike Python (where an unhandled exception anywhere in a handler is
// automatically caught by dispatch's try/except), Go handlers that panic
// would otherwise crash the whole process. Dispatch recovers from handler
// panics and converts them into a -32603 Internal error response so a bug
// in one method stub can never take down the stdio/HTTP server.
func (r *Registry) Dispatch(req models.JSONRPCRequest) (resp models.JSONRPCResponse) {
	entry, ok := r.methods[req.Method]
	if !ok {
		return models.NewErrorResponse(req.ID, &models.RPCError{
			Code:    CodeMethodNotFound,
			Message: fmt.Sprintf("Method not found: %s", req.Method),
		})
	}

	// Recover handler panics -> -32603, matching the safety net Python gets
	// for free from dispatch()'s surrounding try/except Exception.
	defer func() {
		if rec := recover(); rec != nil {
			log.Printf("rpc: panic in handler %q: %v", req.Method, rec)
			resp = models.NewErrorResponse(req.ID, &models.RPCError{
				Code:    CodeInternalError,
				Message: "Internal error",
				Data:    fmt.Sprintf("%v", rec),
			})
		}
	}()

	params := req.Params
	if len(params) == 0 {
		params = []byte("{}")
	}

	// Validate params shape against the method's model, mirroring Python's
	// `model(**req.params)` Pydantic validation. A nil model factory means
	// the method is dispatched with raw params, unvalidated (methods absent
	// from, or mapped to None in, api.py's RPC_MODELS).
	if entry.model != nil {
		target := entry.model()
		if err := json.Unmarshal(params, target); err != nil {
			return models.NewErrorResponse(req.ID, &models.RPCError{
				Code:    CodeInvalidParams,
				Message: "Invalid params",
				Data:    err.Error(),
			})
		}
	}

	result, rpcErr := entry.handler(params)
	if rpcErr != nil {
		return models.NewErrorResponse(req.ID, rpcErr)
	}
	return models.NewResponse(req.ID, result)
}
