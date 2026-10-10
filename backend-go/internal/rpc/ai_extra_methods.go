package rpc

import (
	"context"
	"encoding/json"

	"loglensai/backend-go/internal/ai"
	"loglensai/backend-go/internal/app"
	"loglensai/backend-go/internal/models"
)

// RegisterAIExtraMethods wires the AI session management, cluster analysis,
// dashboard stats, and anomaly RPC methods that RegisterApp
// (app_methods.go) and RegisterAI (ai_methods.go, send_ai_message only)
// leave as stubs: get_ai_sessions, get_ai_messages, rename_ai_session,
// delete_ai_session, get_ai_mapping, get_anomalies, get_dashboard_stats
// (all backed directly by *app.App -- see internal/app/handlers_ai_extra.go),
// plus analyze_cluster, list_ai_models, test_ai_connection,
// generate_facet_regex, save_memory, and search_memory (backed by extra,
// which needs the AI provider -- see internal/ai/rpc_extra.go).
//
// Follows the same override-after-RegisterStubs pattern as RegisterApp/
// RegisterAI (see app_methods.go's doc comment): call this after
// RegisterStubs (and, if desired, RegisterApp/RegisterAI; registration
// order between all of these doesn't matter, they touch disjoint method
// names).
//
// Deviation from the originally-sketched signature
// (`RegisterAIExtraMethods(r *Registry, a *app.App, w *ai.Wiring) error`):
// this takes an *ai.Extra instead of *ai.Wiring, and returns nothing.
// *ai.Wiring's fields (graph.Provider, *graph.ToolRegistry,
// graph.MemorySearcher) are shaped for the send_ai_message investigation
// loop specifically and don't expose what analyze_cluster/list_ai_models/
// test_ai_connection (need the raw providers.Provider, not graph.Provider)
// or save_memory (needs rag.Service.SaveMemory, which graph.MemorySearcher
// doesn't expose) actually require -- see ai.Extra's doc comment in
// internal/ai/rpc_extra.go for the full reasoning. No registration here can
// fail, so there's nothing for an error return to report, matching
// RegisterApp/RegisterAI's own (error-less) signatures.
func RegisterAIExtraMethods(r *Registry, a *app.App, extra *ai.Extra) {
	// --- DB-only methods (internal/app/handlers_ai_extra.go) ---

	r.RegisterWithModel("get_ai_sessions", paramModels["get_ai_sessions"], appHandler(func(req models.GetAiSessionsRequest) (any, *models.RPCError) {
		return a.GetAISessions(req.WorkspaceID)
	}))
	r.RegisterWithModel("get_ai_messages", paramModels["get_ai_messages"], appHandler(func(req models.GetAiMessagesRequest) (any, *models.RPCError) {
		return a.GetAIMessages(req.SessionID)
	}))

	// rename_ai_session/delete_ai_session/get_ai_mapping have no RPC_MODELS
	// entry in api.py (mapped to None -- unvalidated params), matching
	// app_methods.go's is_tailing/get_clusters pattern of decoding raw
	// params locally.
	r.Register("rename_ai_session", func(params json.RawMessage) (any, *models.RPCError) {
		var req struct {
			SessionID string `json:"session_id"`
			Name      string `json:"name"`
		}
		if err := json.Unmarshal(params, &req); err != nil {
			return nil, invalidParamsErr(err)
		}
		return a.RenameAISession(req.SessionID, req.Name)
	})
	r.Register("delete_ai_session", func(params json.RawMessage) (any, *models.RPCError) {
		var req struct {
			SessionID string `json:"session_id"`
		}
		if err := json.Unmarshal(params, &req); err != nil {
			return nil, invalidParamsErr(err)
		}
		return a.DeleteAISession(req.SessionID)
	})
	r.Register("get_ai_mapping", func(params json.RawMessage) (any, *models.RPCError) {
		var req struct {
			WorkspaceID string `json:"workspace_id"`
		}
		if err := json.Unmarshal(params, &req); err != nil {
			return nil, invalidParamsErr(err)
		}
		return a.GetAIMapping(req.WorkspaceID)
	})

	r.RegisterWithModel("get_anomalies", paramModels["get_anomalies"], appHandler(func(req models.GetAnomaliesRequest) (any, *models.RPCError) {
		return a.GetAnomalies(req)
	}))
	r.RegisterWithModel("get_dashboard_stats", paramModels["get_dashboard_stats"], appHandler(func(req models.GetDashboardStatsRequest) (any, *models.RPCError) {
		return a.GetDashboardStats(req)
	}))

	// --- AI-provider-dependent methods (internal/ai/rpc_extra.go) ---

	r.RegisterWithModel("analyze_cluster", paramModels["analyze_cluster"], func(params json.RawMessage) (any, *models.RPCError) {
		var req models.AnalyzeClusterRequest
		if err := json.Unmarshal(params, &req); err != nil {
			return nil, invalidParamsErr(err)
		}
		return extra.AnalyzeCluster(context.Background(), req)
	})

	// list_ai_models/test_ai_connection have no RPC_MODELS entry in api.py.
	r.Register("list_ai_models", func(json.RawMessage) (any, *models.RPCError) {
		return extra.ListModels(context.Background())
	})
	r.Register("test_ai_connection", func(json.RawMessage) (any, *models.RPCError) {
		return extra.TestConnection(context.Background())
	})

	r.RegisterWithModel("generate_facet_regex", paramModels["generate_facet_regex"], func(params json.RawMessage) (any, *models.RPCError) {
		var req models.GenerateExtractionRegexRequest
		if err := json.Unmarshal(params, &req); err != nil {
			return nil, invalidParamsErr(err)
		}
		return extra.GenerateFacetRegex(context.Background(), req)
	})
	r.RegisterWithModel("save_memory", paramModels["save_memory"], func(params json.RawMessage) (any, *models.RPCError) {
		var req models.SaveMemoryRequest
		if err := json.Unmarshal(params, &req); err != nil {
			return nil, invalidParamsErr(err)
		}
		return extra.SaveMemory(context.Background(), req)
	})
	r.RegisterWithModel("search_memory", paramModels["search_memory"], func(params json.RawMessage) (any, *models.RPCError) {
		var req models.SearchMemoryRequest
		if err := json.Unmarshal(params, &req); err != nil {
			return nil, invalidParamsErr(err)
		}
		return extra.SearchMemory(context.Background(), req)
	})
	r.RegisterWithModel("sync_knowledge_base", paramModels["sync_knowledge_base"], func(params json.RawMessage) (any, *models.RPCError) {
		var req models.SyncKnowledgeBaseRequest
		if err := json.Unmarshal(params, &req); err != nil {
			return nil, invalidParamsErr(err)
		}
		return extra.SyncKnowledgeBase(context.Background(), req)
	})
}
