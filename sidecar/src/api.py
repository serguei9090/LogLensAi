import json
import logging
import os
import sys
import threading
import time
from datetime import datetime
from typing import Any

import aiohttp_cors
from aiohttp import web
from dotenv import load_dotenv
from pydantic import BaseModel, ValidationError
from src.ai import AIChatMessage, AIProviderFactory
from src.db import Database
from src.mcp_server import init_mcp, mcp_server
from src.metadata_extractor import extract_log_metadata
from src.parser import DrainParser
from src.ssh_loader import SSHLoader
from src.tailer import FileTailer

# --- Professional Logging Setup ---
SIDE_CAR_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(SIDE_CAR_DIR)
LOG_FILE = os.path.join(SIDE_CAR_DIR, "sidecar.log")

# Load environment variables from project root
load_dotenv(os.path.join(PROJECT_ROOT, ".env"))

# Determine log level
LL_DEBUG = os.getenv("LOGLENS_DEBUG", "false").lower() == "true"
LOG_LEVEL = logging.DEBUG if LL_DEBUG else logging.INFO

# Create a custom logger and force it to be the root or attached to root
root_logger = logging.getLogger()
root_logger.setLevel(LOG_LEVEL)

# Clear existing handlers to avoid duplicates/conflicts
for handler in root_logger.handlers[:]:
    root_logger.removeHandler(handler)

# Create file handler with NO buffering (flush immediately)
fh = logging.FileHandler(LOG_FILE, encoding="utf-8")
fh.setLevel(LOG_LEVEL)
formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
fh.setFormatter(formatter)
root_logger.addHandler(fh)

# Also add stderr for Tauri console visibility
sh = logging.StreamHandler(sys.stderr)
sh.setFormatter(formatter)
root_logger.addHandler(sh)

logger = logging.getLogger("LogLensSidecar")
logger.info("--- Sidecar Tracing Session Started --- (Level: %s)", logging.getLevelName(LOG_LEVEL))
logger.info("Log path: %s", LOG_FILE)


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


class StartSSHTailRequest(BaseModel):
    host: str
    port: int = 22
    username: str
    password: str | None = None
    filepath: str
    workspace_id: str


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


class GetLogDistributionRequest(BaseModel):
    workspace_id: str
    fusion_id: str | None = None
    source_ids: list[str] | None = None
    filters: list[LogFilter] | None = None
    query: str | None = None
    start_time: str | None = None
    end_time: str | None = None


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


class App:
    def __init__(self, db_path="loglens.duckdb"):
        self.db = Database(db_path)
        self.parser = DrainParser()
        self.tailers = {}
        self._start_time = time.time()
        self.dev_mode = False

        # Initialize AI Provider from settings
        settings = self.method_get_settings()
        provider = settings.get("ai_provider", "ollama")
        host = (
            settings.get("ai_gemini_url", "http://localhost:22436")
            if provider == "gemini-cli"
            else settings.get("ai_ollama_host", "http://localhost:11434")
        )

        self.ai = AIProviderFactory.get_provider(
            provider,
            api_key=settings.get("ai_api_key", ""),
            system_prompt=settings.get("ai_system_prompt", ""),
            model=settings.get("ai_model", "gemma4:e2b"),
            host=host,
        )

        init_mcp(self)
        self._mcp_thread = None
        self._mcp_server_instance = None

        # Auto-start if enabled in settings
        if settings.get("mcp_server_enabled", "false").lower() == "true":
            self._start_mcp_server()

    def _start_mcp_server(self):
        """Starts the MCP server in a background thread using FastMCP SSE."""
        if self._mcp_thread and self._mcp_thread.is_alive():
            return

        def run_mcp():
            try:
                import uvicorn

                config = uvicorn.Config(
                    mcp_server.application, host="127.0.0.1", port=5001, log_level="error"
                )
                self._mcp_server_instance = uvicorn.Server(config)
                self._mcp_server_instance.run()
            except Exception as e:
                sys.stderr.write(f"MCP Server error: {e}\n")

        # We start the SSE MCP Server in a daemon thread so it dies with the main process.
        self._mcp_thread = threading.Thread(target=run_mcp, daemon=True)
        self._mcp_thread.start()

    def _stop_mcp_server(self):
        """Signals the MCP server to shut down."""
        if self._mcp_server_instance:
            self._mcp_server_instance.should_exit = True
            self._mcp_server_instance = None
            if self._mcp_thread:
                self._mcp_thread.join(timeout=2)
                self._mcp_thread = None

    async def dispatch(self, req: JSONRPCRequest) -> JSONRPCResponse:
        try:
            method_name = f"method_{req.method}"
            if not hasattr(self, method_name):
                return JSONRPCResponse(
                    id=req.id, error={"code": -32601, "message": f"Method not found: {req.method}"}
                )

            # Map method names to their validation models
            models: dict[str, Any] = {
                "get_logs": GetLogsRequest,
                "get_fused_logs": GetFusedLogsRequest,
                "update_fusion_config": UpdateFusionConfigRequest,
                "get_fusion_config": GetFusionConfigRequest,
                "start_tail": StartTailRequest,
                "start_ssh_tail": StartSSHTailRequest,
                "stop_tail": StartTailRequest,
                "ingest_logs": IngestLogsRequest,
                "read_file": ReadFileRequest,
                "update_log_comment": UpdateCommentRequest,
                "get_workspace_sources": GetWorkspaceSourcesRequest,
                "get_sample_lines": GetSampleLinesRequest,
                "update_source_parser": UpdateSourceParserRequest,
                "get_anomalies": GetAnomaliesRequest,
                "analyze_cluster": None,
                "get_settings": None,
                "update_settings": None,
                "list_ai_models": None,
                "send_ai_message": SendAiMessageRequest,
                "get_ai_sessions": GetAiSessionsRequest,
                "get_ai_messages": GetAiMessagesRequest,
                "rename_ai_session": None,
                "delete_ai_session": None,
                "get_ai_mapping": None,
                "save_memory": SaveMemoryRequest,
                "search_memory": SearchMemoryRequest,
            }

            handler = getattr(self, method_name)

            # Perform Pydantic validation if a model is defined
            model = models.get(req.method)
            import inspect

            if model:
                try:
                    params_model = model(**req.params)
                    # Unroll the model into keyword arguments for the handler
                    res = handler(**params_model.model_dump())
                    if inspect.iscoroutine(res):
                        result = await res
                    else:
                        result = res
                except ValidationError as ve:
                    return JSONRPCResponse(
                        id=req.id,
                        error={"code": -32602, "message": "Invalid params", "data": ve.errors()},
                    )
            else:
                # Direct call for unmapped methods
                res = handler(**req.params)
                if inspect.iscoroutine(res):
                    result = await res
                else:
                    result = res

            return JSONRPCResponse(id=req.id, result=result)
        except Exception as e:
            import traceback

            traceback.print_exc()
            return JSONRPCResponse(
                id=req.id, error={"code": -32603, "message": "Internal error", "data": str(e)}
            )

    def _parse_filters(self, filters: list[dict]) -> tuple[list[str], list[Any]]:
        where_clauses = []
        params = []
        allowed_fields = ["level", "source_id", "cluster_id", "raw_text", "has_comment"]

        for f in filters:
            field = f.get("field")
            value = f.get("value")
            op = f.get("operator", "equals")

            if field not in allowed_fields or value is None:
                continue

            if op == "contains":
                where_clauses.append(f"{field} ILIKE ?")
                params.append(f"%{value}%")
            elif op == "not_contains":
                where_clauses.append(f"{field} NOT ILIKE ?")
                params.append(f"%{value}%")
            elif op == "equals":
                if field == "source_id":
                    where_clauses.append(f"{field} ILIKE ?")
                else:
                    where_clauses.append(f"{field} = ?")
                params.append(value)
            elif op == "not_equals":
                where_clauses.append(f"{field} != ?")
                params.append(value)
            elif op == "starts_with":
                where_clauses.append(f"{field} ILIKE ?")
                params.append(f"{value}%")
            elif op == "regex":
                where_clauses.append(f"regexp_matches({field}, ?)")
                params.append(value)

        return where_clauses, params

    def _get_logs_internal(
        self,
        workspace_id: str,
        offset: int = 0,
        limit: int = 100,
        filters: Any | None = None,
        query: str | None = None,
        sort_by: str = "id",
        sort_order: str = "DESC",
        source_ids: list[str] | None = None,
        start_time: str | None = None,
        end_time: str | None = None,
    ) -> dict:
        """Unified internal log fetcher supporting source-filtering for Fusion mode."""
        cursor = self.db.get_cursor()

        where_clauses = ["workspace_id = ?"]
        params: list[Any] = [workspace_id]

        # If source_ids is provided (Fusion mode), restrict to those sources
        if source_ids is not None:
            if not source_ids:  # None provided = show nothing
                return {"total": 0, "logs": [], "offset": offset, "limit": limit}
            placeholders = ",".join(["?"] * len(source_ids))
            where_clauses.append(f"source_id IN ({placeholders})")
            params.extend(source_ids)

        if filters:
            dict_filters = [f.model_dump() if hasattr(f, "model_dump") else f for f in filters]
            f_clauses, f_params = self._parse_filters(dict_filters)
            where_clauses.extend(f_clauses)
            params.extend(f_params)

        if query:
            where_clauses.append("(message ILIKE ? OR raw_text ILIKE ?)")
            params.extend([f"%{query}%", f"%{query}%"])

        if start_time:
            # Normalize ISO from frontend (T separator) to DB format (space separator)
            norm_start = start_time.replace("T", " ").split(".")[0].replace("Z", "")
            where_clauses.append("timestamp >= ?")
            params.append(norm_start)
        if end_time:
            norm_end = end_time.replace("T", " ").split(".")[0].replace("Z", "")
            where_clauses.append("timestamp <= ?")
            params.append(norm_end)

        where_sql = " AND ".join(where_clauses)
        total_logs_subquery = "(SELECT count(*) FROM logs WHERE workspace_id = ?)"

        # Apply table alias 'l' for safety in complex joins
        aliased = (
            where_sql.replace("workspace_id", "l.workspace_id")
            .replace("source_id", "l.source_id")
            .replace("message", "l.message")
            .replace("level", "l.level")
            .replace("cluster_id", "l.cluster_id")
            .replace("raw_text", "l.raw_text")
            .replace("has_comment", "l.has_comment")
            .replace("timestamp", "l.timestamp")
        )

        base_query = f"""
            SELECT 
                l.*, 
                c.count as _cluster_count, 
                c.template as cluster_template,
                CAST(c.count AS FLOAT) * 100.0 / {total_logs_subquery} as cluster_percent
            FROM logs l
            LEFT JOIN clusters c ON l.workspace_id = c.workspace_id AND l.cluster_id = c.cluster_id
            WHERE {aliased}
        """

        params_for_data = [workspace_id] + params
        count_query = f"SELECT COUNT(*) FROM logs l WHERE {aliased}"
        cursor.execute(count_query, params)
        total = cursor.fetchone()[0]

        allowed_sort = [
            "id",
            "timestamp",
            "level",
            "source_id",
            "cluster_id",
            "has_comment",
            "cluster_percent",
        ]
        final_sort_by = sort_by if sort_by in allowed_sort else "id"
        if final_sort_by == "cluster_id":
            final_sort_by = "cluster_percent"

        final_sort_order = "ASC" if sort_order and sort_order.upper() == "ASC" else "DESC"
        data_query = (
            base_query
            + f" ORDER BY {final_sort_by} {final_sort_order}, l.id {final_sort_order} LIMIT ? OFFSET ?"
        )
        cursor.execute(data_query, params_for_data + [limit, offset])

        columns = [desc[0] for desc in cursor.description]
        logs = [dict(zip(columns, row, strict=False)) for row in cursor.fetchall()]

        return {"total": total, "logs": logs, "offset": offset, "limit": limit}

    def method_get_logs(self, **kwargs) -> dict:
        """Fetch logs normally for a workspace/source."""
        params = GetLogsRequest(**kwargs)
        return self._get_logs_internal(**params.model_dump())

    def method_get_log_distribution(self, **kwargs) -> dict:
        """Fetch timeline distribution of logs aggregated by time bucket and level."""
        params = GetLogDistributionRequest(**kwargs)
        cursor = self.db.get_cursor()

        where_clauses = ["workspace_id = ?"]
        sql_params: list[Any] = [params.workspace_id]

        # 1. Resolve source restrictions
        effective_source_ids = params.source_ids

        # If fusion_id is provided, override source_ids with those from the fusion config
        if params.fusion_id:
            cursor.execute(
                "SELECT source_id FROM fusion_configs WHERE workspace_id = ? AND fusion_id = ? AND enabled = TRUE",
                (params.workspace_id, params.fusion_id),
            )
            effective_source_ids = [row[0] for row in cursor.fetchall()]

        if effective_source_ids is not None:
            if not effective_source_ids:  # None provided/found = show nothing
                return {"buckets": []}
            placeholders = ",".join(["?"] * len(effective_source_ids))
            where_clauses.append(f"source_id IN ({placeholders})")
            sql_params.extend(effective_source_ids)

        if params.filters:
            dict_filters = [
                f.model_dump() if hasattr(f, "model_dump") else f for f in params.filters
            ]
            f_clauses, f_params = self._parse_filters(dict_filters)
            where_clauses.extend(f_clauses)
            sql_params.extend(f_params)

        if params.query:
            where_clauses.append("(message ILIKE ? OR raw_text ILIKE ?)")
            sql_params.extend([f"%{params.query}%", f"%{params.query}%"])

        if params.start_time:
            norm_start = params.start_time.replace("T", " ").split(".")[0].replace("Z", "")
            where_clauses.append("timestamp >= ?")
            sql_params.append(norm_start)

        if params.end_time:
            norm_end = params.end_time.replace("T", " ").split(".")[0].replace("Z", "")
            where_clauses.append("timestamp <= ?")
            sql_params.append(norm_end)

        where_sql = " AND ".join(where_clauses)

        # Aggregate by minute bucket
        # SQLite / DuckDB timestamp as string, substring(1,16) gives "YYYY-MM-DD HH:MM"
        query = f"""
            SELECT
                substring(timestamp, 1, 16) as time_bucket,
                level,
                COUNT(*) as count
            FROM logs
            WHERE {where_sql}
            GROUP BY time_bucket, level
            ORDER BY time_bucket ASC
        """
        cursor.execute(query, sql_params)
        rows = cursor.fetchall()

        # Reshape to a list of dicts: {"bucket": "2023...", "INFO": 5, "ERROR": 2}
        buckets_map = {}
        for row in rows:
            time_bucket = row[0]
            level = row[1]
            count = row[2]

            if time_bucket not in buckets_map:
                buckets_map[time_bucket] = {"bucket": time_bucket}

            buckets_map[time_bucket][level] = count

        return {"buckets": list(buckets_map.values())}

    def method_get_anomalies(self, **kwargs) -> dict:
        """Analyze statistical outliers and novel clusters over a basic time sliding window."""
        params = GetAnomaliesRequest(**kwargs)
        cursor = self.db.get_cursor()

        # Simple baseline: detect "new" clusters in the last minute that rarely appeared before
        query = """
            WITH cluster_stats AS (
                SELECT 
                    cluster_id, 
                    count(*) as total_occurrences,
                    min(timestamp) as first_seen,
                    max(timestamp) as last_seen
                FROM logs
                WHERE workspace_id = ?
                GROUP BY cluster_id
            )
            SELECT l.cluster_id, l.timestamp, cs.total_occurrences
            FROM logs l
            JOIN cluster_stats cs ON l.cluster_id = cs.cluster_id
            WHERE l.workspace_id = ? 
            AND cs.total_occurrences <= 5 
            ORDER BY l.timestamp DESC LIMIT 100
        """
        cursor.execute(query, [params.workspace_id, params.workspace_id])
        rows = cursor.fetchall()

        anomalies = []
        for row in rows:
            anomalies.append(
                {
                    "cluster_id": row[0],
                    "timestamp": row[1],
                    "type": "novelty" if row[2] <= 1 else "rare",
                    "score": 0.95,  # Mocked Z-Score baseline
                }
            )

        return {"anomalies": anomalies}

    def method_get_fused_logs(self, **kwargs) -> dict:
        """Fetch interleaved logs for Fusion mode based on enabled sources with Timezone normalization."""
        params = GetFusedLogsRequest(**kwargs)
        cursor = self.db.get_cursor()

        # 1. Get enabled sources and their offsets from fusion_config
        cursor.execute(
            "SELECT source_id, tz_offset FROM fusion_configs WHERE workspace_id = ? AND fusion_id = ? AND enabled = TRUE",
            (params.workspace_id, params.fusion_id),
        )
        rows = cursor.fetchall()
        enabled_ids = [row[0] for row in rows]
        tz_offsets = {row[0]: row[1] for row in rows}

        # 2. delegate to internal fetcher with restricted sources
        model_dump = params.model_dump()
        model_dump.pop("fusion_id", None)  # Clean for internal fetcher
        result = self._get_logs_internal(**model_dump, source_ids=enabled_ids)

        # 3. Apply Multi-Source Timezone Normalization (PARS-004)
        from datetime import timedelta

        normalized_logs = []
        for log in result["logs"]:
            source_id = log.get("source_id")
            offset = tz_offsets.get(source_id, 0)
            if offset != 0 and log.get("timestamp"):
                try:
                    # Parse timestamp, assuming common format YYYY-MM-DD HH:MM:SS
                    # We only slice first 19 chars for standard ISO format parsing
                    ts_str = log["timestamp"]
                    if "T" in ts_str:
                        ts_str = ts_str.replace("T", " ")
                    dt = datetime.strptime(ts_str[:19], "%Y-%m-%d %H:%M:%S")
                    dt = dt + timedelta(hours=offset)
                    log["timestamp"] = dt.strftime("%Y-%m-%d %H:%M:%S")
                except Exception:
                    pass  # Keep original if parsing fails
            normalized_logs.append(log)

        result["logs"] = normalized_logs
        return result

    def method_update_fusion_config(self, **kwargs) -> dict:
        """Save source orchestration settings (Enabled toggles, Timezones)."""
        params = UpdateFusionConfigRequest(**kwargs)
        cursor = self.db.get_cursor()

        for src in params.sources:
            cursor.execute(
                """
                INSERT INTO fusion_configs (workspace_id, fusion_id, source_id, enabled, tz_offset, custom_format, parser_config)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (workspace_id, fusion_id, source_id) DO UPDATE SET
                    enabled = excluded.enabled,
                    tz_offset = excluded.tz_offset,
                    custom_format = excluded.custom_format,
                    parser_config = excluded.parser_config
            """,
                (
                    params.workspace_id,
                    params.fusion_id,
                    src.source_id,
                    src.enabled,
                    src.tz_offset,
                    src.custom_format,
                    src.parser_config,
                ),
            )

        self.db.commit()
        return {"status": "ok"}

    def method_get_sample_lines(
        self, workspace_id: str, source_id: str, limit: int = 10
    ) -> list[str]:
        """Fetch raw lines from a source to help a user define a pattern."""
        cursor = self.db.get_cursor()
        cursor.execute(
            "SELECT raw_text FROM logs WHERE workspace_id = ? AND source_id = ? LIMIT ?",
            (workspace_id, source_id, limit),
        )
        return [row[0] for row in cursor.fetchall()]

    def method_update_source_parser(
        self, workspace_id: str, source_id: str, parser_config: str
    ) -> dict:
        """Update the regex/pattern configuration for a specific log source."""
        cursor = self.db.get_cursor()
        cursor.execute(
            "UPDATE fusion_configs SET parser_config = ? WHERE workspace_id = ? AND source_id = ?",
            (parser_config, workspace_id, source_id),
        )
        self.db.commit()
        return {"status": "ok"}

    def method_get_fusion_config(self, **kwargs) -> dict:
        """Retrieve current Fusion orchestration setup."""
        params = GetFusionConfigRequest(**kwargs)
        cursor = self.db.get_cursor()
        cursor.execute(
            "SELECT source_id, enabled, tz_offset, custom_format, parser_config FROM fusion_configs WHERE workspace_id = ? AND fusion_id = ?",
            (params.workspace_id, params.fusion_id),
        )
        rows = cursor.fetchall()

        sources = [
            {
                "source_id": row[0],
                "enabled": bool(row[1]),
                "tz_offset": row[2],
                "custom_format": row[3],
                "parser_config": row[4],
            }
            for row in rows
        ]

        return {"sources": sources}

    def method_start_tail(self, filepath: str, workspace_id: str) -> dict:
        # Normalize to forward slashes for consistent source_id matching
        abs_path = os.path.abspath(filepath).replace("\\", "/")
        key = f"{workspace_id}:{abs_path}"

        if key in self.tailers and self.tailers[key].running:
            return {"status": "already tailing"}

        tailer = FileTailer(abs_path, workspace_id, self.parser)
        self.tailers[key] = tailer
        tailer.start()

        return {"status": "started"}

    def method_start_ssh_tail(
        self,
        host: str,
        port: int = 22,
        username: str | None = None,
        password: str | None = None,
        filepath: str | None = None,
        workspace_id: str | None = None,
    ) -> dict:

        key = f"ssh:{workspace_id}:{host}:{filepath}"
        if key in self.tailers and self.tailers[key].running:
            return {"status": "already tailing"}

        tailer = SSHLoader(host, port, username, password, filepath, workspace_id, self.parser)
        self.tailers[key] = tailer
        tailer.start()

        return {"status": "started"}

    def _stop_all_workspace_tailers(self, workspace_id: str) -> int:
        """Internal helper to stop all tailers for a workspace."""
        count = 0
        keys_to_remove = []
        for k, t in self.tailers.items():
            if k.startswith(f"{workspace_id}:") or k.startswith(f"ssh:{workspace_id}:"):
                t.stop()
                keys_to_remove.append(k)
                count += 1
        for k in keys_to_remove:
            self.tailers.pop(k, None)
        return count

    def method_stop_tail(self, filepath: str, workspace_id: str) -> dict:
        """Stop one or all live stream tailers for a workspace."""
        if filepath == "ALL":
            count = self._stop_all_workspace_tailers(workspace_id)
            return {"status": "stopped", "count": count}
        abs_path = os.path.abspath(filepath).replace("\\", "/")
        key = f"{workspace_id}:{abs_path}"

        if key in self.tailers:
            self.tailers[key].stop()
            self.tailers.pop(key, None)
            return {"status": "stopped", "count": 1}

        # Fallback for SSH or partial matches
        count_stopped = 0
        keys_to_remove = []
        for k, t in self.tailers.items():
            is_match = (
                k.startswith(f"{workspace_id}:") or k.startswith(f"ssh:{workspace_id}:")
            ) and filepath in k
            if is_match:
                t.stop()
                keys_to_remove.append(k)
                count_stopped += 1
        for k in keys_to_remove:
            self.tailers.pop(k, None)

        return {"status": "stopped" if count_stopped > 0 else "not found", "count": count_stopped}

    def method_read_file(self, filepath: str) -> str:
        """Reads the full content of a local file."""
        # Normalize path for consistent cross-platform behavior
        abs_path = os.path.abspath(filepath).replace("\\", "/")
        if not os.path.exists(abs_path):
            raise FileNotFoundError(f"File not found: {abs_path}")

        with open(abs_path, encoding="utf-8", errors="replace") as f:
            return f.read()

    def _ingest_single_log(self, cursor: Any, log: dict) -> list[Any]:
        """Extracts clustering logic into a reusable helper"""
        workspace_id = log.get("workspace_id")
        source_id = log.get("source_id", "manual")
        raw_text = log.get("raw_text", "")

        # 1. Advanced Metadata Extraction (Shared Logic)
        metadata = extract_log_metadata(workspace_id, source_id, raw_text)

        # Override metadata with provided values if they explicitly exist (important for manual ingest)
        timestamp = log.get("timestamp") or metadata["timestamp"]
        level = log.get("level") or metadata["level"]
        message = log.get("message") or raw_text

        # 2. Pattern Clustering (Drain3)
        try:
            res = self.parser.parse(message)
            cluster_id = str(res["cluster_id"])
            template = res["template"]
        except Exception:
            cluster_id = "unknown"
            template = "unknown"

        # 3. Persistence (Sync Stats table)
        cursor.execute(
            """
            INSERT INTO clusters (workspace_id, cluster_id, template, count) 
            VALUES (?, ?, ?, 1)
            ON CONFLICT (workspace_id, cluster_id) 
            DO UPDATE SET count = count + 1, template = excluded.template
        """,
            (workspace_id, cluster_id, template),
        )

        return [workspace_id, source_id, raw_text, timestamp, level, message, cluster_id]

    def method_ingest_logs(self, logs: list[IngestLogEntry]) -> dict:
        """High-speed batch ingestion of log entries with pattern clustering"""
        cursor = self.db.get_cursor()
        batch_data = []

        # Map logs to dict if they are models
        log_dicts = [log.model_dump() if hasattr(log, "model_dump") else log for log in logs]

        for log in log_dicts:
            batch_data.append(self._ingest_single_log(cursor, log))

        if batch_data:
            cursor.executemany(
                "INSERT INTO logs (workspace_id, source_id, raw_text, timestamp, level, message, cluster_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
                batch_data,
            )
            self.db.commit()

        return {"status": "ok", "count": len(batch_data)}

    def method_update_log_comment(self, log_id: int, comment: str) -> dict:
        """Update annotation for a specific log entry. If empty, the note is removed."""
        cursor = self.db.get_cursor()
        # Automatically toggle has_comment flag based on whether text is provided
        query = """
            UPDATE logs 
            SET comment = ?, 
                has_comment = CASE WHEN length(?) > 0 THEN TRUE ELSE FALSE END 
            WHERE id = ?
        """
        cursor.execute(query, (comment, comment, log_id))
        self.db.commit()
        return {"status": "success"}

    def method_get_workspace_sources(self, workspace_id: str) -> list:
        """Return the distinct source_id values present in a workspace's log table.

        Args:
            workspace_id: The ID of the workspace.

        Returns:
            Sorted list of unique source paths ingested into this workspace.
        """
        cursor = self.db.get_cursor()
        cursor.execute(
            "SELECT DISTINCT source_id FROM logs WHERE workspace_id = ? AND source_id IS NOT NULL ORDER BY source_id",
            (workspace_id,),
        )
        return [row[0] for row in cursor.fetchall()]

    def method_is_tailing(self, filepath: str, workspace_id: str) -> bool:
        abs_path = os.path.abspath(filepath).replace("\\", "/")
        key = f"{workspace_id}:{abs_path}"
        return key in self.tailers and self.tailers[key].running

    def method_get_clusters(self, _workspace_id: str) -> list:
        clusters = self.parser.get_clusters()
        return [
            {"id": c.cluster_id, "template": c.get_template(), "size": c.size} for c in clusters
        ]

    def method_analyze_cluster(self, cluster_id: str, workspace_id: str) -> dict:
        cursor = self.db.get_cursor()

        cursor.execute(
            "SELECT raw_text FROM logs WHERE workspace_id = ? AND cluster_id = ? LIMIT 20",
            (workspace_id, cluster_id),
        )
        samples = [row[0] for row in cursor.fetchall()]

        clusters = self.parser.get_clusters()
        template = ""
        for c in clusters:
            if str(c.cluster_id) == str(cluster_id):
                template = c.get_template()
                break

        return self.ai.analyze_logs(template, samples)

    async def method_list_ai_models(self) -> list[str]:
        """Fetch models available for the current AI provider."""
        return await self.ai.list_models()

    def _prepare_ai_session(
        self, params: SendAiMessageRequest
    ) -> tuple[str, str | None, list[AIChatMessage]]:
        cursor = self.db.get_cursor()
        import uuid

        session_id = params.session_id
        if not session_id:
            session_id = str(uuid.uuid4())
            name = (
                params.session_name or f"Investigation {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            )
            cursor.execute(
                "INSERT INTO ai_sessions (session_id, workspace_id, name) VALUES (?, ?, ?)",
                (session_id, params.workspace_id, name),
            )

        provider_session_id = params.provider_session_id
        if not provider_session_id:
            cursor.execute(
                "SELECT provider_session_id FROM ai_sessions WHERE session_id = ?", (session_id,)
            )
            row = cursor.fetchone()
            provider_session_id = row[0] if row else None

        log_context = ""
        if params.context_logs:
            placeholders = ",".join(["?"] * len(params.context_logs))
            cursor.execute(
                f"SELECT raw_text FROM logs WHERE id IN ({placeholders})", params.context_logs
            )
            logs = cursor.fetchall()
            if logs:
                log_context = "\n\nContextual Log Lines:\n" + "\n".join([log[0] for log in logs])

        cursor.execute(
            "INSERT INTO ai_messages (session_id, role, content, context_logs, provider_session_id) VALUES (?, ?, ?, ?, ?)",
            (
                session_id,
                "user",
                params.message,
                json.dumps(params.context_logs or []),
                provider_session_id,
            ),
        )

        cursor.execute(
            "SELECT role, content, provider_session_id FROM ai_messages WHERE session_id = ? ORDER BY timestamp ASC",
            (session_id,),
        )
        history = [
            AIChatMessage(role=r[0], content=r[1], provider_session_id=r[2])
            for r in cursor.fetchall()
        ]

        if log_context and history:
            history[-1].content += log_context

        self.db.commit()
        return session_id, provider_session_id, history

    def _finalize_ai_session(
        self, session_id: str, response_content: str, provider_session_id: str | None
    ):

        cursor = self.db.get_cursor()

        cursor.execute(
            "INSERT INTO ai_messages (session_id, role, content, provider_session_id) VALUES (?, ?, ?, ?)",
            (session_id, "assistant", response_content, provider_session_id),
        )

        updates = {"last_modified": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
        if provider_session_id:
            updates["provider_session_id"] = provider_session_id

        update_clause = ", ".join([f"{k} = ?" for k in updates])
        cursor.execute(
            f"UPDATE ai_sessions SET {update_clause} WHERE session_id = ?",
            list(updates.values()) + [session_id],
        )

        self.db.commit()
        self._sync_ai_sessions_to_json()

    async def method_send_ai_message(self, **kwargs) -> dict:
        """Handle multi-turn AI chat investigation session with log context."""
        params = SendAiMessageRequest(**kwargs)
        session_id, provider_session_id, history = self._prepare_ai_session(params)

        # 4. Call AI with provider-specific context
        response_msg = await self.ai.chat(
            history,
            model=params.model,
            session_id=session_id,
            provider_session_id=provider_session_id,
        )

        # 5. Record Assistant Message
        self._finalize_ai_session(
            session_id, response_msg.content, response_msg.provider_session_id
        )

        return {"session_id": session_id, "response": response_msg.content}

    def method_get_ai_sessions(self, workspace_id: str) -> list:
        """Fetch all investigation sessions for a workspace."""
        cursor = self.db.get_cursor()
        cursor.execute(
            "SELECT session_id, name, created_at, last_modified FROM ai_sessions WHERE workspace_id = ? ORDER BY last_modified DESC",
            (workspace_id,),
        )
        return [
            {
                "session_id": row[0],
                "name": row[1],
                "created_at": str(row[2]) if row[2] else None,
                "last_modified": str(row[3]) if row[3] else None,
            }
            for row in cursor.fetchall()
        ]

    def method_get_ai_messages(self, session_id: str) -> list:
        """Fetch all messages for a specific session."""
        cursor = self.db.get_cursor()
        cursor.execute(
            "SELECT id, role, content, context_logs, timestamp FROM ai_messages WHERE session_id = ? ORDER BY timestamp ASC",
            (session_id,),
        )
        return [
            {
                "id": row[0],
                "role": row[1],
                "content": row[2],
                "context_logs": json.loads(row[3]) if row[3] else [],
                "timestamp": str(row[4]) if row[4] else None,
            }
            for row in cursor.fetchall()
        ]

    def method_rename_ai_session(self, session_id: str, name: str) -> dict:
        """Update an investigation session name."""

        cursor = self.db.get_cursor()
        cursor.execute(
            "UPDATE ai_sessions SET name = ?, last_modified = ? WHERE session_id = ?",
            (name, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), session_id),
        )
        self.db.commit()
        self._sync_ai_sessions_to_json()
        return {"status": "ok"}

    def method_delete_ai_session(self, session_id: str) -> dict:
        """Wipe an investigation session and its messages."""
        cursor = self.db.get_cursor()
        cursor.execute("DELETE FROM ai_messages WHERE session_id = ?", (session_id,))
        cursor.execute("DELETE FROM ai_sessions WHERE session_id = ?", (session_id,))
        self.db.commit()
        self._sync_ai_sessions_to_json()
        return {"status": "ok"}

    def method_get_ai_mapping(self, workspace_id: str) -> dict:
        """Return a mapping of { log_id: session_id } for all session-linked logs."""
        cursor = self.db.get_cursor()
        cursor.execute(
            """
            SELECT m.context_logs, s.session_id 
            FROM ai_messages m
            JOIN ai_sessions s ON m.session_id = s.session_id
            WHERE s.workspace_id = ? AND m.context_logs IS NOT NULL
        """,
            (workspace_id,),
        )
        rows = cursor.fetchall()

        mapping = {}
        for row in rows:
            try:
                log_ids = json.loads(row[0])
                for lid in log_ids:
                    mapping[lid] = row[1]
            except Exception:
                continue
        return mapping

    def method_save_memory(self, workspace_id: str, issue_signature: str, resolution: str) -> dict:
        """Save a learned resolution to the workspace memory."""
        cursor = self.db.get_cursor()
        cursor.execute(
            """INSERT INTO ai_memory (workspace_id, issue_signature, resolution) 
               VALUES (?, ?, ?)
               ON CONFLICT (workspace_id, issue_signature) DO UPDATE SET
               resolution = excluded.resolution, created_at = CURRENT_TIMESTAMP
            """,
            (workspace_id, issue_signature, resolution),
        )
        self.db.commit()
        return {"status": "ok"}

    def method_search_memory(self, workspace_id: str, query: str, limit: int = 5) -> list:
        """Search the workspace memory for an issue signature or resolution."""
        cursor = self.db.get_cursor()
        # Simple ILIKE search
        cursor.execute(
            """SELECT issue_signature, resolution, created_at 
               FROM ai_memory 
               WHERE workspace_id = ? AND (issue_signature ILIKE ? OR resolution ILIKE ?)
               ORDER BY created_at DESC LIMIT ?
            """,
            (workspace_id, f"%{query}%", f"%{query}%", limit),
        )
        return [
            {"issue_signature": row[0], "resolution": row[1], "created_at": str(row[2])}
            for row in cursor.fetchall()
        ]

    def _sync_ai_sessions_to_json(self):
        """Helper to keep session_names.json in sync with DB for Gemini CLI parity."""
        try:
            cursor = self.db.get_cursor()
            cursor.execute("SELECT session_id, name FROM ai_sessions")
            sessions = {row[0]: row[1] for row in cursor.fetchall()}

            os.makedirs("gemini_sessions", exist_ok=True)
            with open("gemini_sessions/session_names.json", "w", encoding="utf-8") as f:
                json.dump(sessions, f, indent=2)
        except Exception:
            pass  # Non-critical

    def method_get_settings(self) -> dict:
        cursor = self.db.get_cursor()
        cursor.execute("SELECT key, value FROM settings")
        return {row[0]: row[1] for row in cursor.fetchall()}

    def method_update_settings(self, settings: dict) -> dict:
        cursor = self.db.get_cursor()

        if "ai_provider" in settings:
            self.ai.provider = settings["ai_provider"]
        if "ai_api_key" in settings:
            self.ai.api_key = settings["ai_api_key"]
        if "ai_system_prompt" in settings:
            self.ai.system_prompt = settings["ai_system_prompt"]

        if "mcp_server_enabled" in settings:
            enabled = str(settings["mcp_server_enabled"]).lower() == "true"
            if enabled:
                self._start_mcp_server()
            else:
                self._stop_mcp_server()

        # Update persistent settings
        query = (
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT (key) DO UPDATE SET value = excluded.value"
        )
        for k, v in settings.items():
            cursor.execute(query, (k, str(v)))

        # Re-initialize AI Provider if relevant settings changed
        if any(
            k in settings
            for k in [
                "ai_provider",
                "ai_api_key",
                "ai_ollama_host",
                "ai_gemini_url",
                "ai_model",
                "ai_system_prompt",
            ]
        ):
            current_settings = self.method_get_settings()
            provider = current_settings.get("ai_provider", "ollama")
            host = (
                current_settings.get("ai_gemini_url", "http://localhost:22436")
                if provider == "gemini-cli"
                else current_settings.get("ai_ollama_host", "http://localhost:11434")
            )

            self.ai = AIProviderFactory.get_provider(
                provider,
                api_key=current_settings.get("ai_api_key", ""),
                system_prompt=current_settings.get("ai_system_prompt", ""),
                model=current_settings.get("ai_model", "gemma4:e2b"),  # Pass the new model setting
                host=host,
            )

        self.db.commit()
        return {"status": "success"}

    async def aiohttp_handler(self, request):
        try:
            body = await request.json()
            req = JSONRPCRequest(**body)
            res = await self.dispatch(req)
            return web.json_response(res.model_dump())
        except ValidationError:
            return web.json_response(
                {
                    "jsonrpc": "2.0",
                    "id": None,
                    "error": {"code": -32600, "message": "Invalid Request"},
                },
                status=400,
            )
        except Exception as e:
            import traceback

            traceback.print_exc()
            return web.json_response(
                {
                    "jsonrpc": "2.0",
                    "id": None,
                    "error": {"code": -32603, "message": f"Internal error: {str(e)}"},
                },
                status=500,
            )

    async def aiohttp_stream_chat(self, request):
        try:
            body = await request.json()
            # If standard JSON-RPC payload contains params
            if "params" in body:
                params = SendAiMessageRequest(**body["params"])
            else:
                params = SendAiMessageRequest(**body)
        except ValidationError as e:
            return web.Response(status=400, text=f"Invalid Params: {e.errors()}")
        except Exception as e:
            return web.Response(status=400, text=f"Malformed JSON: {e}")

        response = web.StreamResponse(
            status=200,
            reason="OK",
            headers={
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        )
        await response.prepare(request)

        try:
            session_id, provider_session_id, history = self._prepare_ai_session(params)

            # Send initial session ID to UI
            await response.write(f"data: {json.dumps({'session_id': session_id})}\n\n".encode())

            full_text = []
            if hasattr(self.ai, "chat_stream"):
                async for chunk in self.ai.chat_stream(
                    messages=history,
                    model=params.model,
                    reasoning=params.reasoning,
                    session_id=session_id,
                ):
                    full_text.append(chunk)
                    # We pass 'provider_session_id' dynamically tracking in _task_cache later.
                    payload = {"chunk": chunk}
                    await response.write(f"data: {json.dumps(payload)}\n\n".encode())
            else:
                # Fallback to cold full fetch if provider does not support stream
                resp_msg = await self.ai.chat(
                    history,
                    model=params.model,
                    session_id=session_id,
                    provider_session_id=provider_session_id,
                )
                full_text.append(resp_msg.content)
                await response.write(
                    f"data: {json.dumps({'chunk': resp_msg.content})}\n\n".encode()
                )

            final_text = "".join(full_text)

            # Retrieve latest task id from _task_cache if using Gemini, else fall back
            final_provider_session_id = provider_session_id
            if hasattr(self.ai, "_task_cache") and session_id in self.ai._task_cache:
                final_provider_session_id = self.ai._task_cache.get(session_id)

            self._finalize_ai_session(session_id, final_text, final_provider_session_id)

            await response.write(b"data: [DONE]\n\n")
            return response
        except Exception as e:
            import traceback

            traceback.print_exc()
            await response.write(f"data: {json.dumps({'error': str(e)})}\n\n".encode())
            return response

    def method_get_health(self) -> dict:
        """Fetch sidecar internal health and status metrics."""
        cursor = self.db.get_cursor()

        # 1. DB Stats
        cursor.execute("SELECT COUNT(*) FROM logs")
        total_logs = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM clusters")
        total_clusters = cursor.fetchone()[0]

        # 2. Tailer Stats
        active_tailers = [k for k, t in self.tailers.items() if t.running]

        # 3. Uptime calculation
        uptime_sec = 0
        if hasattr(self, "_start_time"):
            uptime_sec = int(time.time() - self._start_time)

        return {
            "status": "ok",
            "uptime_seconds": uptime_sec,
            "database": {"logs": total_logs, "clusters": total_clusters},
            "active_tailers": len(active_tailers),
            "tailer_keys": active_tailers,
        }


def on_cleanup(_app):
    Database.reset()


def run_http(port=5000):
    app = App()
    app.dev_mode = True
    server = web.Application()

    # Configure CORS
    cors = aiohttp_cors.setup(
        server,
        defaults={
            "*": aiohttp_cors.ResourceOptions(
                allow_credentials=True,
                expose_headers="*",
                allow_headers="*",
            )
        },
    )

    resource = server.router.add_resource("/rpc")
    route = resource.add_route("POST", app.aiohttp_handler)
    cors.add(route)

    stream_resource = server.router.add_resource("/api/stream_chat")
    stream_route = stream_resource.add_route("POST", app.aiohttp_stream_chat)
    cors.add(stream_route)

    server.on_cleanup.append(on_cleanup)
    web.run_app(server, host="127.0.0.1", port=port)


async def run_stdio_async():
    app = App()
    app.dev_mode = False

    try:
        # Use aioconsole or simple async iterator for stdin
        import asyncio

        loop = asyncio.get_event_loop()

        while True:
            line = await loop.run_in_executor(None, sys.stdin.readline)
            if not line:
                break

            if not line.strip():
                continue

            try:
                req_dict = json.loads(line)
                req = JSONRPCRequest(**req_dict)
                res = await app.dispatch(req)
                print(json.dumps(res.model_dump()), flush=True)
            except json.JSONDecodeError:
                print(
                    json.dumps(
                        {
                            "jsonrpc": "2.0",
                            "id": None,
                            "error": {"code": -32700, "message": "Parse error"},
                        }
                    ),
                    flush=True,
                )
            except ValidationError:
                id_val = req_dict.get("id") if isinstance(req_dict, dict) else None
                print(
                    json.dumps(
                        {
                            "jsonrpc": "2.0",
                            "id": id_val,
                            "error": {"code": -32600, "message": "Invalid Request"},
                        }
                    ),
                    flush=True,
                )
    except KeyboardInterrupt:
        pass
    except EOFError:
        pass
    finally:
        Database.reset()


def run_stdio():
    import asyncio

    asyncio.run(run_stdio_async())


def main():
    if "--dev" in sys.argv:
        run_http(4001)
    else:
        run_stdio()


if __name__ == "__main__":
    main()
