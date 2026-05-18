import json

from pydantic import BaseModel, Field


class SearchLogsParams(BaseModel):
    workspace_id: str = Field(..., description="The workspace ID to search in")
    query: str | None = Field(None, description="LLQL search query")
    filters: list[dict] | None = Field(None, description="List of filters to apply")
    limit: int = Field(100, description="Max logs to return")
    offset: int = Field(0, description="Offset for pagination")


class WorkspaceIdParams(BaseModel):
    workspace_id: str = Field(..., description="The workspace ID")


class SearchMemoryParams(BaseModel):
    workspace_id: str = Field(..., description="The workspace ID")
    query: str = Field(..., description="Search query string")


print(json.dumps(SearchLogsParams.model_json_schema(), indent=2))
