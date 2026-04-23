from typing import Any

from pydantic import BaseModel


# --- Configuration Models ---
class FacetExtractionRule(BaseModel):
    name: str
    regex: str
    group: int = 1
    enabled: bool = True


# RPC Base Models
class JSONRPCRequest(BaseModel):
    jsonrpc: str = "2.0"
    id: Any | None = None
    method: str
    params: dict = {}


class JSONRPCResponse(BaseModel):
    jsonrpc: str = "2.0"
    id: Any | None = None
    result: Any | None = None
    error: dict | None = None


# --- Specific Request/Response Models ---
class LogFilter(BaseModel):
    field: str
    value: str
    operator: str = "contains"


class GetLogsRequest(BaseModel):
    workspace_id: str
    offset: int = 0
    limit: int = 100
    filters: list[LogFilter] | None = None
    query: str | None = None
    sort_by: str = "id"
    sort_order: str = "DESC"
    start_time: str | None = None
    end_time: str | None = None


class StartTailRequest(BaseModel):
    filepath: str
    workspace_id: str
    source_id: str | None = None


class FolderCreateRequest(BaseModel):
    workspace_id: str
    name: str
    parent_id: str | None = None


class FolderUpdateRequest(BaseModel):
    folder_id: str
    name: str | None = None
    parent_id: str | None = None


class FolderDeleteRequest(BaseModel):
    folder_id: str


class SourceMoveRequest(BaseModel):
    source_id: str
    folder_id: str | None = None


class SourceUpdateRequest(BaseModel):
    source_id: str
    name: str | None = None
    type: str | None = None
    path: str | None = None
    folder_id: str | None = None


class CreateLogSourceRequest(BaseModel):
    workspace_id: str
    name: str
    type: str
    path: str
    folder_id: str | None = None


class DeleteLogSourceRequest(BaseModel):
    source_id: str


class GetHierarchyRequest(BaseModel):
    workspace_id: str


class HierarchySource(BaseModel):
    id: str
    name: str
    type: str
    path: str


class HierarchyNode(BaseModel):
    id: str
    name: str
    type: str = "folder"
    children: list["HierarchyNode"] = []
    sources: list[HierarchySource] = []


class HierarchyResponse(BaseModel):
    workspace_id: str
    root: HierarchyNode


class StartSSHTailRequest(BaseModel):
    host: str
    port: int = 22
    username: str
    password: str | None = None
    filepath: str
    workspace_id: str
    source_id: str | None = None


class IngestLogEntry(BaseModel):
    workspace_id: str
    source_id: str = "manual"
    raw_text: str
    timestamp: str | None = None
    level: str = "INFO"
    message: str | None = None


class IngestLogsRequest(BaseModel):
    logs: list[IngestLogEntry]


class UpdateCommentRequest(BaseModel):
    log_id: int
    comment: str


class GetWorkspaceSourcesRequest(BaseModel):
    workspace_id: str


class ReadFileRequest(BaseModel):
    filepath: str


class FusionSourceConfig(BaseModel):
    source_id: str
    enabled: bool = True
    tz_offset: int = 0
    custom_format: str | None = None
    parser_config: str | None = None


class TemporalOffsetEntry(BaseModel):
    source_id: str
    offset_seconds: int


class UpdateTemporalOffsetsRequest(BaseModel):
    workspace_id: str
    offsets: dict[str, int]


class GetTemporalOffsetsRequest(BaseModel):
    workspace_id: str


class UpdateFusionConfigRequest(BaseModel):
    workspace_id: str
    fusion_id: str = "default"
    sources: list[FusionSourceConfig]


class GetFusionConfigRequest(BaseModel):
    workspace_id: str
    fusion_id: str = "default"


class GetSampleLinesRequest(BaseModel):
    workspace_id: str
    source_id: str
    limit: int = 10


class UpdateSourceParserRequest(BaseModel):
    workspace_id: str
    source_id: str
    parser_config: str


class GetFusedLogsRequest(BaseModel):
    workspace_id: str
    fusion_id: str = "default"
    offset: int = 0
    limit: int = 100
    filters: list[LogFilter] | None = None
    query: str | None = None
    sort_by: str = "id"
    sort_order: str = "DESC"
    start_time: str | None = None
    end_time: str | None = None


class GetAnomaliesRequest(BaseModel):
    workspace_id: str
    time_range: str | None = None


class GetDashboardStatsRequest(BaseModel):
    workspace_id: str | None = None


class GetLogDistributionRequest(BaseModel):
    workspace_id: str
    fusion_id: str | None = None
    source_ids: list[str] | None = None
    filters: list[LogFilter] | None = None
    query: str | None = None
    start_time: str | None = None
    end_time: str | None = None


class GetMetadataFacetsRequest(BaseModel):
    workspace_id: str
    source_ids: list[str] | None = None


class ExportLogsRequest(BaseModel):
    workspace_id: str
    filepath: str
    format: str = "csv"  # "csv" or "json"
    filters: list[LogFilter] | None = None
    query: str | None = None
    source_ids: list[str] | None = None
    fusion_id: str | None = None
    start_time: str | None = None
    end_time: str | None = None


class TestAiConnectionRequest(BaseModel):
    workspace_id: str | None = None


# AI Models
class SendAiMessageRequest(BaseModel):
    workspace_id: str
    session_id: str | None = None  # UUID if existing, None to create
    session_name: str | None = None  # Optional name if creating
    message: str
    model: str | None = None
    context_logs: list[int] | None = None  # List of log IDs to include as context
    provider_session_id: str | None = None  # Explicit taskId/threadId reuse
    reasoning: bool | None = True  # Whether to enforce deep reasoning phase


class GetAiSessionsRequest(BaseModel):
    workspace_id: str


class GetAiMessagesRequest(BaseModel):
    session_id: str


class SaveMemoryRequest(BaseModel):
    workspace_id: str
    issue_signature: str
    resolution: str


class SearchMemoryRequest(BaseModel):
    workspace_id: str
    query: str
    limit: int = 5


class GetSettingsRequest(BaseModel):
    workspace_id: str | None = None


class UpdateSettingsRequest(BaseModel):
    settings: dict
    workspace_id: str | None = None


class GetLogStreamsRequest(BaseModel):
    workspace_id: str


class CreateLogStreamRequest(BaseModel):
    workspace_id: str
    name: str
    type: str  # 'syslog' or 'http'
    port: int


class DeleteLogStreamRequest(BaseModel):
    id: int


class GenerateExtractionRegexRequest(BaseModel):
    log_line: str
    selected_text: str
    workspace_id: str | None = None


class DeleteLogsRequest(BaseModel):
    workspace_id: str
    source_id: str | None = None
