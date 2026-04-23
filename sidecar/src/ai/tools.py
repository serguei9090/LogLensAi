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


class ToolRegistry:
    """Registry for LogLens AI tools using PydanticAI."""

    def __init__(self, app_instance: Any):
        self.app = app_instance

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
            logger.error("Error in search_logs tool: %s", e)
            return {"error": str(e)}

    async def get_clusters(self, ctx: RunContext[Any], workspace_id: str) -> list[dict]:
        """Get the top log clusters/patterns for a workspace."""
        logger.info("Tool: get_clusters called for %s", workspace_id)
        try:
            parser = self.app.get_drain_parser(workspace_id)
            clusters = parser.get_clusters()
            return [
                {"id": c.cluster_id, "template": c.get_template(), "size": c.size} for c in clusters
            ]
        except Exception as e:
            logger.error("Error in get_clusters tool: %s", e)
            return [{"error": str(e)}]

    async def search_memory(
        self, ctx: RunContext[Any], workspace_id: str, query: str
    ) -> list[dict]:
        """Search the collective memory for similar issues and resolutions."""
        logger.info("Tool: search_memory called for %s with query: %s", workspace_id, query)
        try:
            return self.app.method_search_memory(workspace_id, query)
        except Exception as e:
            logger.error("Error in search_memory tool: %s", e)
            return [{"error": str(e)}]

    async def get_facets(self, ctx: RunContext[Any], workspace_id: str) -> dict:
        """Get top unique metadata facets (IPs, users, etc.) for a workspace."""
        logger.info("Tool: get_facets called for %s", workspace_id)
        try:
            return self.app.method_get_metadata_facets(workspace_id=workspace_id)
        except Exception as e:
            logger.error("Error in get_facets tool: %s", e)
            return {"error": str(e)}
