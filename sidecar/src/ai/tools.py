import json
import logging
from typing import Any, Literal

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


class CreateColumnParams(BaseModel):
    label: str = Field(..., description="The display label for the column")
    source: Literal["auto", "user"] = Field(
        ...,
        description="Either 'auto' (for backend-extracted facets) or 'user' (for frontend regex matching)",
    )
    regex: str | None = Field(
        None, description="Regex pattern with a capture group if source is 'user'"
    )
    width: str = Field("120px", description="Initial column width CSS value (e.g. '120px')")


class CreateFacetParams(BaseModel):
    workspace_id: str = Field(..., description="The workspace ID to apply the facet/mask to")
    pattern: str = Field(..., description="The regex pattern to extract this facet")
    label: str = Field(
        ..., description="The label for the extracted parameter (e.g. USER, IP, STATUS)"
    )
    enabled: bool = Field(True, description="Whether this masking rule is active")


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
            {
                "type": "function",
                "function": {
                    "name": "create_column",
                    "description": "Instruct the UI to create a custom column for display. Can be 'user' (regex matching on message field) or 'auto' (linked to a backend facet).",
                    "parameters": CreateColumnParams.model_json_schema(),
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "create_facet",
                    "description": "Create a backend log parsing facet/mask (regex extraction rule) to extract custom fields (IP, username, etc.) from log messages.",
                    "parameters": CreateFacetParams.model_json_schema(),
                },
            },
        ]

    async def search_logs(self, _ctx: RunContext[Any], params: SearchLogsParams) -> dict:
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

    async def get_clusters(self, _ctx: RunContext[Any], params: GetClustersParams) -> list[dict]:
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

    async def search_memory(self, _ctx: RunContext[Any], params: SearchMemoryParams) -> list[dict]:
        """Search the collective memory for similar issues and resolutions."""
        logger.info(
            "Tool: search_memory called for %s with query: %s", params.workspace_id, params.query
        )
        try:
            return self.app.method_search_memory(params.workspace_id, params.query)
        except Exception as e:
            logger.exception("Error in search_memory tool:")
            return [{"error": str(e)}]

    async def get_facets(self, _ctx: RunContext[Any], params: GetFacetsParams) -> dict:
        """Get top unique metadata facets (IPs, users, etc.) for a workspace."""
        logger.info("Tool: get_facets called for %s", params.workspace_id)
        try:
            return self.app.method_get_metadata_facets(workspace_id=params.workspace_id)
        except Exception as e:
            logger.exception("Error in get_facets tool:")
            return {"error": str(e)}

    async def get_hierarchy(self, _ctx: RunContext[Any], params: GetHierarchyParams) -> dict:
        """Get the folder and source hierarchy for a workspace."""
        logger.info("Tool: get_hierarchy called for %s", params.workspace_id)
        try:
            return self.app.method_get_hierarchy(workspace_id=params.workspace_id)
        except Exception as e:
            logger.exception("Error in get_hierarchy tool:")
            return {"error": str(e)}

    async def create_column(self, _ctx: RunContext[Any], params: CreateColumnParams) -> dict:
        """Instruct the UI to create a custom column."""
        logger.info("Tool: create_column called with %s", params)
        return {
            "status": "success",
            "message": "Column request registered. You MUST output the matching A2UI block in your final answer text.",
            "a2ui_block": f'[[A2UI]]{{"type": "add_column", "label": "{params.label}", "source": "{params.source}", "regex": "{params.regex}" if params.regex else None, "width": "{params.width}"}}[[/A2UI]]',
        }

    async def create_facet(self, _ctx: RunContext[Any], params: CreateFacetParams) -> dict:
        """Create a backend log parsing facet/mask."""
        logger.info("Tool: create_facet called with %s", params)
        try:
            current_settings = self.app.method_get_settings(params.workspace_id)
            masks_raw = current_settings.get("drain_masks", "[]")

            try:
                masks = json.loads(masks_raw)
                if isinstance(masks, str):
                    masks = json.loads(masks)
                if not isinstance(masks, list):
                    masks = []
            except Exception:
                masks = []

            exists = False
            for m in masks:
                if m.get("label") == params.label and m.get("pattern") == params.pattern:
                    m["enabled"] = params.enabled
                    exists = True
                    break

            if not exists:
                masks.append(
                    {"pattern": params.pattern, "label": params.label, "enabled": params.enabled}
                )

            self.app.method_update_settings(
                {"drain_masks": json.dumps(masks)}, workspace_id=params.workspace_id
            )

            return {
                "status": "success",
                "message": f"Successfully created/updated facet '{params.label}' with pattern '{params.pattern}'.",
                "facet_key": params.label.lower(),
            }
        except Exception as e:
            logger.exception("Error in create_facet tool:")
            return {"status": "error", "error": str(e)}
