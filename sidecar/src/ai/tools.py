import logging
from typing import Any

from pydantic import BaseModel, Field
from pydantic_ai import RunContext

logger = logging.getLogger(__name__)


class SearchLogsParams(BaseModel):
    workspace_id: str = Field(..., description="The workspace ID to search in")
    query: str | None = Field(None, description="LLQL search query")
    filters: list[dict] | None = Field(None, description="List of filters to apply")
    limit: int = Field(100, description="Max logs to return")
    offset: int = Field(0, description="Offset for pagination")


class GetClustersParams(BaseModel):
    workspace_id: str = Field(..., description="The workspace ID to get clusters for")


class SearchMemoryParams(BaseModel):
    workspace_id: str = Field(..., description="The workspace ID")
    query: str = Field(..., description="Search query string")


class GetFacetsParams(BaseModel):
    workspace_id: str = Field(..., description="The workspace ID to get facets for")


class GetHierarchyParams(BaseModel):
    workspace_id: str = Field(..., description="The workspace ID to get hierarchy for")


class ToolRegistry:
    """Registry for LogLens AI tools using PydanticAI."""

    def __init__(self, app_instance: Any):
        self.app = app_instance

    def get_tool_schemas(self) -> list[dict]:
        """Generate OpenAI-compatible tool schemas from registered Pydantic models."""
        return [
            {
                "type": "function",
                "function": {
                    "name": "search_logs",
                    "description": "Search and filter logs in the workspace using LLQL.",
                    "parameters": SearchLogsParams.model_json_schema(),
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "get_clusters",
                    "description": "Get the top log clusters/patterns for a workspace.",
                    "parameters": GetClustersParams.model_json_schema(),
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "search_memory",
                    "description": "Search the collective memory for similar issues and resolutions.",
                    "parameters": SearchMemoryParams.model_json_schema(),
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "get_facets",
                    "description": "Get top unique metadata facets (IPs, users, etc.) for a workspace.",
                    "parameters": GetFacetsParams.model_json_schema(),
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "get_hierarchy",
                    "description": "Get the folder and source hierarchy for a workspace.",
                    "parameters": GetHierarchyParams.model_json_schema(),
                },
            },
        ]

    async def search_logs(self, ctx: RunContext[Any], params: SearchLogsParams) -> dict:
        """Search and filter logs in the workspace."""
        logger.info("Tool: search_logs called with %s", params)
        try:
            # We use the internal method from the app instance
            result = self.app._get_logs_internal(
                workspace_id=params.workspace_id,
                query=params.query,
                filters=params.filters,
                limit=params.limit,
                offset=params.offset,
            )
            return result
        except Exception as e:
            logger.exception("Error in search_logs tool:")
            return {"error": str(e)}

    async def get_clusters(self, ctx: RunContext[Any], params: GetClustersParams) -> list[dict]:
        """Get the top log clusters/patterns for a workspace."""
        logger.info("Tool: get_clusters called for %s", params.workspace_id)
        try:
            parser = self.app.get_drain_parser(params.workspace_id)
            clusters = parser.get_clusters()
            return [
                {"id": c.cluster_id, "template": c.get_template(), "size": c.size} for c in clusters
            ]
        except Exception as e:
            logger.exception("Error in get_clusters tool:")
            return [{"error": str(e)}]

    async def search_memory(self, ctx: RunContext[Any], params: SearchMemoryParams) -> list[dict]:
        """Search the collective memory for similar issues and resolutions."""
        logger.info(
            "Tool: search_memory called for %s with query: %s", params.workspace_id, params.query
        )
        try:
            return self.app.method_search_memory(params.workspace_id, params.query)
        except Exception as e:
            logger.exception("Error in search_memory tool:")
            return [{"error": str(e)}]

    async def get_facets(self, ctx: RunContext[Any], params: GetFacetsParams) -> dict:
        """Get top unique metadata facets (IPs, users, etc.) for a workspace."""
        logger.info("Tool: get_facets called for %s", params.workspace_id)
        try:
            return self.app.method_get_metadata_facets(workspace_id=params.workspace_id)
        except Exception as e:
            logger.exception("Error in get_facets tool:")
            return {"error": str(e)}

    async def get_hierarchy(self, ctx: RunContext[Any], params: GetHierarchyParams) -> dict:
        """Get the folder and source hierarchy for a workspace."""
        logger.info("Tool: get_hierarchy called for %s", params.workspace_id)
        try:
            return self.app.method_get_hierarchy(workspace_id=params.workspace_id)
        except Exception as e:
            logger.exception("Error in get_hierarchy tool:")
            return {"error": str(e)}
