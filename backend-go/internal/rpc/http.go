package rpc

import (
	"encoding/json"
	"io"
	"log"
	"net/http"

	"loglensai/backend-go/internal/models"
)

// NewHTTPHandler builds the POST /rpc handler, mirroring aiohttp_handler in
// sidecar/src/api.py: read the whole body, decode as a JSONRPCRequest,
// Dispatch it, write the response back as JSON.
//
// CORS: Python's run_http/start_background_http configure aiohttp_cors with
// allow_credentials=True, expose_headers="*", allow_headers="*",
// allow_methods="*" on every route ("*" origin default). Per the CORS spec,
// Access-Control-Allow-Credentials: true combined with a wildcard
// Access-Control-Allow-Origin is actually invalid (browsers ignore
// credentialed wildcard responses) -- aiohttp_cors reproduces that same
// broken-by-the-spec combination, so this handler replicates it verbatim
// rather than "fixing" a behavior the reference implementation also has.
// The return type is *http.ServeMux (rather than the http.Handler this
// function historically returned) so callers that also need the AI SSE
// route (see ai_stream.go's MountStreamChat) can add it to the same mux
// this function builds. *http.ServeMux still satisfies http.Handler, so
// every existing caller that only ever used the return value as an
// http.Handler (e.g. httptest.NewServer(NewHTTPHandler(r))) keeps working
// unchanged.
func NewHTTPHandler(reg *Registry) *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/rpc", func(w http.ResponseWriter, r *http.Request) {
		applyCORS(w)
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if r.Method != http.MethodPost {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusMethodNotAllowed)
			_ = json.NewEncoder(w).Encode(models.NewErrorResponse(nil, &models.RPCError{
				Code:    CodeInvalidRequest,
				Message: "Invalid Request",
			}))
			return
		}

		body, err := io.ReadAll(r.Body)
		if err != nil {
			// Mirrors aiohttp_handler's generic `except Exception` branch
			// (a body read failure is not a pydantic ValidationError).
			writeJSON(w, http.StatusInternalServerError, models.NewErrorResponse(nil, &models.RPCError{
				Code:    CodeInternalError,
				Message: "Internal error: " + err.Error(),
			}))
			return
		}

		// Mirrors `await request.json()` raising JSONDecodeError, which
		// aiohttp_handler's `except Exception` catches as -32603/500 (it is
		// NOT a pydantic ValidationError, so it does not hit the -32600 path).
		if !json.Valid(body) {
			writeJSON(w, http.StatusInternalServerError, models.NewErrorResponse(nil, &models.RPCError{
				Code:    CodeInternalError,
				Message: "Internal error: invalid JSON",
			}))
			return
		}

		// Mirrors `JSONRPCRequest(**body)` raising ValidationError (e.g. a
		// missing required "method" field) -> -32600/400.
		var req models.JSONRPCRequest
		if err := json.Unmarshal(body, &req); err != nil || req.Method == "" {
			writeJSON(w, http.StatusBadRequest, models.NewErrorResponse(nil, &models.RPCError{
				Code:    CodeInvalidRequest,
				Message: "Invalid Request",
			}))
			return
		}

		resp := reg.Dispatch(req)
		writeJSON(w, http.StatusOK, resp)
	})
	return mux
}

func applyCORS(w http.ResponseWriter) {
	h := w.Header()
	h.Set("Access-Control-Allow-Origin", "*")
	h.Set("Access-Control-Allow-Credentials", "true")
	h.Set("Access-Control-Allow-Headers", "*")
	h.Set("Access-Control-Allow-Methods", "*")
	h.Set("Access-Control-Expose-Headers", "*")
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("rpc: failed to write JSON response: %v", err)
	}
}

// ListenAndServe starts the HTTP transport on the given address (e.g.
// "127.0.0.1:5000"), matching Python's run_http/start_background_http which
// bind to 127.0.0.1 by default.
func ListenAndServe(addr string, reg *Registry) error {
	log.Printf("rpc: HTTP server listening on %s", addr)
	return http.ListenAndServe(addr, NewHTTPHandler(reg))
}
