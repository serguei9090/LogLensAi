package rpc

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"loglensai/backend-go/internal/ai/graph"
	"loglensai/backend-go/internal/app"
	"loglensai/backend-go/internal/models"
)

// a2uiStart/a2uiEnd mirror api.py's A2UI_START/A2UI_END sentinel markers
// used by tools.py's create_column tool and stripped out here to recover
// the structured payload for persistence (ai_messages.a2ui_payload).
const (
	a2uiStart = "[[A2UI]]"
	a2uiEnd   = "[[/A2UI]]"
)

// RegisterAI wires the send_ai_message RPC method against a live *app.App,
// an AI Provider, and a tool registry, mirroring api.py's
// method_send_ai_message. Follows the same override-after-RegisterStubs
// pattern as RegisterApp (see app_methods.go's doc comment) -- call this
// after RegisterStubs (and, if desired, RegisterApp; order between the two
// doesn't matter, they touch disjoint method names).
//
// provider and tools are supplied by the caller rather than constructed
// here: this package defines only the minimal Provider/MemorySearcher
// interfaces it needs (see internal/ai/graph's package doc comment) --
// concrete provider clients live in internal/ai/providers and the RAG
// memory searcher in internal/ai/rag, both built concurrently with this
// package and not yet available for cmd/sidecar/main.go to construct as of
// this writing. Wiring RegisterAI into main.go is left to the phase that
// reconciles those concrete types against these interfaces.
func RegisterAI(r *Registry, a *app.App, provider graph.Provider, tools *graph.ToolRegistry) {
	r.RegisterWithModel("send_ai_message", paramModels["send_ai_message"], func(params json.RawMessage) (any, *models.RPCError) {
		var req models.SendAiMessageRequest
		if err := json.Unmarshal(params, &req); err != nil {
			return nil, invalidParamsErr(err)
		}
		return sendAIMessage(context.Background(), a, provider, tools, req)
	})
}

// sendAIMessage implements the non-streaming send_ai_message flow, porting
// api.py's method_send_ai_message: prepare the session (persist the user
// turn, load history), drain the investigation runner fully, extract any
// A2UI payload, persist the assistant turn, and return {session_id,
// response}.
func sendAIMessage(ctx context.Context, a *app.App, provider graph.Provider, tools *graph.ToolRegistry, params models.SendAiMessageRequest) (any, *models.RPCError) {
	sessionID, providerSessionID, history, err := prepareAISession(a, params)
	if err != nil {
		return nil, &models.RPCError{Code: CodeInternalError, Message: err.Error()}
	}

	reasoning := true
	if params.Reasoning != nil {
		reasoning = *params.Reasoning
	}
	model := ""
	if params.Model != nil {
		model = *params.Model
	}

	// Mirrors `history=[{"role": m.role, "content": m.content} for m in
	// history[:-1]]` in method_send_ai_message: the just-inserted user
	// message (the last element _prepare_ai_session's loaded history ends
	// with) is excluded here because run_investigation appends
	// params.message as the new turn itself, below.
	runnerHistory := dropLast(history)
	ctx = context.WithValue(ctx, "workspace_id", params.WorkspaceID)

	chunks, runErr := runInvestigation(ctx, provider, tools, params.WorkspaceID, sessionID, params.Message, runnerHistory, model, reasoning)
	if runErr != nil {
		return nil, &models.RPCError{Code: CodeInternalError, Message: runErr.Error()}
	}

	var full strings.Builder
	for chunk := range chunks {
		if chunk.Err != nil {
			return nil, &models.RPCError{Code: CodeInternalError, Message: chunk.Err.Error()}
		}
		full.WriteString(chunk.Content)
	}
	fullResponse := full.String()

	// method_send_ai_message's own A2UI extraction is a strict subset of
	// _extract_a2ui_payload (no markup fallback, silently drops on any
	// parse error) -- reproduced via strict:true below.
	a2uiPayload := extractA2UIPayload(fullResponse, true)

	if err := finalizeAISession(a, sessionID, fullResponse, providerSessionID, a2uiPayload); err != nil {
		return nil, &models.RPCError{Code: CodeInternalError, Message: err.Error()}
	}

	return map[string]any{"session_id": sessionID, "response": fullResponse}, nil
}

// runInvestigation builds the graph's initial state and starts Run,
// porting runner.py's HybridRunner.run_investigation: the loaded prior
// turns become the initial message log, and userMessage is appended as the
// new turn before the graph starts (mirroring
// state["messages"].append({"role": "user", "content": user_message})).
func runInvestigation(
	ctx context.Context,
	provider graph.Provider,
	tools *graph.ToolRegistry,
	workspaceID, sessionID, userMessage string,
	history []graph.ChatMessage,
	model string,
	reasoning bool,
) (<-chan graph.StreamChunk, error) {
	messages := make([]graph.ChatMessage, len(history), len(history)+1)
	copy(messages, history)
	messages = append(messages, graph.ChatMessage{Role: "user", Content: userMessage})

	initialState := graph.MissionState{
		WorkspaceID: workspaceID,
		SessionID:   sessionID,
		Messages:    messages,
		Model:       model,
		Reasoning:   reasoning,
		NextNode:    graph.NodeReasoning,
		Status:      "started",
		Metadata:    map[string]any{},
	}

	return graph.Run(ctx, provider, tools, initialState)
}

// prepareAISession ports api.py's App._prepare_ai_session: resolves or
// creates the session row, resolves the provider_session_id, builds the
// contextual-log-summary suffix for context_logs (if any) and appends it to
// the just-inserted user message's *returned* content (matching Python
// exactly -- see the note below), persists the user turn, and loads the
// full message history for the session.
//
// Faithful-port note: Python appends the log-context summary to
// history[-1].content (the row it just inserted) but never persists that
// mutation back to the database, and both call sites
// (method_send_ai_message / aiohttp_stream_chat) then slice it off with
// history[:-1] before handing "history" to the runner -- the runner
// receives the *plain* params.message as the new turn instead (appended
// separately, see runInvestigation). This means the log-context enrichment
// computed here is calculated but never actually reaches the model in
// either Python code path. This looks like a latent bug in the Python
// reference, not an intentional design -- but per the strangler-pattern
// migration's parity goal, this port reproduces the exact same behavior
// (compute the summary, append it to the row that folks then slice off)
// rather than "fixing" a divergence from the golden implementation.
func prepareAISession(a *app.App, params models.SendAiMessageRequest) (sessionID, providerSessionID string, history []graph.ChatMessage, err error) {
	conn := a.DB.Conn

	sessionID = ""
	if params.SessionID != nil {
		sessionID = *params.SessionID
	}
	if sessionID == "" {
		sessionID = uuid.NewString()
		name := ""
		if params.SessionName != nil {
			name = *params.SessionName
		}
		if name == "" {
			name = "Investigation " + time.Now().Format("2006-01-02 15:04")
		}
		if _, execErr := conn.Exec(
			`INSERT INTO ai_sessions (session_id, workspace_id, name) VALUES (?, ?, ?)`,
			sessionID, params.WorkspaceID, name,
		); execErr != nil {
			return "", "", nil, fmt.Errorf("rpc: creating ai_session: %w", execErr)
		}
	}

	if params.ProviderSessionID != nil {
		providerSessionID = *params.ProviderSessionID
	}
	if providerSessionID == "" {
		var psid sql.NullString
		if scanErr := conn.QueryRow(
			`SELECT provider_session_id FROM ai_sessions WHERE session_id = ?`, sessionID,
		).Scan(&psid); scanErr == nil && psid.Valid {
			providerSessionID = psid.String
		}
	}

	logContext := ""
	if len(params.ContextLogs) > 0 {
		if summary := contextualLogSummary(a, params.ContextLogs); summary != "" {
			logContext = "\n\nContextual Log Summary:\n" + summary
		}
	}

	contextLogsJSON, _ := json.Marshal(params.ContextLogs)
	if _, execErr := conn.Exec(
		`INSERT INTO ai_messages (session_id, role, content, context_logs, provider_session_id) VALUES (?, ?, ?, ?, ?)`,
		sessionID, "user", params.Message, string(contextLogsJSON), nullableString(providerSessionID),
	); execErr != nil {
		return "", "", nil, fmt.Errorf("rpc: inserting user ai_message: %w", execErr)
	}

	rows, queryErr := conn.Query(
		`SELECT role, content FROM ai_messages WHERE session_id = ? ORDER BY timestamp ASC`, sessionID,
	)
	if queryErr != nil {
		return "", "", nil, fmt.Errorf("rpc: loading ai_messages history: %w", queryErr)
	}
	for rows.Next() {
		var role, content string
		if scanErr := rows.Scan(&role, &content); scanErr != nil {
			continue
		}
		history = append(history, graph.ChatMessage{Role: role, Content: content})
	}
	rows.Close()

	if logContext != "" && len(history) > 0 {
		history[len(history)-1].Content += logContext
	}

	return sessionID, providerSessionID, history, nil
}

// contextualLogSummary loads the requested context_logs rows, hydrates
// their raw text via the fast-path mmap reader, and runs them through
// SmartContextManager.PrepareLogContext, porting the log-hydration +
// summarization block inside _prepare_ai_session.
func contextualLogSummary(a *app.App, logIDs []int) string {
	if len(logIDs) == 0 {
		return ""
	}

	placeholders := make([]string, len(logIDs))
	args := make([]any, len(logIDs))
	for i, id := range logIDs {
		placeholders[i] = "?"
		args[i] = id
	}

	query := fmt.Sprintf(
		`SELECT id, timestamp, level, source_id, line_id, cluster_id FROM logs WHERE id IN (%s)`,
		strings.Join(placeholders, ","),
	)
	rows, err := a.DB.Conn.Query(query, args...)
	if err != nil {
		return ""
	}
	defer rows.Close()

	var logs []graph.LogEntry
	for rows.Next() {
		var id int64
		var timestamp, level, sourceID sql.NullString
		var lineID sql.NullInt64
		var clusterID sql.NullString
		if scanErr := rows.Scan(&id, &timestamp, &level, &sourceID, &lineID, &clusterID); scanErr != nil {
			continue
		}
		entry := graph.LogEntry{
			"id":        id,
			"level":     level.String,
			"source_id": sourceID.String,
		}
		if clusterID.Valid {
			entry["cluster_id"] = clusterID.String
		}
		hydrateContextLog(a, entry, sourceID.String, lineID)
		logs = append(logs, entry)
	}

	if len(logs) == 0 {
		return ""
	}
	return graph.NewSmartContextManager().PrepareLogContext(logs, 4000, nil)
}

// hydrateContextLog fills entry["raw_text"]/entry["message"] via the
// fast-path mmap reader, mirroring api.py's App._hydrate_log for the
// context_logs enrichment path (simplified: unlike the get_logs path,
// context_logs rows never carry an inline raw_text column, so this always
// goes through the fast-path lookup).
func hydrateContextLog(a *app.App, entry graph.LogEntry, sourceID string, lineID sql.NullInt64) {
	if sourceID != "" && lineID.Valid {
		if content, err := a.FastPath.GetLine(sourceID, lineID.Int64); err == nil {
			entry["raw_text"] = content
			entry["message"] = content
			return
		}
	}
	entry["raw_text"] = ""
	entry["message"] = ""
}

// finalizeAISession ports api.py's App._finalize_ai_session (minus
// _sync_ai_sessions_to_json, a JSON-file cache write with no established Go
// equivalent/consumer yet -- out of scope for AI orchestration wiring):
// persists the assistant turn and updates the session's last_modified (and
// provider_session_id, if set).
func finalizeAISession(a *app.App, sessionID, responseContent, providerSessionID string, a2uiPayload map[string]any) error {
	conn := a.DB.Conn

	var a2uiJSON any
	if a2uiPayload != nil {
		if b, err := json.Marshal(a2uiPayload); err == nil {
			a2uiJSON = string(b)
		}
	}

	if _, err := conn.Exec(
		`INSERT INTO ai_messages (session_id, role, content, a2ui_payload, provider_session_id) VALUES (?, ?, ?, ?, ?)`,
		sessionID, "assistant", responseContent, a2uiJSON, nullableString(providerSessionID),
	); err != nil {
		return fmt.Errorf("rpc: inserting assistant ai_message: %w", err)
	}

	lastModified := time.Now().UTC().Format(time.RFC3339)
	var err error
	if providerSessionID != "" {
		_, err = conn.Exec(
			`UPDATE ai_sessions SET last_modified = ?, provider_session_id = ? WHERE session_id = ?`,
			lastModified, providerSessionID, sessionID,
		)
	} else {
		_, err = conn.Exec(
			`UPDATE ai_sessions SET last_modified = ? WHERE session_id = ?`,
			lastModified, sessionID,
		)
	}
	if err != nil {
		return fmt.Errorf("rpc: updating ai_session: %w", err)
	}
	return nil
}

// extractA2UIPayload parses an [[A2UI]]...[[/A2UI]] block out of text,
// porting api.py's _extract_a2ui_payload. When strict is true, a JSON parse
// failure yields nil (matching method_send_ai_message's inline
// try/except-discard variant); when false, a parse failure falls back to
// {"type": "markup", "raw": <block text>} (matching _extract_a2ui_payload
// itself, used by the streaming path).
func extractA2UIPayload(text string, strict bool) map[string]any {
	if !strings.Contains(text, a2uiStart) {
		return nil
	}
	afterStart := strings.SplitN(text, a2uiStart, 2)
	if len(afterStart) < 2 {
		return nil
	}
	raw := strings.TrimSpace(strings.SplitN(afterStart[1], a2uiEnd, 2)[0])

	var payload map[string]any
	if err := json.Unmarshal([]byte(raw), &payload); err == nil {
		return payload
	}
	if strict {
		return nil
	}
	return map[string]any{"type": "markup", "raw": raw}
}

func dropLast(msgs []graph.ChatMessage) []graph.ChatMessage {
	if len(msgs) == 0 {
		return msgs
	}
	return msgs[:len(msgs)-1]
}

func nullableString(s string) any {
	if s == "" {
		return nil
	}
	return s
}
