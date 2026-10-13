package rpc

import (
	"encoding/json"

	"loglensai/backend-go/internal/models"
)

// paramModels mirrors sidecar/src/api.py's App.RPC_MODELS dict: method name
// (without the "method_" prefix) -> params model factory. A method present
// in Python's RPC_MODELS but mapped to `None` (list_ai_models,
// rename_ai_session, delete_ai_session, get_ai_mapping, factory_reset,
// get_health), or absent from RPC_MODELS entirely (set_clustering_paused,
// get_log_distribution, cleanup_ingestion_jobs, get_sample_logs, is_tailing,
// get_clusters, test_ai_connection, save_template, get_templates,
// delete_template, update_temporal_offsets, reset_templates), is simply
// omitted here -- Dispatch treats a missing factory as "no validation,
// params passed through raw", which is exactly Python's behavior in both
// cases (`model = RPC_MODELS.get(req.method)` is None either way).
var paramModels = map[string]ParamsFactory{
	"get_logs":                  func() any { return &models.GetLogsRequest{} },
	"get_fused_logs":            func() any { return &models.GetFusedLogsRequest{} },
	"update_fusion_config":      func() any { return &models.UpdateFusionConfigRequest{} },
	"get_fusion_config":         func() any { return &models.GetFusionConfigRequest{} },
	"start_tail":                func() any { return &models.StartTailRequest{} },
	"start_ssh_tail":            func() any { return &models.StartSSHTailRequest{} },
	"stop_tail":                 func() any { return &models.StartTailRequest{} },
	"ingest_logs":               func() any { return &models.IngestLogsRequest{} },
	"ingest_local_file":         func() any { return &models.IngestLocalFileRequest{} },
	"read_file":                 func() any { return &models.ReadFileRequest{} },
	"update_log_comment":        func() any { return &models.UpdateCommentRequest{} },
	"get_temporal_offsets":      func() any { return &models.GetTemporalOffsetsRequest{} },
	"get_workspace_sources":     func() any { return &models.GetWorkspaceSourcesRequest{} },
	"get_ingestion_jobs":        func() any { return &models.GetIngestionJobsRequest{} },
	"get_clustering_status":     func() any { return &models.GetClusteringStatusRequest{} },
	"set_clustering_mode":       func() any { return &models.SetClusteringModeRequest{} },
	"get_sample_lines":          func() any { return &models.GetSampleLinesRequest{} },
	"update_source_parser":      func() any { return &models.UpdateSourceParserRequest{} },
	"get_anomalies":             func() any { return &models.GetAnomaliesRequest{} },
	"get_metadata_facets":       func() any { return &models.GetMetadataFacetsRequest{} },
	"analyze_cluster":           func() any { return &models.AnalyzeClusterRequest{} },
	"get_settings":              func() any { return &models.GetSettingsRequest{} },
	"get_time_boundaries":       func() any { return &models.GetTimeBoundariesRequest{} },
	"update_settings":           func() any { return &models.UpdateSettingsRequest{} },
	"get_dashboard_stats":       func() any { return &models.GetDashboardStatsRequest{} },
	"purge_inactive_workspaces": func() any { return &models.PurgeInactiveWorkspacesRequest{} },
	"log_trace":                 func() any { return &models.LogTraceRequest{} },
	"send_ai_message":           func() any { return &models.SendAiMessageRequest{} },
	"get_ai_sessions":           func() any { return &models.GetAiSessionsRequest{} },
	"get_ai_messages":           func() any { return &models.GetAiMessagesRequest{} },
	"save_memory":               func() any { return &models.SaveMemoryRequest{} },
	"search_memory":             func() any { return &models.SearchMemoryRequest{} },
	"sync_knowledge_base":       func() any { return &models.SyncKnowledgeBaseRequest{} },
	"get_rag_model_status":      func() any { return &models.GetRAGModelStatusRequest{} },
	"download_rag_model":        func() any { return &models.DownloadRAGModelRequest{} },
	"delete_rag_model":          func() any { return &models.DeleteRAGModelRequest{} },
	"delete_laya_model":         func() any { return &models.DeleteLayaModelRequest{} },
	"reset_workspace_settings":  func() any { return &models.GetSettingsRequest{} },
	"get_log_streams":           func() any { return &models.GetLogStreamsRequest{} },
	"create_log_stream":         func() any { return &models.CreateLogStreamRequest{} },
	"delete_log_stream":         func() any { return &models.DeleteLogStreamRequest{} },
	"generate_facet_regex":      func() any { return &models.GenerateExtractionRegexRequest{} },
	"export_logs":               func() any { return &models.ExportLogsRequest{} },
	"delete_logs":               func() any { return &models.DeleteLogsRequest{} },
	"delete_workspace":          func() any { return &models.DeleteWorkspaceRequest{} },
	"get_hierarchy":             func() any { return &models.GetHierarchyRequest{} },
	"create_folder":             func() any { return &models.FolderCreateRequest{} },
	"update_folder":             func() any { return &models.FolderUpdateRequest{} },
	"delete_folder":             func() any { return &models.FolderDeleteRequest{} },
	"create_log_source":         func() any { return &models.CreateLogSourceRequest{} },
	"update_log_source":         func() any { return &models.SourceUpdateRequest{} },
	"delete_log_source":         func() any { return &models.DeleteLogSourceRequest{} },
	"move_source":               func() any { return &models.SourceMoveRequest{} },
	"get_log_content":           func() any { return &models.GetLogContentRequest{} },
}

// allMethods is the full list of method_* names found in sidecar/src/api.py
// (`grep -n "def method_" sidecar/src/api.py`), with the "method_" prefix
// stripped -- these are the JSON-RPC wire method names. Every one of these
// must be dispatchable, even as a stub, so the transport-layer contract is
// complete before later phases replace stubs with real implementations
// subsystem by subsystem.
var allMethods = []string{
	"get_ingestion_jobs",
	"get_clustering_status",
	"set_clustering_mode",
	"set_clustering_paused",
	"delete_logs",
	"delete_workspace",
	"factory_reset",
	"get_time_boundaries",
	"get_logs",
	"export_logs",
	"get_log_distribution",
	"get_anomalies",
	"get_fused_logs",
	"update_fusion_config",
	"get_sample_lines",
	"update_source_parser",
	"get_log_content",
	"get_fusion_config",
	"start_tail",
	"start_ssh_tail",
	"stop_tail",
	"read_file",
	"ingest_logs",
	"ingest_local_file",
	"cleanup_ingestion_jobs",
	"log_trace",
	"get_metadata_facets",
	"get_sample_logs",
	"update_log_comment",
	"get_workspace_sources",
	"get_hierarchy",
	"create_folder",
	"update_folder",
	"delete_folder",
	"create_log_source",
	"update_log_source",
	"delete_log_source",
	"move_source",
	"is_tailing",
	"get_clusters",
	"analyze_cluster",
	"list_ai_models",
	"test_ai_connection",
	"send_ai_message",
	"get_ai_sessions",
	"get_ai_messages",
	"rename_ai_session",
	"delete_ai_session",
	"get_ai_mapping",
	"save_template",
	"get_templates",
	"delete_template",
	"save_memory",
	"search_memory",
	"sync_knowledge_base",
	"get_rag_model_status",
	"download_rag_model",
	"delete_rag_model",
	"delete_laya_model",
	"update_temporal_offsets",
	"get_temporal_offsets",
	"get_settings",
	"reset_workspace_settings",
	"update_settings",
	"reset_templates",
	"get_log_streams",
	"create_log_stream",
	"delete_log_stream",
	"generate_facet_regex",
	"get_health",
	"get_dashboard_stats",
	"purge_inactive_workspaces",
}

// stubHandler returns a placeholder Handler for a not-yet-ported method.
// Later migration phases replace these registrations one subsystem at a
// time (see docs/migration/STATUS.md).
func stubHandler(method string) Handler {
	return func(params json.RawMessage) (any, *models.RPCError) {
		return map[string]any{
			"status": "not_implemented",
			"method": method,
		}, nil
	}
}

// RegisterStubs registers every method in allMethods against the registry
// with a stub handler, applying params validation for any method that has
// an entry in paramModels (mirroring Python's RPC_MODELS-driven Pydantic
// validation). This gives the full ~65-method RPC surface a dispatchable,
// testable shape before real business logic lands in later phases.
func RegisterStubs(r *Registry) {
	for _, method := range allMethods {
		h := stubHandler(method)
		if factory, ok := paramModels[method]; ok {
			r.RegisterWithModel(method, factory, h)
		} else {
			r.Register(method, h)
		}
	}
}
