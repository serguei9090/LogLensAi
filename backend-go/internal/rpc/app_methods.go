package rpc

import (
	"encoding/json"

	"loglensai/backend-go/internal/app"
	"loglensai/backend-go/internal/models"
)

// RegisterApp overrides a core subset of the stub registrations installed
// by RegisterStubs with real handlers backed by a, a live *app.App
// composition root — enough of the ~67-method RPC surface to prove an
// end-to-end pipeline (ingest -> tail/parse/store -> cluster -> query), per
// docs/migration/STATUS.md's Phase 2 wiring step. Every other method (the
// remaining ~54: settings CRUD, folders/sources CRUD, AI, dashboard,
// anomalies, templates, fusion config, export, ...) is left exactly as
// RegisterStubs installed it; call RegisterStubs before this so those
// registrations exist first.
//
// Each wrapper here decodes params itself (Dispatch only validates shape
// against the model registered via paramModels/RegisterWithModel — it does
// not thread the decoded struct through to the handler, see dispatch.go),
// mirroring how Python's dispatch() calls `handler(**params_model.model_dump())`
// after validating.
func RegisterApp(r *Registry, a *app.App) {
	r.RegisterWithModel("get_logs", paramModels["get_logs"], appHandler(func(req models.GetLogsRequest) (any, *models.RPCError) {
		return a.GetLogs(req)
	}))

	r.RegisterWithModel("start_tail", paramModels["start_tail"], appHandler(func(req models.StartTailRequest) (any, *models.RPCError) {
		return a.StartTail(req)
	}))
	r.RegisterWithModel("stop_tail", paramModels["stop_tail"], appHandler(func(req models.StartTailRequest) (any, *models.RPCError) {
		return a.StopTail(req)
	}))
	r.Register("is_tailing", func(params json.RawMessage) (any, *models.RPCError) {
		var req struct {
			Filepath    string `json:"filepath"`
			WorkspaceID string `json:"workspace_id"`
		}
		if err := json.Unmarshal(params, &req); err != nil {
			return nil, invalidParamsErr(err)
		}
		return a.IsTailing(req.Filepath, req.WorkspaceID), nil
	})

	r.RegisterWithModel("ingest_logs", paramModels["ingest_logs"], appHandler(func(req models.IngestLogsRequest) (any, *models.RPCError) {
		return a.IngestLogs(req)
	}))
	r.RegisterWithModel("ingest_local_file", paramModels["ingest_local_file"], appHandler(func(req models.IngestLocalFileRequest) (any, *models.RPCError) {
		return a.IngestLocalFile(req)
	}))

	r.RegisterWithModel("get_clustering_status", paramModels["get_clustering_status"], appHandler(func(req models.GetClusteringStatusRequest) (any, *models.RPCError) {
		return a.GetClusteringStatus(req)
	}))
	r.RegisterWithModel("set_clustering_mode", paramModels["set_clustering_mode"], appHandler(func(req models.SetClusteringModeRequest) (any, *models.RPCError) {
		return a.SetClusteringMode(req)
	}))
	// set_clustering_paused has no RPC_MODELS entry in api.py (dispatched
	// with raw params, unvalidated) -- see registry.go / methods.go's
	// paramModels doc comment. Decode manually here to match.
	r.Register("set_clustering_paused", func(params json.RawMessage) (any, *models.RPCError) {
		var req models.SetClusteringPausedRequest
		if err := json.Unmarshal(params, &req); err != nil {
			return nil, invalidParamsErr(err)
		}
		return a.SetClusteringPaused(req)
	})
	r.Register("get_clusters", func(params json.RawMessage) (any, *models.RPCError) {
		var req struct {
			WorkspaceID string `json:"workspace_id"`
		}
		if err := json.Unmarshal(params, &req); err != nil {
			return nil, invalidParamsErr(err)
		}
		return a.GetClusters(req.WorkspaceID)
	})

	r.RegisterWithModel("get_metadata_facets", paramModels["get_metadata_facets"], appHandler(func(req models.GetMetadataFacetsRequest) (any, *models.RPCError) {
		return a.GetMetadataFacets(req)
	}))
	r.RegisterWithModel("get_log_content", paramModels["get_log_content"], appHandler(func(req models.GetLogContentRequest) (any, *models.RPCError) {
		return a.GetLogContent(req)
	}))

	// get_health has no RPC_MODELS entry in api.py (mapped to None) and
	// takes no params.
	r.Register("get_health", func(params json.RawMessage) (any, *models.RPCError) {
		return a.GetHealth()
	})

	// Laya AI System 1 decision engine methods
	r.RegisterWithModel("get_laya_settings", func() any { return &models.GetLayaSettingsRequest{} }, appHandler(func(req models.GetLayaSettingsRequest) (any, *models.RPCError) {
		return a.GetLayaSettings(req)
	}))
	r.RegisterWithModel("update_laya_settings", func() any { return &models.UpdateLayaSettingsRequest{} }, appHandler(func(req models.UpdateLayaSettingsRequest) (any, *models.RPCError) {
		return a.UpdateLayaSettings(req)
	}))
	r.RegisterWithModel("get_laya_checkpoints", func() any { return &models.GetLayaCheckpointsRequest{} }, appHandler(func(req models.GetLayaCheckpointsRequest) (any, *models.RPCError) {
		return a.GetLayaCheckpoints(req)
	}))
	r.RegisterWithModel("rollback_laya_checkpoint", func() any { return &models.RollbackLayaCheckpointRequest{} }, appHandler(func(req models.RollbackLayaCheckpointRequest) (any, *models.RPCError) {
		return a.RollbackLayaCheckpoint(req)
	}))
	r.RegisterWithModel("save_laya_rules", func() any { return &models.SaveLayaRulesRequest{} }, appHandler(func(req models.SaveLayaRulesRequest) (any, *models.RPCError) {
		return a.SaveLayaRules(req)
	}))
	r.RegisterWithModel("test_laya_rule", func() any { return &models.TestLayaRuleRequest{} }, appHandler(func(req models.TestLayaRuleRequest) (any, *models.RPCError) {
		return a.TestLayaRule(req)
	}))
}

// appHandler decodes params into a T and calls fn, converting a decode
// failure into the same -32602 Invalid params shape Dispatch itself would
// produce (appHandler-wrapped methods are also registered with a model via
// RegisterWithModel, so in practice Dispatch already rejected malformed
// params before the handler runs -- this decode essentially always
// succeeds; the error path exists for defense in depth / methods registered
// without a model in the future).
func appHandler[T any](fn func(T) (any, *models.RPCError)) Handler {
	return func(params json.RawMessage) (any, *models.RPCError) {
		var req T
		if len(params) > 0 {
			if err := json.Unmarshal(params, &req); err != nil {
				return nil, invalidParamsErr(err)
			}
		}
		return fn(req)
	}
}

func invalidParamsErr(err error) *models.RPCError {
	return &models.RPCError{Code: CodeInvalidParams, Message: "Invalid params", Data: err.Error()}
}
