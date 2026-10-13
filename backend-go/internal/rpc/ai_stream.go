package rpc

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"

	"loglensai/backend-go/internal/ai/graph"
	"loglensai/backend-go/internal/app"
	"loglensai/backend-go/internal/models"
)

// MountStreamChat registers the POST /api/stream_chat SSE endpoint on mux,
// mirroring api.py's bespoke aiohttp_stream_chat route -- a hand-rolled
// Server-Sent-Events stream that lives outside the JSON-RPC /rpc envelope
// (Python registers it as its own aiohttp route, not through dispatch()).
// Call this on the same *http.ServeMux NewHTTPHandler built, e.g.:
//
//	mux := rpc.NewHTTPHandler(registry)
//	rpc.MountStreamChat(mux, application, provider, toolRegistry)
func MountStreamChat(mux *http.ServeMux, a *app.App, provider graph.Provider, tools *graph.ToolRegistry) {
	mux.HandleFunc("/api/stream_chat", streamChatHandler(a, provider, tools))
}

// streamChatHandler implements aiohttp_stream_chat: parse params (accepting
// either a bare SendAiMessageRequest body or a {"params": {...}}
// JSON-RPC-shaped envelope, matching Python's dual-format parsing),
// prepare the session, stream {"chunk": ...} SSE events as the graph
// yields reasoning output, then finalize the session and emit
// "data: [DONE]\n\n". A client disconnect mid-stream (request context
// cancelled) still runs session finalization with whatever partial text was
// accumulated so far, matching Python's `except asyncio.CancelledError`
// branch -- the writes themselves are best-effort at that point since the
// client is already gone.
func streamChatHandler(a *app.App, provider graph.Provider, tools *graph.ToolRegistry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		applyCORS(w)
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		req, parseErr := parseSendAIMessageBody(r)
		if parseErr != nil {
			http.Error(w, parseErr.Error(), http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.WriteHeader(http.StatusOK)
		flusher, _ := w.(http.Flusher)
		flush := func() {
			if flusher != nil {
				flusher.Flush()
			}
		}

		sessionID, providerSessionID, history, err := prepareAISession(a, req)
		if err != nil {
			writeSSE(w, map[string]any{"error": err.Error()})
			flush()
			return
		}

		writeSSE(w, map[string]any{"session_id": sessionID})
		flush()

		reasoning := true
		if req.Reasoning != nil {
			reasoning = *req.Reasoning
		}
		model := ""
		if req.Model != nil {
			model = *req.Model
		}
		runnerHistory := dropLast(history)

		ctx := context.WithValue(r.Context(), "workspace_id", req.WorkspaceID)
		chunks, runErr := runInvestigation(ctx, provider, tools, req.WorkspaceID, sessionID, req.Message, runnerHistory, model, reasoning)
		if runErr != nil {
			writeSSE(w, map[string]any{"error": runErr.Error()})
			flush()
			return
		}

		var full strings.Builder
		var streamErr error

	drain:
		for {
			select {
			case chunk, ok := <-chunks:
				if !ok {
					break drain
				}
				if chunk.Err != nil {
					streamErr = chunk.Err
					break drain
				}
				if chunk.EvaluationNotice != "" {
					writeSSE(w, map[string]any{"evaluation_notice": chunk.EvaluationNotice})
					flush()
				}
				if chunk.StepNotice != "" {
					writeSSE(w, map[string]any{
						"step":      chunk.StepNotice,
						"step_done": chunk.StepDone,
					})
					flush()
				}
				if chunk.Content != "" {
					full.WriteString(chunk.Content)
					writeSSE(w, map[string]any{"chunk": chunk.Content})
					flush()
				}
			case <-ctx.Done():
				streamErr = ctx.Err()
				break drain
			}
		}

		// Finalize with whatever text was accumulated, even on error/
		// disconnect -- mirrors both aiohttp_stream_chat's happy path and
		// its `except asyncio.CancelledError` branch, which both call
		// _finalize_ai_session with the partial/complete text.
		finalText := full.String()
		extracted := extractA2UIPayload(finalText, false)
		cleanText := stripA2UITags(finalText)
		if finalizeErr := finalizeAISession(a, sessionID, cleanText, providerSessionID, extracted); finalizeErr != nil {
			log.Printf("rpc: stream_chat: failed to finalize session %s: %v", sessionID, finalizeErr)
		}

		if extracted != nil {
			writeSSE(w, map[string]any{"a2ui_payload": extracted})
			flush()
		}

		if streamErr != nil && !errors.Is(streamErr, context.Canceled) {
			writeSSE(w, map[string]any{"error": streamErr.Error()})
			flush()
			return
		}
		if ctx.Err() == nil {
			_, _ = w.Write([]byte("data: [DONE]\n\n"))
			flush()
		}
	}
}

// parseSendAIMessageBody decodes the request body into a
// SendAiMessageRequest, accepting either a bare object or a
// {"params": {...}} envelope, matching aiohttp_stream_chat's
// `if "params" in body: ... else: ...` dual-format handling.
func parseSendAIMessageBody(r *http.Request) (models.SendAiMessageRequest, error) {
	var req models.SendAiMessageRequest

	body, err := io.ReadAll(r.Body)
	if err != nil {
		return req, fmt.Errorf("Malformed JSON: %w", err)
	}

	var envelope struct {
		Params json.RawMessage `json:"params"`
	}
	if json.Unmarshal(body, &envelope) == nil && len(envelope.Params) > 0 {
		if err := json.Unmarshal(envelope.Params, &req); err != nil {
			return req, fmt.Errorf("Invalid Params: %w", err)
		}
		return req, nil
	}

	if err := json.Unmarshal(body, &req); err != nil {
		return req, fmt.Errorf("Malformed JSON: %w", err)
	}
	return req, nil
}

// writeSSE writes one "data: <json>\n\n" SSE frame, mirroring
// aiohttp_stream_chat's `f"data: {json.dumps(...)}\n\n"` framing.
func writeSSE(w http.ResponseWriter, payload any) {
	b, err := json.Marshal(payload)
	if err != nil {
		return
	}
	_, _ = fmt.Fprintf(w, "data: %s\n\n", b)
}
