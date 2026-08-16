package models

// This file adds request structs for the log-data-operations RPC subset
// (get_sample_logs, cleanup_ingestion_jobs) that sidecar/src/api.py never
// registered in its RPC_MODELS dict (both are dispatched with raw,
// unvalidated kwargs in Python -- see methods.go's paramModels doc comment
// for the full list of methods that share this property). Kept in a
// separate new file rather than appended to requests.go so this migration
// slice doesn't need to touch a file other concurrent RPC-wiring passes are
// also likely editing.

// GetSampleLogsRequest mirrors sidecar/src/api.py's
// method_get_sample_logs(workspace_id: str, limit: int = 10, source_id: str
// | None = None) kwargs shape.
type GetSampleLogsRequest struct {
	WorkspaceID string  `json:"workspace_id"`
	Limit       int     `json:"limit"`
	SourceID    *string `json:"source_id,omitempty"`
}

// CleanupIngestionJobsRequest mirrors sidecar/src/api.py's
// method_cleanup_ingestion_jobs(workspace_id: str) kwargs shape.
type CleanupIngestionJobsRequest struct {
	WorkspaceID string `json:"workspace_id"`
}
