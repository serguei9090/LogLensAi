import json
import os
import sys

# Add sidecar/src to path
sys.path.insert(0, os.path.join(os.getcwd(), "sidecar", "src"))

from models import (
    FusionSourceConfig,
    GetAiMessagesRequest,
    GetAiSessionsRequest,
    GetAnomaliesRequest,
    GetFusedLogsRequest,
    GetFusionConfigRequest,
    GetLogDistributionRequest,
    GetLogsRequest,
    GetMetadataFacetsRequest,
    GetSampleLinesRequest,
    GetSettingsRequest,
    GetTemporalOffsetsRequest,
    GetWorkspaceSourcesRequest,
    IngestLogEntry,
    IngestLogsRequest,
    JSONRPCRequest,
    JSONRPCResponse,
    LogFilter,
    ReadFileRequest,
    SaveMemoryRequest,
    SearchMemoryRequest,
    SendAiMessageRequest,
    StartSSHTailRequest,
    StartTailRequest,
    UpdateCommentRequest,
    UpdateFusionConfigRequest,
    UpdateSettingsRequest,
    UpdateSourceParserRequest,
    UpdateTemporalOffsetsRequest,
)
from pydantic.json_schema import models_json_schema


def generate_schema():
    models = [
        JSONRPCRequest,
        JSONRPCResponse,
        LogFilter,
        GetLogsRequest,
        StartTailRequest,
        StartSSHTailRequest,
        IngestLogEntry,
        IngestLogsRequest,
        UpdateCommentRequest,
        GetWorkspaceSourcesRequest,
        ReadFileRequest,
        FusionSourceConfig,
        UpdateTemporalOffsetsRequest,
        GetTemporalOffsetsRequest,
        UpdateFusionConfigRequest,
        GetFusionConfigRequest,
        GetSampleLinesRequest,
        UpdateSourceParserRequest,
        GetFusedLogsRequest,
        GetAnomaliesRequest,
        GetLogDistributionRequest,
        GetMetadataFacetsRequest,
        SendAiMessageRequest,
        GetAiSessionsRequest,
        GetAiMessagesRequest,
        SaveMemoryRequest,
        SearchMemoryRequest,
        GetSettingsRequest,
        UpdateSettingsRequest,
    ]

    # Generate a combined schema using Pydantic's utility
    # This handles internal references correctly
    _, schema = models_json_schema(
        [(m, "validation") for m in models], ref_template="#/definitions/{model}"
    )

    # Rename $defs to definitions for json2ts compatibility if needed
    if "$defs" in schema:
        schema["definitions"] = schema.pop("$defs")

    # Force json2ts to generate all definitions by referencing them in anyOf
    schema["anyOf"] = [{"$ref": f"#/definitions/{m.__name__}"} for m in models]

    # Add title for json2ts
    schema["title"] = "LogLensAi API Schema"

    with open("api_schema.json", "w") as f:
        json.dump(schema, f, indent=2)
    print("Schema generated to api_schema.json")


if __name__ == "__main__":
    generate_schema()
