import json
import logging
import os
import sys
import threading
import time
from datetime import datetime, timedelta
from typing import Any

import aiohttp_cors
from ai import AIChatMessage, AIProviderFactory
from ai.context_manager import ContextManager
from aiohttp import web
from anomalies import AnomalyDetector
from db import LogDatabase
from dotenv import load_dotenv
from ingestion import IngestionServer
from mcp_server import init_mcp, mcp_server
from metadata_extractor import extract_log_metadata
from models import (
    CreateLogStreamRequest,
    DeleteLogStreamRequest,
    ExportLogsRequest,
    GenerateExtractionRegexRequest,
    GetAiMessagesRequest,
    GetAiSessionsRequest,
    GetAnomaliesRequest,
    GetFusedLogsRequest,
    GetFusionConfigRequest,
    GetLogDistributionRequest,
    GetLogsRequest,
    GetLogStreamsRequest,
    GetMetadataFacetsRequest,
    GetSampleLinesRequest,
    GetSettingsRequest,
    GetTemporalOffsetsRequest,
    GetWorkspaceSourcesRequest,
    IngestLogEntry,
    IngestLogsRequest,
    JSONRPCRequest,
    JSONRPCResponse,
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
from parser import DrainParser
from pydantic import ValidationError
from ssh_loader import SSHLoader
from tailer import FileTailer

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

DEFAULT_DB = "loglens.duckdb"


class App:
    def __init__(self, db_path=DEFAULT_DB):
        self.db = LogDatabase(db_path)
        self._parsers = {}
        self.tailers = {}
        self._start_time = time.time()
        self.dev_mode = False

        # Initialize global Drain3 parser
        self.parser = self.get_drain_parser()

        # Initialize AI Provider from settings
        settings = self.method_get_settings()
        self.ai = self._init_ai_provider(settings)

        # Initialize Ingestion Ports (Syslog/HTTP)
        syslog_port = int(settings.get("ingestion_syslog_port", "514"))
        http_port = int(settings.get("ingestion_http_port", "5002"))
        syslog_enabled = settings.get("ingestion_syslog_enabled", "true").lower() == "true"
        http_enabled = settings.get("ingestion_http_enabled", "true").lower() == "true"

        self.ingestion_server = IngestionServer(
            self,
            syslog_port=syslog_port,
            http_port=http_port,
            syslog_enabled=syslog_enabled,
            http_enabled=http_enabled,
        )
        self.ingestion_server.start()

        # Initialize Anomaly Detection
        self.anomaly_detector = AnomalyDetector(self.db)
        self.anomaly_detector.start()

        init_mcp(self)
        self._mcp_thread = None
        self._mcp_server_instance = None

        # Auto-start if enabled in settings
        if settings.get("mcp_server_enabled", "false").lower() == "true":
            self._start_mcp_server()

    def _init_ai_provider(self, settings: dict):
        """Map the correct host based on provider and return an instance."""
        provider = settings.get("ai_provider", "ollama")
        if provider == "gemini-cli":
            host = settings.get("ai_gemini_url", "http://localhost:22436")
        elif provider in ["openai-compatible", "openai"]:
            host = settings.get("ai_openai_host", "https://api.openai.com/v1")
        elif provider == "ollama":
            host = settings.get("ai_ollama_host", "http://localhost:11434")
        else:
            host = ""  # ai-studio etc.

        return AIProviderFactory.get_provider(
            provider,
            api_key=settings.get("ai_api_key", ""),
            system_prompt=settings.get("ai_system_prompt", ""),
            model=settings.get("ai_model", "gemma4:e2b"),
            host=host,
        )

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

    def stop(self):
        """Gracefully shut down all background components."""
        logger.info("Sidecar: Shutting down background workers...")

        # 1. Ingestion Server
        if hasattr(self, "ingestion_server"):
            self.ingestion_server.stop()

        # 2. Anomaly Detector
        if hasattr(self, "anomaly_detector"):
            self.anomaly_detector.stop()

        # 3. Dedicated Tailers
        for tailer in self.tailers.values():
            tailer.stop()
        self.tailers = {}

        # 4. MCP Server
        self._stop_mcp_server()

        logger.info("Sidecar: Background workers stopped.")

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
                "get_metadata_facets": GetMetadataFacetsRequest,
                "analyze_cluster": None,
                "get_settings": GetSettingsRequest,
                "update_settings": UpdateSettingsRequest,
                "list_ai_models": None,
                "send_ai_message": SendAiMessageRequest,
                "get_ai_sessions": GetAiSessionsRequest,
                "get_ai_messages": GetAiMessagesRequest,
                "rename_ai_session": None,
                "delete_ai_session": None,
                "get_ai_mapping": None,
                "save_memory": SaveMemoryRequest,
                "search_memory": SearchMemoryRequest,
                "reset_workspace_settings": GetSettingsRequest,
                "get_log_streams": GetLogStreamsRequest,
                "create_log_stream": CreateLogStreamRequest,
                "delete_log_stream": DeleteLogStreamRequest,
                "generate_facet_regex": GenerateExtractionRegexRequest,
                "export_logs": ExportLogsRequest,
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

            if field.startswith("facets."):
                facet_key = field.split(".", 1)[1]
                # Use json_extract_string for JSON type column
                field = f"json_extract_string(facets, '$.{facet_key}')"
            elif field not in allowed_fields or value is None:
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
        """Unified internal log fetcher with temporal offset calibration.
        Adjusts timestamps on-the-fly using workspace-defined offsets.
        """
        cursor = self.db.get_cursor()

        # Build base WHERE clause
        where_clauses = ["l.workspace_id = ?"]
        params: list[Any] = [workspace_id]

        if source_ids is not None:
            if not source_ids:
                return {"total": 0, "logs": [], "offset": offset, "limit": limit}
            placeholders = ",".join(["?"] * len(source_ids))
            where_clauses.append(f"l.source_id IN ({placeholders})")
            params.extend(source_ids)

        if filters:
            dict_filters = [f.model_dump() if hasattr(f, "model_dump") else f for f in filters]
            f_clauses, f_params = self._parse_filters(dict_filters)
            where_clauses.extend(f_clauses)
            params.extend(f_params)

        if query:
            from query_parser import parse_llql

            llql_sql, llql_params = parse_llql(query)
            where_clauses.append(f"({llql_sql})")
            params.extend(llql_params)

        if start_time:
            where_clauses.append("l.timestamp >= ?")
            params.append(start_time)
        if end_time:
            where_clauses.append("l.timestamp <= ?")
            params.append(end_time)

        where_sql = " AND ".join(where_clauses)
        total_logs_subquery = "(SELECT count(*) FROM logs WHERE workspace_id = ?)"

        base_query = f"""
            SELECT
                l.*,
                c.count as _cluster_count,
                c.template as cluster_template,
                CAST(c.count AS FLOAT) * 100.0 / {total_logs_subquery} as cluster_percent
            FROM logs l
            LEFT JOIN clusters c ON l.workspace_id = c.workspace_id AND l.cluster_id = c.cluster_id
            WHERE {where_sql}
        """

        params_for_data = [workspace_id] + params
        count_query = f"SELECT COUNT(*) FROM logs l WHERE {where_sql}"
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
        logs = []
        for row in cursor.fetchall():
            log_dict = dict(zip(columns, row, strict=False))
            # Handle JSON parsing for facets column
            if "facets" in log_dict and isinstance(log_dict["facets"], str):
                try:
                    log_dict["facets"] = json.loads(log_dict["facets"])
                except Exception:
                    log_dict["facets"] = {}
            elif "facets" in log_dict and log_dict["facets"] is None:
                log_dict["facets"] = {}
            logs.append(log_dict)

        self._apply_temporal_offsets(workspace_id, logs)

        return {"total": total, "logs": logs, "offset": offset, "limit": limit}

    def _apply_temporal_offsets(self, workspace_id: str, logs: list[dict]):
        """Apply global temporal offsets to a list of logs."""
        cursor = self.db.get_cursor()
        cursor.execute(
            "SELECT source_id, offset_seconds FROM temporal_offsets WHERE workspace_id = ?",
            (workspace_id,),
        )
        rows = cursor.fetchall()
        if not rows:
            return

        offsets = {row[0]: row[1] for row in rows}

        for log in logs:
            source_id = log.get("source_id")
            shift_sec = offsets.get(source_id, 0)
            if shift_sec != 0 and log.get("timestamp"):
                try:
                    ts_str = log["timestamp"]
                    if "T" in ts_str:
                        ts_str = ts_str.replace("T", " ")
                    dt = datetime.strptime(ts_str[:19], "%Y-%m-%d %H:%M:%S")
                    dt = dt + timedelta(seconds=shift_sec)
                    log["timestamp"] = dt.strftime("%Y-%m-%d %H:%M:%S")
                except Exception:
                    pass

    def method_get_logs(self, **kwargs) -> dict:
        """Fetch logs normally for a workspace/source."""
        params = GetLogsRequest(**kwargs)
        return self._get_logs_internal(**params.model_dump())

    async def method_export_logs(self, **kwargs) -> dict:
        """
        Export matching logs to a file (CSV or JSON).
        """
        params = ExportLogsRequest(**kwargs)
        
        import csv
        import json
        
        filepath = params.filepath
        file_format = params.format
        
        # Determine which fetcher to use
        if params.fusion_id:
            # Re-use get_fused_logs logic but override limit
            kwargs_copy = kwargs.copy()
            kwargs_copy["limit"] = 1000000
            kwargs_copy["offset"] = 0
            result = self.method_get_fused_logs(**kwargs_copy)
        else:
            # Re-use get_logs logic but override limit
            kwargs_copy = kwargs.copy()
            kwargs_copy["limit"] = 1000000
            kwargs_copy["offset"] = 0
            # Remove Export-specific fields for the internal fetcher
            kwargs_copy.pop("filepath", None)
            kwargs_copy.pop("format", None)
            result = self.method_get_logs(**kwargs_copy)
            
        logs = result.get("logs", [])
        
        if file_format == "csv":
            if not logs:
                with open(filepath, "w", newline="", encoding="utf-8") as f:
                    f.write("")
                return {"status": "ok", "count": 0}
                
            # Filter out internal fields starting with _
            keys = [k for k in logs[0] if not k.startswith("_")]
            
            with open(filepath, "w", newline="", encoding="utf-8") as f:
                dict_writer = csv.DictWriter(f, fieldnames=keys, extrasaction="ignore")
                dict_writer.writeheader()
                dict_writer.writerows(logs)
        else:
            # For JSON, we can export everything
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(logs, f, indent=2)
                
        return {"status": "ok", "count": len(logs)}

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
            from query_parser import parse_llql

            llql_sql, llql_params = parse_llql(params.query)
            if llql_sql:
                where_clauses.append(f"({llql_sql})")
                sql_params.extend(llql_params)

        if params.start_time:
            norm_start = params.start_time.replace("T", " ").split(".")[0].replace("Z", "")
            where_clauses.append("timestamp >= ?")
            sql_params.append(norm_start)

        if params.end_time:
            norm_end = params.end_time.replace("T", " ").split(".")[0].replace("Z", "")
            where_clauses.append("timestamp <= ?")
            sql_params.append(norm_end)

        where_sql = " AND ".join(where_clauses)

        # Aggregate by time bucket
        # Default to minute-level bucketing, but support hour-level for larger ranges
        bucket_length = 16  # YYYY-MM-DD HH:MM
        if hasattr(params, "interval") and params.interval == "1h":
            bucket_length = 13  # YYYY-MM-DD HH

        query = f"""
            SELECT
                substring(timestamp, 1, {bucket_length}) as time_bucket,
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
            if bucket_length == 13:
                time_bucket += ":00"  # Normalize to HH:00 for frontend parsing
            level = row[1]
            count = row[2]

            if time_bucket not in buckets_map:
                buckets_map[time_bucket] = {"bucket": time_bucket}

            buckets_map[time_bucket][level] = count

        return {"buckets": list(buckets_map.values())}

    def method_get_anomalies(self, workspace_id: str, time_range: str | None = None) -> dict:
        """Fetch recently detected cluster anomalies from the database."""
        cursor = self.db.get_cursor()
        query = "SELECT cluster_id, timestamp, z_score, current_rate FROM anomalies WHERE workspace_id = ?"
        params = [workspace_id]

        if time_range:
            query += " AND timestamp >= ?"
            params.append(time_range)

        query += " ORDER BY timestamp DESC LIMIT 50"
        cursor.execute(query, params)

        columns = [desc[0] for desc in cursor.description]
        anomalies = [dict(zip(columns, row, strict=False)) for row in cursor.fetchall()]

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

    def _ingest_single_log(self, cursor: Any, log: dict, custom_rules: list = None) -> list[Any]:
        """Extracts clustering logic into a reusable helper"""
        workspace_id = log.get("workspace_id")
        source_id = log.get("source_id", "manual")
        raw_text = log.get("raw_text", "")

        # 1. Advanced Metadata Extraction (Shared Logic)
        metadata = extract_log_metadata(
            workspace_id, source_id, raw_text, custom_rules=custom_rules
        )

        # Override metadata with provided values if they explicitly exist (important for manual ingest)
        timestamp = log.get("timestamp") or metadata["timestamp"]
        level = log.get("level") or metadata["level"]
        raw_message = metadata["message"]
        message = log.get("message") or raw_message

        # 2. Pattern Clustering (Drain3)
        try:
            parser = self.get_drain_parser(workspace_id)
            res = parser.parse(message)
            cluster_id = str(res["cluster_id"])
            template = res["template"]
        except Exception:
            cluster_id = "unknown"
            template = message

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

        facets = log.get("facets") or metadata.get("facets", {})
        facets_json = json.dumps(facets) if facets else None

        return [
            workspace_id,
            source_id,
            raw_text,
            timestamp,
            level,
            message,
            cluster_id,
            facets_json,
        ]

    def method_ingest_logs(self, logs: list[IngestLogEntry]) -> dict:
        """High-speed batch ingestion of log entries with pattern clustering"""
        cursor = self.db.get_cursor()
        batch_data = []

        # Map logs to dict if they are models
        log_dicts = [log.model_dump() if hasattr(log, "model_dump") else log for log in logs]

        # Optimization: Fetch and cache rules for all involved workspaces
        rules_cache = {}

        # Get global rules once
        global_rules = []
        cursor.execute("SELECT value FROM settings WHERE key = 'facet_extractions'")
        gr = cursor.fetchone()
        if gr and gr[0]:
            try:
                parsed = json.loads(gr[0])
                global_rules = parsed if isinstance(parsed, list) else []
            except Exception:
                pass

        for log in log_dicts:
            ws_id = log.get("workspace_id")
            if ws_id not in rules_cache:
                ws_rules = []
                cursor.execute(
                    "SELECT value FROM workspace_settings WHERE workspace_id = ? AND key = 'facet_extractions'",
                    (ws_id,),
                )
                wr = cursor.fetchone()
                if wr and wr[0]:
                    try:
                        parsed = json.loads(wr[0])
                        ws_rules = parsed if isinstance(parsed, list) else []
                    except Exception:
                        pass
                rules_cache[ws_id] = global_rules + ws_rules

            batch_data.append(
                self._ingest_single_log(cursor, log, custom_rules=rules_cache.get(ws_id))
            )

        if batch_data:
            cursor.executemany(
                "INSERT INTO logs (workspace_id, source_id, raw_text, timestamp, level, message, cluster_id, facets) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                batch_data,
            )
            self.db.commit()

        return {"status": "ok", "count": len(batch_data)}

    def method_get_metadata_facets(self, workspace_id: str) -> dict:
        """Return the top unique metadata facets across all logs in a workspace."""
        cursor = self.db.get_cursor()

        # 1. Define priority/standard facets
        keys = ["ip", "uuid", "user_id", "host", "thread", "logger", "status", "method"]

        # 2. Add custom facet names from settings
        # Fetch global rules
        cursor.execute("SELECT value FROM settings WHERE key = 'facet_extractions'")
        gr = cursor.fetchone()
        if gr and gr[0]:
            try:
                rules = json.loads(gr[0])
                for r in rules if isinstance(rules, list) else []:
                    name = r.get("name")
                    if name and name not in keys:
                        keys.append(name)
            except Exception:
                pass

        # Fetch workspace rules
        cursor.execute(
            "SELECT value FROM workspace_settings WHERE workspace_id = ? AND key = 'facet_extractions'",
            (workspace_id,),
        )
        wr = cursor.fetchone()
        if wr and wr[0]:
            try:
                rules = json.loads(wr[0])
                for r in rules if isinstance(rules, list) else []:
                    name = r.get("name")
                    if name and name not in keys:
                        keys.append(name)
            except Exception:
                pass

        results = {}

        for key in keys:
            # Efficiently query top 10 unique values for each facet key if they exist
            # Note: Using json_extract_string with double-quoted keys for special char safety ($."key")
            query = f"""
                SELECT json_extract_string(facets, '$."{key}"') as val, count(*) as count
                FROM logs
                WHERE workspace_id = ? AND json_extract_string(facets, '$."{key}"') IS NOT NULL
                GROUP BY val
                ORDER BY count DESC
                LIMIT 10
            """
            cursor.execute(query, (workspace_id,))
            rows = cursor.fetchall()
            if rows:
                results[key] = [{"value": r[0], "count": r[1]} for r in rows]

        return results

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

    async def method_analyze_cluster(self, cluster_id: str, workspace_id: str) -> dict:
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

        return await self.ai.analyze_logs(template, samples)

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
                f"SELECT timestamp, level, message, raw_text, cluster_id FROM logs WHERE id IN ({placeholders})",
                params.context_logs,
            )
            columns = [desc[0] for desc in cursor.description]
            logs = [dict(zip(columns, row, strict=False)) for row in cursor.fetchall()]

            if logs:
                summary = ContextManager.prepare_log_context(logs)
                log_context = f"\n\nContextual Log Summary:\n{summary}"

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
        self,
        session_id: str,
        response_content: str,
        provider_session_id: str | None,
        a2ui_payload: dict | None = None,
    ):

        cursor = self.db.get_cursor()

        cursor.execute(
            "INSERT INTO ai_messages (session_id, role, content, a2ui_payload, provider_session_id) VALUES (?, ?, ?, ?, ?)",
            (
                session_id,
                "assistant",
                response_content,
                json.dumps(a2ui_payload) if a2ui_payload else None,
                provider_session_id,
            ),
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

        # 5. Extract A2UI if present (simple check for non-streaming mode)
        a2ui_payload = None
        if "[[A2UI]]" in response_msg.content:
            try:
                parts = response_msg.content.split("[[A2UI]]")
                json_str = parts[1].split("[[/A2UI]]")[0]
                a2ui_payload = json.loads(json_str)
            except Exception:
                pass

        # 6. Record Assistant Message
        self._finalize_ai_session(
            session_id, response_msg.content, response_msg.provider_session_id, a2ui_payload
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
            "SELECT id, role, content, context_logs, timestamp, a2ui_payload FROM ai_messages WHERE session_id = ? ORDER BY timestamp ASC",
            (session_id,),
        )
        return [
            {
                "id": row[0],
                "role": row[1],
                "content": row[2],
                "context_logs": json.loads(row[3]) if row[3] else [],
                "timestamp": str(row[4]) if row[4] else None,
                "a2ui_payload": json.loads(row[5]) if row[5] else None,
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

    def method_save_template(self, workspace_id: str, name: str, config_json: str) -> dict:
        """Persist a discovery template (filters + highlights)."""
        cursor = self.db.get_cursor()
        cursor.execute(
            "INSERT INTO settings_templates (workspace_id, name, config_json) VALUES (?, ?, ?)",
            (workspace_id, name, config_json),
        )
        self.db.commit()
        return {"status": "ok"}

    def method_get_templates(self, workspace_id: str) -> list:
        """Fetch all discovery templates for a workspace."""
        cursor = self.db.get_cursor()
        cursor.execute(
            "SELECT id, name, config_json, created_at FROM settings_templates WHERE workspace_id = ? ORDER BY created_at DESC",
            (workspace_id,),
        )
        return [
            {"id": row[0], "name": row[1], "config": row[2], "created_at": str(row[3])}
            for row in cursor.fetchall()
        ]

    def method_delete_template(self, id: int) -> dict:
        """Remove a discovery template."""
        cursor = self.db.get_cursor()
        cursor.execute("DELETE FROM settings_templates WHERE id = ?", (id,))
        self.db.commit()
        return {"status": "ok"}

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
        """No-op for DuckDB implementation, handled by DB persistence."""
        pass

    def method_update_temporal_offsets(self, **kwargs) -> dict:
        """Update time offsets for specific log sources."""
        params = UpdateTemporalOffsetsRequest(**kwargs)
        cursor = self.db.get_cursor()

        for source_id, offset_seconds in params.offsets.items():
            cursor.execute(
                """
                INSERT INTO temporal_offsets (workspace_id, source_id, offset_seconds)
                VALUES (?, ?, ?)
                ON CONFLICT (workspace_id, source_id) DO UPDATE SET
                    offset_seconds = excluded.offset_seconds
            """,
                (params.workspace_id, source_id, offset_seconds),
            )

        self.db.commit()
        return {"status": "ok"}

    def method_get_temporal_offsets(self, **kwargs) -> dict:
        """Retrieve all time offsets for a workspace."""
        params = GetTemporalOffsetsRequest(**kwargs)
        cursor = self.db.get_cursor()

        cursor.execute(
            "SELECT source_id, offset_seconds FROM temporal_offsets WHERE workspace_id = ?",
            (params.workspace_id,),
        )
        rows = cursor.fetchall()
        return {"offsets": {row[0]: row[1] for row in rows}}

    def method_get_settings(self, workspace_id: str | None = None) -> dict:
        cursor = self.db.get_cursor()

        # 1. Fetch Global Settings
        cursor.execute("SELECT key, value FROM settings")
        settings = {row[0]: row[1] for row in cursor.fetchall()}

        # 2. If workspace_id provided, override with workspace-specific settings
        if workspace_id:
            cursor.execute(
                "SELECT key, value FROM workspace_settings WHERE workspace_id = ?", (workspace_id,)
            )
            workspace_settings = {row[0]: row[1] for row in cursor.fetchall()}
            settings.update(workspace_settings)

        return settings

    def method_reset_workspace_settings(self, workspace_id: str) -> dict:
        """Delete all overrides for a specific workspace."""
        if not workspace_id:
            return {"status": "error", "message": "workspace_id required"}

        cursor = self.db.get_cursor()
        cursor.execute("DELETE FROM workspace_settings WHERE workspace_id = ?", (workspace_id,))

        # Invalidate parser cache for this workspace
        if workspace_id in self._parsers:
            del self._parsers[workspace_id]

        return {"status": "ok"}

    def method_update_settings(self, settings: dict, workspace_id: str | None = None) -> dict:
        cursor = self.db.get_cursor()

        # Update persistent settings (Global vs Workspace)
        if workspace_id:
            query = (
                "INSERT INTO workspace_settings (workspace_id, key, value) VALUES (?, ?, ?) "
                "ON CONFLICT (workspace_id, key) DO UPDATE SET value = excluded.value"
            )
            for k, v in settings.items():
                # Use json.dumps for complex values (lists/dicts) to ensure valid JSON in DB
                val_to_save = json.dumps(v) if isinstance(v, (list, dict)) else str(v)
                cursor.execute(query, (workspace_id, k, val_to_save))
        else:
            # Re-initialize AI Provider if relevant global settings changed
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
                # Update transient AI state immediately for global changes
                if "ai_provider" in settings:
                    self.ai.provider = settings["ai_provider"]
                if "ai_api_key" in settings:
                    self.ai.api_key = settings["ai_api_key"]
                if "ai_system_prompt" in settings:
                    self.ai.system_prompt = settings["ai_system_prompt"]

            query = (
                "INSERT INTO settings (key, value) VALUES (?, ?) "
                "ON CONFLICT (key) DO UPDATE SET value = excluded.value"
            )
            for k, v in settings.items():
                # Use json.dumps for complex values (lists/dicts) to ensure valid JSON in DB
                val_to_save = json.dumps(v) if isinstance(v, (list, dict)) else str(v)
                cursor.execute(query, (k, val_to_save))

        # Re-initialize AI Provider if relevant settings changed (Global-only for now)
        if not workspace_id and any(
            k in settings
            for k in [
                "ai_provider",
                "ai_api_key",
                "ai_ollama_host",
                "ai_openai_host",
                "ai_gemini_url",
                "ai_model",
                "ai_system_prompt",
            ]
        ):
            current_settings = self.method_get_settings()
            self.ai = self._init_ai_provider(current_settings)

        # Reset specific Drain parser if clustering settings changed
        if any(k.startswith("drain_") for k in settings):
            if workspace_id and workspace_id in self._parsers:
                del self._parsers[workspace_id]
            else:
                self._parsers = {}

        # Reconfigure Ingestion Server if relevant settings changed
        if not workspace_id and any(k.startswith("ingestion_") for k in settings):
            current_settings = self.method_get_settings()
            syslog_port = int(current_settings.get("ingestion_syslog_port", "514"))
            http_port = int(current_settings.get("ingestion_http_port", "5002"))
            syslog_enabled = (
                current_settings.get("ingestion_syslog_enabled", "true").lower() == "true"
            )
            http_enabled = current_settings.get("ingestion_http_enabled", "true").lower() == "true"

            self.ingestion_server.reconfigure(
                syslog_enabled=syslog_enabled,
                syslog_port=syslog_port,
                http_enabled=http_enabled,
                http_port=http_port,
            )

        self.db.commit()
        return {"status": "success"}

    def get_drain_parser(self, workspace_id: str = None) -> DrainParser:
        """Get or create a Drain3 parser based on current scope settings."""
        settings = self.method_get_settings(workspace_id)
        scope = settings.get("drain_template_scope", "global")

        sim_th = float(settings.get("drain_similarity_threshold", "0.4"))
        max_children = int(settings.get("drain_max_children", "100"))
        max_clusters = int(settings.get("drain_max_clusters", "1000"))

        masks_raw = settings.get("drain_masks", "[]")
        try:
            masking_instructions = json.loads(masks_raw)
            # Handle potential double-encoding (JSON string inside JSON string)
            if isinstance(masking_instructions, str):
                masking_instructions = json.loads(masking_instructions)
            # Ensure it's a list for iteration safety
            if not isinstance(masking_instructions, list):
                masking_instructions = []
        except Exception:
            masking_instructions = []

        if scope == "global" or not workspace_id:
            key = "__global__"
            path = "data/drain/global.state"
        else:
            key = workspace_id
            path = f"data/drain/workspace_{workspace_id}.state"

        if key not in self._parsers:
            self._parsers[key] = DrainParser(
                persistence_path=path,
                sim_th=sim_th,
                max_children=max_children,
                max_clusters=max_clusters,
                masking_instructions=masking_instructions,
            )
        return self._parsers[key]

    def method_reset_templates(self, workspace_id: str = None) -> dict:
        """Deletes the persistence state for the given workspace or global scope."""
        settings = self.method_get_settings()
        scope = settings.get("drain_template_scope", "global")

        if scope == "global" or not workspace_id:
            path = "data/drain/global.state"
            key = "__global__"
        else:
            path = f"data/drain/workspace_{workspace_id}.state"
            key = workspace_id

        if key in self._parsers:
            del self._parsers[key]

        if os.path.exists(path):
            os.remove(path)

        return {"status": "success", "scope": scope, "workspace_id": workspace_id}

    def method_get_log_streams(self, workspace_id: str) -> list:
        """Fetch all configured log streams for a workspace."""
        cursor = self.db.get_cursor()
        cursor.execute(
            "SELECT id, workspace_id, name, type, port, enabled FROM log_streams WHERE workspace_id = ?",
            (workspace_id,),
        )
        return [
            {
                "id": row[0],
                "workspace_id": row[1],
                "name": row[2],
                "type": row[3],
                "port": row[4],
                "enabled": bool(row[5]),
            }
            for row in cursor.fetchall()
        ]

    def method_create_log_stream(self, workspace_id: str, name: str, type: str, port: int) -> dict:
        """Register a new log stream routing."""
        cursor = self.db.get_cursor()
        cursor.execute(
            "INSERT INTO log_streams (workspace_id, name, type, port) VALUES (?, ?, ?, ?)",
            (workspace_id, name, type, port),
        )
        self.db.commit()

        # Trigger ingestion server refresh
        if hasattr(self, "ingestion_server"):
            self.ingestion_server.refresh_streams()

        return {"status": "success"}

    def method_delete_log_stream(self, id: int) -> dict:
        """Remove a log stream routing."""
        cursor = self.db.get_cursor()
        cursor.execute("DELETE FROM log_streams WHERE id = ?", (id,))
        self.db.commit()

        if hasattr(self, "ingestion_server"):
            self.ingestion_server.refresh_streams()

        return {"status": "success"}

    async def aiohttp_handler(self, request):
        try:
            body = await request.json()
            req = JSONRPCRequest(**body)
            res = await self.dispatch(req)
            resp_data = res.model_dump()
            logger.debug("RPC Response [%s]: %s", req.method, json.dumps(resp_data)[:100])
            return web.json_response(resp_data)
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

            await response.write(f"data: {json.dumps({'session_id': session_id})}\n\n".encode())

            full_text = []
            a2ui_buffer = ""
            is_collecting_a2ui = False
            extracted_a2ui = None

            if hasattr(self.ai, "chat_stream"):
                async for chunk in self.ai.chat_stream(
                    messages=history,
                    model=params.model,
                    reasoning=params.reasoning,
                    session_id=session_id,
                    provider_session_id=provider_session_id,
                ):
                    full_text.append(chunk)

                    # --- A2UI Streaming Logic ---
                    # Check if we're entering an A2UI block
                    if "[[A2UI]]" in chunk and not is_collecting_a2ui:
                        is_collecting_a2ui = True
                        parts = chunk.split("[[A2UI]]")
                        a2ui_buffer = parts[1]
                    elif is_collecting_a2ui:
                        a2ui_buffer += chunk

                    # Check if we're leaving an A2UI block
                    if "[[/A2UI]]" in a2ui_buffer and is_collecting_a2ui:
                        try:
                            # 1. Fragment the raw content
                            raw_content = a2ui_buffer.split("[[/A2UI]]")[0].strip()

                            # 2. Strategy A: Attempt JSON parse (Legacy/Standard)
                            try:
                                extracted_a2ui = json.loads(raw_content)
                            except ValueError:
                                # Strategy B: It's likely Markup format (button label="...")
                                # We pass it as a special object that the frontend A2UIRenderer will understand
                                extracted_a2ui = {"type": "markup", "raw": raw_content}

                            # 3. Stream to UI
                            await response.write(
                                f"data: {json.dumps({'a2ui_payload': extracted_a2ui})}\n\n".encode()
                            )
                        except Exception as e:
                            logger.error("Failed to parse A2UI block: %s", e)
                        is_collecting_a2ui = False

                    payload = {"chunk": chunk}
                    await response.write(f"data: {json.dumps(payload)}\n\n".encode())
            else:
                # Fallback to cold full fetch
                resp_msg = await self.ai.chat(
                    history,
                    model=params.model,
                    session_id=session_id,
                    provider_session_id=provider_session_id,
                )
                full_text.append(resp_msg.content)

                # Extract A2UI from full message
                if "[[A2UI]]" in resp_msg.content:
                    try:
                        parts = resp_msg.content.split("[[A2UI]]")
                        raw_content = parts[1].split("[[/A2UI]]")[0].strip()
                        try:
                            extracted_a2ui = json.loads(raw_content)
                        except ValueError:
                            extracted_a2ui = {"type": "markup", "raw": raw_content}
                    except Exception:
                        pass

                payload = {"chunk": resp_msg.content}
                if extracted_a2ui:
                    payload["a2ui_payload"] = extracted_a2ui

                await response.write(f"data: {json.dumps(payload)}\n\n".encode())

            final_text = "".join(full_text)
            # If we didn't extract it during stream (e.g. malformed closing tag), try one last time on full text
            if not extracted_a2ui and "[[A2UI]]" in final_text:
                try:
                    parts = final_text.split("[[A2UI]]")
                    raw_content = parts[1].split("[[/A2UI]]")[0].strip()
                    try:
                        extracted_a2ui = json.loads(raw_content)
                    except ValueError:
                        extracted_a2ui = {"type": "markup", "raw": raw_content}
                except Exception:
                    pass

            # ... existing session finalization ...
            # Wait for backend transactions to commit by introducing a tiny delay in UI logic
            # (Note: self._finalize_ai_session now accepts a2ui_payload)
            final_provider_session_id = provider_session_id
            if hasattr(self.ai, "_task_cache") and session_id in self.ai._task_cache:
                final_provider_session_id = self.ai._task_cache.get(session_id)

            self._finalize_ai_session(
                session_id, final_text, final_provider_session_id, extracted_a2ui
            )

            await response.write(b"data: [DONE]\n\n")
            return response
        except Exception as e:
            import traceback

            logger.error("AI Stream Error: %s", str(e))
            traceback.print_exc()
            await response.write(f"data: {json.dumps({'error': str(e)})}\n\n".encode())
            return response

    async def method_generate_facet_regex(
        self, log_line: str, selected_text: str, workspace_id: str = None
    ) -> dict:
        """Uses AI to generate a regex pattern for extracting a selected value from a log line."""
        prompt = (
            f"Given the log line: '{log_line}'\n"
            f"Generate a robust Python regex that extracts the exact substring: '{selected_text}'.\n"
            "The regex MUST have exactly one capturing group (e.g. (...) ) for the extraction.\n"
            "Avoid overly greedy matches. Be specific to the surrounding anchor characters if possible.\n"
            "Return ONLY the raw regex string, no markdown, no explanation, no backticks."
        )

        try:
            import re

            from ai import AIChatMessage

            messages = [AIChatMessage(role="user", content=prompt)]
            # We use the current AI provider
            response = await self.ai.chat(messages)
            regex = response.content.strip().strip("`").strip()

            # Remove potential 'python' or 'regex' labels if AI used markdown
            if regex.startswith("python"):
                regex = regex[6:].strip()
            if regex.startswith("regex"):
                regex = regex[5:].strip()

            # Basic validation
            try:
                re.compile(regex)
                # Verify it has at least one capturing group
                if "(" not in regex or ")" not in regex:
                    regex = f"({re.escape(selected_text)})"
            except Exception:
                # Fallback to literal if AI fails to produce a valid regex
                regex = f"({re.escape(selected_text)})"

            return {"regex": regex}
        except Exception as e:
            logger.error("Failed to generate regex with AI: %s", e)
            import re

            return {"regex": f"({re.escape(selected_text)})"}

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


async def on_cleanup(server_app):
    """Lifecycle hook to clean up background workers when aiohttp stops."""
    app = server_app.get("sidecar_app")
    if app:
        app.stop()
    LogDatabase.reset()


def run_http(port=5000, db_path=DEFAULT_DB):
    app = App(db_path=db_path)
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

    server["sidecar_app"] = app
    server.on_cleanup.append(on_cleanup)
    web.run_app(server, host="127.0.0.1", port=port)


async def run_stdio_async(db_path=DEFAULT_DB):
    app = App(db_path=db_path)
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
        app.stop()
        LogDatabase.reset()
        logger.info("Sidecar: Cleanly exited.")


def run_stdio(db_path=DEFAULT_DB):
    import asyncio

    asyncio.run(run_stdio_async(db_path=db_path))
