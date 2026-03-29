from typing import Any

from mcp.server.fastmcp import FastMCP

# Create an MCP server instance
mcp_server = FastMCP("loglens_mcp")

# Store the global app instance reference for tool access
_app_instance: Any = None

def get_app() -> Any:
    return _app_instance

def init_mcp(app_instance: Any):
    global _app_instance
    _app_instance = app_instance
    return mcp_server

@mcp_server.tool()
def ls_sources(workspace_id: str) -> list[str]:
    """List all available log sources for a given workspace."""
    app = get_app()
    if not app:
        return []
    return app.method_get_workspace_sources(workspace_id)

@mcp_server.tool()
def query_logs(workspace_id: str, query: str = "", limit: int = 100) -> dict:
    """Query logs with text matching in the workspace."""
    app = get_app()
    if not app:
        return {}
    res = app.method_get_logs(workspace_id=workspace_id, query=query, limit=limit)
    return {
        "total": res.get("total", 0),
        "logs": [
            {
                "timestamp": log.get("timestamp"),
                "level": log.get("level"),
                "message": log.get("message"),
                "source": log.get("source_id"),
                "cluster_template": log.get("cluster_template")
            }
            for log in res.get("logs", [])
        ]
    }

@mcp_server.tool()
def get_pattern_summary(workspace_id: str) -> list[dict]:
    """Get a summary of the most frequent Drain3 cluster patterns in the workspace."""
    app = get_app()
    if not app:
        return []
    cursor = app.db.get_cursor()
    cursor.execute(
        "SELECT cluster_id, template, count FROM clusters WHERE workspace_id = ? ORDER BY count DESC LIMIT 50", 
        (workspace_id,)
    )
    return [
        {"cluster_id": row[0], "template": row[1], "count": row[2]}
        for row in cursor.fetchall()
    ]

@mcp_server.tool()
def analyze_cluster(workspace_id: str, cluster_id: str) -> dict:
    """Analyze a specific log cluster using AI to determine summary, root cause, and recommendations."""
    app = get_app()
    if not app:
        return {}
    return app.method_analyze_cluster(cluster_id=cluster_id, workspace_id=workspace_id)

@mcp_server.tool()
def get_anomalies(workspace_id: str) -> dict:
    """Retrieve statistical outliers and rare log patterns from the workspace."""
    app = get_app()
    if not app:
        return {}
    return app.method_get_anomalies(workspace_id=workspace_id)
