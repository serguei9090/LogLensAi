package rpc

import (
	"loglensai/backend-go/internal/app"
	"loglensai/backend-go/internal/models"
)

// RegisterLogOpsMethods wires the "log data operations" subset of the RPC
// surface -- delete/export logs, raw-line/random-log sampling, per-source
// parser config, fusion config CRUD + interleaved fused-log reads, log
// comments, raw local-file reads, SSH tailing, frontend trace logging, and
// ingestion-job listing/cleanup -- against a live *app.App. Follows the
// exact pattern RegisterApp (app_methods.go) established: each wrapper
// decodes its own params via appHandler (defined there, reused here since
// this file is still package rpc), and params-validation models are looked
// up from the shared paramModels map (methods.go) exactly like RegisterApp
// does, rather than duplicating that map's entries here.
//
// A method with no paramModels entry is registered via plain Register
// (no validation model) rather than RegisterWithModel -- get_sample_logs,
// cleanup_ingestion_jobs, and get_log_distribution all fall in this bucket,
// matching api.py's RPC_MODELS, which has no entry for any of the three
// either (see methods.go's paramModels doc comment, which already lists
// all three).
//
// NOT wired into cmd/sidecar/main.go by this change (per this migration
// pass's scope) -- that integration step is left for a follow-up once every
// method-group owner's Register* function exists side by side.
func RegisterLogOpsMethods(r *Registry, a *app.App) {
	r.RegisterWithModel("delete_logs", paramModels["delete_logs"], appHandler(func(req models.DeleteLogsRequest) (any, *models.RPCError) {
		return a.DeleteLogs(req)
	}))
	r.RegisterWithModel("export_logs", paramModels["export_logs"], appHandler(func(req models.ExportLogsRequest) (any, *models.RPCError) {
		return a.ExportLogs(req)
	}))
	r.RegisterWithModel("get_sample_lines", paramModels["get_sample_lines"], appHandler(func(req models.GetSampleLinesRequest) (any, *models.RPCError) {
		return a.GetSampleLines(req)
	}))
	r.RegisterWithModel("update_source_parser", paramModels["update_source_parser"], appHandler(func(req models.UpdateSourceParserRequest) (any, *models.RPCError) {
		return a.UpdateSourceParser(req)
	}))
	r.RegisterWithModel("get_fusion_config", paramModels["get_fusion_config"], appHandler(func(req models.GetFusionConfigRequest) (any, *models.RPCError) {
		return a.GetFusionConfig(req)
	}))
	r.RegisterWithModel("update_fusion_config", paramModels["update_fusion_config"], appHandler(func(req models.UpdateFusionConfigRequest) (any, *models.RPCError) {
		return a.UpdateFusionConfig(req)
	}))
	r.RegisterWithModel("get_fused_logs", paramModels["get_fused_logs"], appHandler(func(req models.GetFusedLogsRequest) (any, *models.RPCError) {
		return a.GetFusedLogs(req)
	}))
	r.Register("get_sample_logs", appHandler(func(req models.GetSampleLogsRequest) (any, *models.RPCError) {
		return a.GetSampleLogs(req)
	}))
	r.RegisterWithModel("update_log_comment", paramModels["update_log_comment"], appHandler(func(req models.UpdateCommentRequest) (any, *models.RPCError) {
		return a.UpdateLogComment(req)
	}))
	r.RegisterWithModel("read_file", paramModels["read_file"], appHandler(func(req models.ReadFileRequest) (any, *models.RPCError) {
		return a.ReadFile(req)
	}))
	r.RegisterWithModel("start_ssh_tail", paramModels["start_ssh_tail"], appHandler(func(req models.StartSSHTailRequest) (any, *models.RPCError) {
		return a.StartSSHTail(req)
	}))
	r.RegisterWithModel("log_trace", paramModels["log_trace"], appHandler(func(req models.LogTraceRequest) (any, *models.RPCError) {
		return a.LogTrace(req)
	}))
	r.Register("cleanup_ingestion_jobs", appHandler(func(req models.CleanupIngestionJobsRequest) (any, *models.RPCError) {
		return a.CleanupIngestionJobs(req)
	}))
	r.RegisterWithModel("get_ingestion_jobs", paramModels["get_ingestion_jobs"], appHandler(func(req models.GetIngestionJobsRequest) (any, *models.RPCError) {
		return a.GetIngestionJobs(req)
	}))
	r.Register("get_log_distribution", appHandler(func(req models.GetLogDistributionRequest) (any, *models.RPCError) {
		return a.GetLogDistribution(req)
	}))
}
