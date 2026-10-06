package ai

// rpc_extra.go bundles the six AI-provider-dependent RPC methods that
// neither wiring.go's Wire (the graph-facing investigation subsystem) nor
// ai_methods.go's RegisterAI (send_ai_message only) cover: analyze_cluster,
// list_ai_models, test_ai_connection, generate_facet_regex, save_memory,
// and search_memory (search_memory as the standalone RPC method the
// frontend calls directly -- distinct from its use as a graph tool inside
// Wiring.Tools, which internal/ai/graph already wires against Wiring.Memory).
//
// This lives in package ai (same package as wiring.go) rather than
// internal/app, for the same reason wiring.go itself does -- see its
// package doc comment: constructing a providers.Provider needs
// internal/ai/providers, which internal/app cannot import without a cycle
// (internal/ai/graph already imports internal/app).

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"regexp"
	"strconv"
	"strings"
	"sync"

	"loglensai/backend-go/internal/ai/providers"
	"loglensai/backend-go/internal/ai/rag"
	"loglensai/backend-go/internal/app"
	"loglensai/backend-go/internal/models"
)

// extraErrInternal mirrors rpc.CodeInternalError (-32603). Duplicated
// locally rather than imported for the same reason internal/app duplicates
// it (see app.go's errInternal doc comment): internal/rpc imports this
// package, so the reverse import would cycle.
const extraErrInternal = -32603

// Extra bundles the six AI-provider-dependent RPC handlers described above
// against a live *app.App.
//
// Why this doesn't just take a *Wiring: Wiring.Provider is graph.Provider
// (Chat/ChatStream only -- everything the investigation state machine
// needs), not the raw providers.Provider these methods need
// (AnalyzeLogs/ListModels/TestConnection have no graph.Provider
// equivalent). And Wiring.Memory is graph.MemorySearcher (SearchMemory
// only) -- save_memory needs SaveMemory, which that interface doesn't
// expose. Rather than widen Wiring's fields (wiring.go is explicitly out of
// scope for this pass -- three other agents are concurrently wiring other
// RPC method groups against shared files, so editing it risks a merge
// conflict for no real benefit), Extra builds its own providers.Provider
// (via the already-exported NewProviderFromSettings, the same helper Wire
// itself uses) and its own lazily-initialized rag.Service handle. Building
// a second provider is cheap (NewProviderFromSettings does no network I/O,
// see its own doc comment); a second rag.Service would not be cheap if it
// meant a second ONNX embedder, which is exactly why the rag.Service handle
// below is lazy too (see lazyMemoryService's doc comment).
type Extra struct {
	app                *app.App
	provider           providers.Provider
	memory             *lazyMemoryService
	isExplicitProvider bool
}

// NewExtra constructs an Extra for a. Like Wire, it does no network/model
// I/O itself, so it is safe to call unconditionally at startup.
func NewExtra(a *app.App) (*Extra, error) {
	provider, err := NewProviderFromSettings(a)
	if err != nil {
		return nil, fmt.Errorf("ai: constructing provider for extra RPC methods: %w", err)
	}
	return &Extra{
		app:      a,
		provider: provider,
		memory:   newLazyMemoryService(a.DataDir(), a.DB.Conn),
	}, nil
}

// getProvider returns the active provider resolved dynamically from the app's current settings,
// unless an explicit provider was injected (e.g. in unit tests), or falling back to the initialization-time provider.
func (e *Extra) getProvider() providers.Provider {
	if e.isExplicitProvider && e.provider != nil {
		return e.provider
	}
	if e.app != nil {
		if p, err := NewProviderFromSettings(e.app); err == nil && p != nil {
			return p
		}
	}
	return e.provider
}

// --- analyze_cluster ------------------------------------------------------

// AnalyzeCluster implements the analyze_cluster RPC method, mirroring
// api.py's App.method_analyze_cluster: fetch up to sample_size raw log
// lines belonging to cluster_id (hydrated via the fast-path mmap reader,
// same as api.py's fast_path.get_line), resolve the cluster's current
// template from workspace_id's Drain3 miner, and hand both to the AI
// provider's one-off log analysis prompt.
func (e *Extra) AnalyzeCluster(ctx context.Context, req models.AnalyzeClusterRequest) (any, *models.RPCError) {
	sampleSize := req.SampleSize
	if sampleSize <= 0 {
		sampleSize = 20
	}

	rows, err := e.app.DB.Conn.QueryContext(ctx,
		`SELECT source_id, line_id FROM logs WHERE workspace_id = ? AND cluster_id = ? LIMIT ?`,
		req.WorkspaceID, req.ClusterID, sampleSize,
	)
	if err != nil {
		return nil, &models.RPCError{Code: extraErrInternal, Message: err.Error()}
	}
	var samples []string
	for rows.Next() {
		var sourceID sql.NullString
		var lineID sql.NullInt64
		if scanErr := rows.Scan(&sourceID, &lineID); scanErr != nil {
			continue
		}
		if !sourceID.Valid || !lineID.Valid {
			continue
		}
		if content, getErr := e.app.FastPath.GetLine(sourceID.String, lineID.Int64); getErr == nil && content != "" {
			samples = append(samples, content)
		}
	}
	rows.Close()

	template := ""
	if miner, minerErr := e.app.GetDrainParser(req.WorkspaceID); minerErr == nil {
		for _, c := range miner.Clusters() {
			if strconv.Itoa(c.ID) == req.ClusterID {
				template = c.Template()
				break
			}
		}
	}

	result, err := e.getProvider().AnalyzeLogs(ctx, template, samples)
	if err != nil {
		return nil, &models.RPCError{Code: extraErrInternal, Message: err.Error()}
	}
	return map[string]any{
		"summary":             result.Summary,
		"root_cause":          result.RootCause,
		"recommended_actions": result.RecommendedActions,
	}, nil
}

// --- list_ai_models / test_ai_connection ----------------------------------

// ListModels implements the list_ai_models RPC method, mirroring api.py's
// App.method_list_ai_models. Returns the raw list (not wrapped in an
// object), matching Python's `-> list[str]` return type.
func (e *Extra) ListModels(ctx context.Context) (any, *models.RPCError) {
	list, err := e.getProvider().ListModels(ctx)
	if err != nil {
		return nil, &models.RPCError{Code: extraErrInternal, Message: err.Error()}
	}
	if list == nil {
		list = []string{}
	}
	return list, nil
}

// TestConnection implements the test_ai_connection RPC method, mirroring
// api.py's App.method_test_ai_connection.
//
// Deviation: Python's provider.test_connection() returns a
// {"status", "message"} dict with provider-specific wording (e.g. ollama.py
// reports "Ollama is running. Found N models."); the Go
// providers.Provider interface reports success/failure via error alone
// (see providers.Provider's own doc comment), so the exact original
// message text does not survive the port. This preserves the
// {"status","message"} response *shape* the frontend expects, with a
// generic success message on success and the error's own text on failure.
func (e *Extra) TestConnection(ctx context.Context) (any, *models.RPCError) {
	if err := e.getProvider().TestConnection(ctx); err != nil {
		return map[string]any{"status": "error", "message": err.Error()}, nil
	}
	return map[string]any{"status": "success", "message": "Connection successful."}, nil
}

// --- generate_facet_regex --------------------------------------------------

// GenerateFacetRegex implements the generate_facet_regex RPC method,
// mirroring api.py's App.method_generate_facet_regex: a single one-shot
// chat call (no tool registry, no graph -- Python's implementation calls
// self.ai.chat(messages) directly, not the investigation runner) asking the
// model to produce a regex, with the same cleanup/validation/fallback
// Python applies to the response.
//
// Deviation: regex *validity* is checked with Go's regexp (RE2) rather than
// Python's re (PCRE-like, backtracking). RE2 rejects some constructs Python
// accepts (lookahead/lookbehind, backreferences); a model-generated regex
// using one of those fails Go's compile check and falls back to the
// literal-match regex here, where Python would have accepted it verbatim.
// This is a real, deliberate platform difference (RE2 has no linear-time-safe
// way to support those features), documented rather than silently diverging.
func (e *Extra) GenerateFacetRegex(ctx context.Context, req models.GenerateExtractionRegexRequest) (any, *models.RPCError) {
	fallback := "(" + regexp.QuoteMeta(req.SelectedText) + ")"

	prompt := "Given the log line: '" + req.LogLine + "'\n" +
		"Generate a robust regex that extracts the exact substring: '" + req.SelectedText + "'.\n" +
		"The regex MUST have exactly one capturing group (e.g. (...) ) for the extraction.\n" +
		"Avoid overly greedy matches. Be specific to the surrounding anchor characters if possible.\n" +
		"Return ONLY the raw regex string, no markdown, no explanation, no backticks."

	messages := []providers.ChatMessage{{Role: "user", Content: prompt}}
	resp, err := e.getProvider().Chat(ctx, messages, "", "", false, nil)
	if err != nil {
		log.Printf("[AI] Failed to generate regex with AI: %v", err)
		return map[string]any{"regex": fallback}, nil
	}

	regex := strings.TrimSpace(strings.Trim(strings.TrimSpace(resp.Content), "`"))
	regex = strings.TrimSpace(strings.TrimPrefix(regex, "python"))
	regex = strings.TrimSpace(strings.TrimPrefix(regex, "regex"))

	if _, compileErr := regexp.Compile(regex); compileErr != nil || !strings.Contains(regex, "(") || !strings.Contains(regex, ")") {
		regex = fallback
	}

	return map[string]any{"regex": regex}, nil
}

// --- save_memory / search_memory ------------------------------------------

// SaveMemory implements the save_memory RPC method, mirroring api.py's
// App.method_save_memory (which delegates straight to
// self.rag_service.save_memory and passes its {"status": "ok"} dict back
// verbatim).
func (e *Extra) SaveMemory(ctx context.Context, req models.SaveMemoryRequest) (any, *models.RPCError) {
	svc, err := e.memory.get()
	if err != nil {
		return nil, &models.RPCError{Code: extraErrInternal, Message: err.Error()}
	}
	if err := svc.SaveMemory(ctx, req.WorkspaceID, req.IssueSignature, req.Resolution); err != nil {
		return nil, &models.RPCError{Code: extraErrInternal, Message: err.Error()}
	}
	return map[string]any{"status": "ok"}, nil
}

// SearchMemory implements the standalone search_memory RPC method
// (distinct from the same-named tool graph.ToolRegistry exposes to the AI
// investigation loop -- this is the direct frontend-callable RPC, mirroring
// api.py's App.method_search_memory), returning
// [{issue_signature, resolution, created_at, distance}, ...].
func (e *Extra) SearchMemory(ctx context.Context, req models.SearchMemoryRequest) (any, *models.RPCError) {
	limit := req.Limit
	if limit <= 0 {
		limit = 5
	}
	svc, err := e.memory.get()
	if err != nil {
		return nil, &models.RPCError{Code: extraErrInternal, Message: err.Error()}
	}
	results, err := svc.SearchMemory(ctx, req.WorkspaceID, req.Query, limit)
	if err != nil {
		return nil, &models.RPCError{Code: extraErrInternal, Message: err.Error()}
	}
	out := make([]map[string]any, len(results))
	for i, r := range results {
		out[i] = map[string]any{
			"issue_signature": r.IssueSignature,
			"resolution":      r.Resolution,
			"created_at":      r.CreatedAt.Format("2006-01-02 15:04:05"),
			"distance":        r.Distance,
		}
	}
	return out, nil
}

// --- lazy rag.Service handle -----------------------------------------------

// lazyMemoryService is a second, independent lazy-initialized rag.Service
// accessor for SaveMemory/SearchMemory above. It deliberately does not reuse
// wiring.go's lazyMemorySearcher/Wiring.Memory: that type only implements
// graph.MemorySearcher (SearchMemory alone, no SaveMemory), and widening it
// would mean editing wiring.go, which is out of scope for this pass (see
// Extra's doc comment). The tradeoff is a second ONNX embedder instance if
// both this and Wiring.Memory are ever exercised in the same process -- an
// acceptable, explicitly-flagged duplication rather than a silent one; a
// natural follow-up once every RPC group is wired is to fold both into one
// shared lazy accessor exposed directly on Wiring.
type lazyMemoryService struct {
	dataDir string
	conn    *sql.DB

	once sync.Once
	svc  *rag.Service
	err  error
}

func newLazyMemoryService(dataDir string, conn *sql.DB) *lazyMemoryService {
	return &lazyMemoryService{dataDir: dataDir, conn: conn}
}

func (l *lazyMemoryService) get() (*rag.Service, error) {
	l.once.Do(func() {
		embedder, err := rag.NewEmbedderFromEnv(l.dataDir)
		if err != nil {
			l.err = fmt.Errorf("rag memory service unavailable (embedder init failed): %w", err)
			log.Printf("[AI] %v", l.err)
			return
		}
		svc, err := rag.NewService(l.conn, embedder)
		if err != nil {
			l.err = fmt.Errorf("rag memory service unavailable (service init failed): %w", err)
			log.Printf("[AI] %v", l.err)
			return
		}
		l.svc = svc
	})
	return l.svc, l.err
}
