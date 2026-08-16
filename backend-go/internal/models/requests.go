package models

// Request models below mirror sidecar/src/models.py (and LogTraceRequest,
// which lives inline in sidecar/src/api.py) field-for-field, including JSON
// wire names. Optional/nullable Python fields (`X | None = None`) become Go
// pointer types so that "absent" and "explicit null" both decode to nil,
// matching Pydantic's Optional semantics. See shared.go for a note on
// default-value substitution, which this package does not replicate.

// GetLogsRequest mirrors models.py GetLogsRequest.
type GetLogsRequest struct {
	WorkspaceID string      `json:"workspace_id"`
	Offset      int         `json:"offset"`
	Limit       int         `json:"limit"`
	Filters     []LogFilter `json:"filters,omitempty"`
	Query       *string     `json:"query,omitempty"`
	SortBy      string      `json:"sort_by"`
	SortOrder   string      `json:"sort_order"`
	StartTime   *string     `json:"start_time,omitempty"`
	EndTime     *string     `json:"end_time,omitempty"`
}

// StartTailRequest mirrors models.py StartTailRequest (also used for stop_tail).
type StartTailRequest struct {
	Filepath    string  `json:"filepath"`
	WorkspaceID string  `json:"workspace_id"`
	SourceID    *string `json:"source_id,omitempty"`
}

// FolderCreateRequest mirrors models.py FolderCreateRequest.
type FolderCreateRequest struct {
	WorkspaceID string  `json:"workspace_id"`
	Name        string  `json:"name"`
	ParentID    *string `json:"parent_id,omitempty"`
}

// FolderUpdateRequest mirrors models.py FolderUpdateRequest.
type FolderUpdateRequest struct {
	FolderID string  `json:"folder_id"`
	Name     *string `json:"name,omitempty"`
	ParentID *string `json:"parent_id,omitempty"`
}

// FolderDeleteRequest mirrors models.py FolderDeleteRequest.
type FolderDeleteRequest struct {
	FolderID string `json:"folder_id"`
}

// SourceMoveRequest mirrors models.py SourceMoveRequest.
type SourceMoveRequest struct {
	SourceID string  `json:"source_id"`
	FolderID *string `json:"folder_id,omitempty"`
}

// SourceUpdateRequest mirrors models.py SourceUpdateRequest.
type SourceUpdateRequest struct {
	SourceID string  `json:"source_id"`
	Name     *string `json:"name,omitempty"`
	Type     *string `json:"type,omitempty"`
	Path     *string `json:"path,omitempty"`
	FolderID *string `json:"folder_id,omitempty"`
}

// CreateLogSourceRequest mirrors models.py CreateLogSourceRequest.
type CreateLogSourceRequest struct {
	WorkspaceID string  `json:"workspace_id"`
	Name        string  `json:"name"`
	Type        string  `json:"type"`
	Path        string  `json:"path"`
	FolderID    *string `json:"folder_id,omitempty"`
}

// DeleteLogSourceRequest mirrors models.py DeleteLogSourceRequest.
type DeleteLogSourceRequest struct {
	SourceID string `json:"source_id"`
}

// GetHierarchyRequest mirrors models.py GetHierarchyRequest.
type GetHierarchyRequest struct {
	WorkspaceID string `json:"workspace_id"`
}

// StartSSHTailRequest mirrors models.py StartSSHTailRequest.
type StartSSHTailRequest struct {
	Host        string  `json:"host"`
	Port        int     `json:"port"` // default 22 in Python
	Username    string  `json:"username"`
	Password    *string `json:"password,omitempty"`
	Filepath    string  `json:"filepath"`
	WorkspaceID string  `json:"workspace_id"`
	SourceID    *string `json:"source_id,omitempty"`
}

// IngestLogsRequest mirrors models.py IngestLogsRequest.
type IngestLogsRequest struct {
	Logs []IngestLogEntry `json:"logs"`
}

// IngestLocalFileRequest mirrors models.py IngestLocalFileRequest.
type IngestLocalFileRequest struct {
	WorkspaceID string `json:"workspace_id"`
	SourceID    string `json:"source_id"`
	Filepath    string `json:"filepath"`
}

// UpdateCommentRequest mirrors models.py UpdateCommentRequest.
type UpdateCommentRequest struct {
	LogID   int    `json:"log_id"`
	Comment string `json:"comment"`
}

// GetWorkspaceSourcesRequest mirrors models.py GetWorkspaceSourcesRequest.
type GetWorkspaceSourcesRequest struct {
	WorkspaceID string `json:"workspace_id"`
}

// ReadFileRequest mirrors models.py ReadFileRequest.
type ReadFileRequest struct {
	Filepath string `json:"filepath"`
}

// UpdateTemporalOffsetsRequest mirrors models.py UpdateTemporalOffsetsRequest.
type UpdateTemporalOffsetsRequest struct {
	WorkspaceID string         `json:"workspace_id"`
	Offsets     map[string]int `json:"offsets"`
}

// GetTemporalOffsetsRequest mirrors models.py GetTemporalOffsetsRequest.
type GetTemporalOffsetsRequest struct {
	WorkspaceID string `json:"workspace_id"`
}

// UpdateFusionConfigRequest mirrors models.py UpdateFusionConfigRequest.
type UpdateFusionConfigRequest struct {
	WorkspaceID string               `json:"workspace_id"`
	FusionID    string               `json:"fusion_id"` // default "default" in Python
	Sources     []FusionSourceConfig `json:"sources"`
}

// GetFusionConfigRequest mirrors models.py GetFusionConfigRequest.
type GetFusionConfigRequest struct {
	WorkspaceID string `json:"workspace_id"`
	FusionID    string `json:"fusion_id"` // default "default" in Python
}

// GetSampleLinesRequest mirrors models.py GetSampleLinesRequest.
type GetSampleLinesRequest struct {
	WorkspaceID string `json:"workspace_id"`
	SourceID    string `json:"source_id"`
	Limit       int    `json:"limit"` // default 10 in Python
}

// UpdateSourceParserRequest mirrors models.py UpdateSourceParserRequest.
type UpdateSourceParserRequest struct {
	WorkspaceID  string `json:"workspace_id"`
	SourceID     string `json:"source_id"`
	ParserConfig string `json:"parser_config"`
}

// GetFusedLogsRequest mirrors models.py GetFusedLogsRequest.
type GetFusedLogsRequest struct {
	WorkspaceID string      `json:"workspace_id"`
	FusionID    string      `json:"fusion_id"` // default "default" in Python
	Offset      int         `json:"offset"`
	Limit       int         `json:"limit"`
	Filters     []LogFilter `json:"filters,omitempty"`
	Query       *string     `json:"query,omitempty"`
	SortBy      string      `json:"sort_by"`
	SortOrder   string      `json:"sort_order"`
	StartTime   *string     `json:"start_time,omitempty"`
	EndTime     *string     `json:"end_time,omitempty"`
}

// GetAnomaliesRequest mirrors models.py GetAnomaliesRequest.
type GetAnomaliesRequest struct {
	WorkspaceID string  `json:"workspace_id"`
	TimeRange   *string `json:"time_range,omitempty"`
}

// GetDashboardStatsRequest mirrors models.py GetDashboardStatsRequest.
type GetDashboardStatsRequest struct {
	WorkspaceID        *string  `json:"workspace_id,omitempty"`
	SourceID           *string  `json:"source_id,omitempty"`
	StartTime          *string  `json:"start_time,omitempty"`
	EndTime            *string  `json:"end_time,omitempty"`
	ActiveWorkspaceIDs []string `json:"active_workspace_ids,omitempty"`
}

// GetIngestionJobsRequest mirrors models.py GetIngestionJobsRequest.
type GetIngestionJobsRequest struct {
	WorkspaceID *string `json:"workspace_id,omitempty"`
}

// GetClusteringStatusRequest mirrors models.py GetClusteringStatusRequest.
type GetClusteringStatusRequest struct {
	WorkspaceID *string `json:"workspace_id,omitempty"`
}

// SetClusteringModeRequest mirrors models.py SetClusteringModeRequest.
type SetClusteringModeRequest struct {
	Mode        string  `json:"mode"` // 'auto', 'burst'
	WorkspaceID *string `json:"workspace_id,omitempty"`
}

// SetClusteringPausedRequest mirrors models.py SetClusteringPausedRequest.
// Not wired into Python's RPC_MODELS map (set_clustering_paused is dispatched
// without validation there); kept here for parity/future use.
type SetClusteringPausedRequest struct {
	Paused      bool    `json:"paused"`
	WorkspaceID *string `json:"workspace_id,omitempty"`
}

// GetTimeBoundariesRequest mirrors models.py GetTimeBoundariesRequest.
type GetTimeBoundariesRequest struct {
	WorkspaceID string   `json:"workspace_id"`
	SourceIDs   []string `json:"source_ids,omitempty"`
}

// GetLogDistributionRequest mirrors models.py GetLogDistributionRequest.
// Not wired into Python's RPC_MODELS map; kept here for parity/future use.
type GetLogDistributionRequest struct {
	WorkspaceID string      `json:"workspace_id"`
	FusionID    *string     `json:"fusion_id,omitempty"`
	SourceIDs   []string    `json:"source_ids,omitempty"`
	Filters     []LogFilter `json:"filters,omitempty"`
	Query       *string     `json:"query,omitempty"`
	StartTime   *string     `json:"start_time,omitempty"`
	EndTime     *string     `json:"end_time,omitempty"`
}

// GetMetadataFacetsRequest mirrors models.py GetMetadataFacetsRequest.
type GetMetadataFacetsRequest struct {
	WorkspaceID string   `json:"workspace_id"`
	SourceIDs   []string `json:"source_ids,omitempty"`
}

// ExportLogsRequest mirrors models.py ExportLogsRequest.
type ExportLogsRequest struct {
	WorkspaceID string      `json:"workspace_id"`
	Filepath    string      `json:"filepath"`
	Format      string      `json:"format"` // default "csv" in Python
	Filters     []LogFilter `json:"filters,omitempty"`
	Query       *string     `json:"query,omitempty"`
	SourceIDs   []string    `json:"source_ids,omitempty"`
	FusionID    *string     `json:"fusion_id,omitempty"`
	StartTime   *string     `json:"start_time,omitempty"`
	EndTime     *string     `json:"end_time,omitempty"`
}

// TestAiConnectionRequest mirrors models.py TestAiConnectionRequest.
// Not wired into Python's RPC_MODELS map; kept here for parity/future use.
type TestAiConnectionRequest struct {
	WorkspaceID *string `json:"workspace_id,omitempty"`
}

// AnalyzeClusterRequest mirrors models.py AnalyzeClusterRequest.
type AnalyzeClusterRequest struct {
	ClusterID   string `json:"cluster_id"`
	WorkspaceID string `json:"workspace_id"`
	SampleSize  int    `json:"sample_size"` // default 20 in Python
}

// SendAiMessageRequest mirrors models.py SendAiMessageRequest.
type SendAiMessageRequest struct {
	WorkspaceID       string  `json:"workspace_id"`
	SessionID         *string `json:"session_id,omitempty"`
	SessionName       *string `json:"session_name,omitempty"`
	Message           string  `json:"message"`
	Model             *string `json:"model,omitempty"`
	ContextLogs       []int   `json:"context_logs,omitempty"`
	ProviderSessionID *string `json:"provider_session_id,omitempty"`
	Reasoning         *bool   `json:"reasoning,omitempty"` // default true in Python
}

// GetAiSessionsRequest mirrors models.py GetAiSessionsRequest.
type GetAiSessionsRequest struct {
	WorkspaceID string `json:"workspace_id"`
}

// GetAiMessagesRequest mirrors models.py GetAiMessagesRequest.
type GetAiMessagesRequest struct {
	SessionID string `json:"session_id"`
}

// SaveMemoryRequest mirrors models.py SaveMemoryRequest.
type SaveMemoryRequest struct {
	WorkspaceID    string `json:"workspace_id"`
	IssueSignature string `json:"issue_signature"`
	Resolution     string `json:"resolution"`
}

// SearchMemoryRequest mirrors models.py SearchMemoryRequest.
type SearchMemoryRequest struct {
	WorkspaceID string `json:"workspace_id"`
	Query       string `json:"query"`
	Limit       int    `json:"limit"` // default 5 in Python
}

// GetSettingsRequest mirrors models.py GetSettingsRequest (also used for
// reset_workspace_settings, per Python's RPC_MODELS).
type GetSettingsRequest struct {
	WorkspaceID *string `json:"workspace_id,omitempty"`
}

// UpdateSettingsRequest mirrors models.py UpdateSettingsRequest.
type UpdateSettingsRequest struct {
	Settings    map[string]any `json:"settings"`
	WorkspaceID *string        `json:"workspace_id,omitempty"`
}

// GetLogStreamsRequest mirrors models.py GetLogStreamsRequest.
type GetLogStreamsRequest struct {
	WorkspaceID string `json:"workspace_id"`
}

// CreateLogStreamRequest mirrors models.py CreateLogStreamRequest.
type CreateLogStreamRequest struct {
	WorkspaceID string `json:"workspace_id"`
	Name        string `json:"name"`
	Type        string `json:"type"` // 'syslog' or 'http'
	Port        int    `json:"port"`
}

// DeleteLogStreamRequest mirrors models.py DeleteLogStreamRequest.
type DeleteLogStreamRequest struct {
	ID int `json:"id"`
}

// GenerateExtractionRegexRequest mirrors models.py GenerateExtractionRegexRequest.
type GenerateExtractionRegexRequest struct {
	LogLine      string  `json:"log_line"`
	SelectedText string  `json:"selected_text"`
	WorkspaceID  *string `json:"workspace_id,omitempty"`
}

// DeleteLogsRequest mirrors models.py DeleteLogsRequest.
type DeleteLogsRequest struct {
	WorkspaceID string  `json:"workspace_id"`
	SourceID    *string `json:"source_id,omitempty"`
}

// PurgeInactiveWorkspacesRequest mirrors models.py PurgeInactiveWorkspacesRequest.
type PurgeInactiveWorkspacesRequest struct {
	ActiveWorkspaceIDs []string `json:"active_workspace_ids"`
}

// GetLogContentRequest mirrors models.py GetLogContentRequest.
type GetLogContentRequest struct {
	SourceID string `json:"source_id"`
	LineIDs  []int  `json:"line_ids"`
}

// DeleteWorkspaceRequest mirrors models.py DeleteWorkspaceRequest.
type DeleteWorkspaceRequest struct {
	WorkspaceID string `json:"workspace_id"`
}

// LogTraceRequest mirrors the inline LogTraceRequest class in sidecar/src/api.py.
type LogTraceRequest struct {
	Message string `json:"message"`
}
