# Assume Role: Backend Engineer (@backend)
import asyncio
import csv
import inspect
import json
import logging
import os
import re
import shutil
import sys
import threading
import time
import traceback
import uuid
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

import aiohttp_cors
import pyarrow as pa
import uvicorn
from ai import AIChatMessage, AIProviderFactory
from ai.context import SmartContextManager
from ai.reasoning import parse_reasoning_blocks
from ai.runner import HybridRunner
from aiohttp import web
from anomalies import AnomalyDetector
from db import LogDatabase
from dotenv import load_dotenv
from ingestion import IngestionServer
from mcp_server import init_mcp, mcp_server
from metadata_extractor import extract_log_metadata
from models import (
    AnalyzeClusterRequest,
    CreateLogSourceRequest,
    CreateLogStreamRequest,
    DeleteLogSourceRequest,
    DeleteLogsRequest,
    DeleteLogStreamRequest,
    DeleteWorkspaceRequest,
    ExportLogsRequest,
    FolderCreateRequest,
    FolderDeleteRequest,
    FolderUpdateRequest,
    GenerateExtractionRegexRequest,
    GetAiMessagesRequest,
    GetAiSessionsRequest,
    GetAnomaliesRequest,
    GetClusteringStatusRequest,
    GetDashboardStatsRequest,
    GetFusedLogsRequest,
    GetFusionConfigRequest,
    GetHierarchyRequest,
    GetIngestionJobsRequest,
    GetLogContentRequest,
    GetLogDistributionRequest,
    GetLogsRequest,
    GetLogStreamsRequest,
    GetMetadataFacetsRequest,
    GetSampleLinesRequest,
    GetSettingsRequest,
    GetTemporalOffsetsRequest,
    GetTimeBoundariesRequest,
    GetWorkspaceSourcesRequest,
    IngestLocalFileRequest,
    IngestLogsRequest,
    JSONRPCRequest,
    JSONRPCResponse,
    PurgeInactiveWorkspacesRequest,
    ReadFileRequest,
    SaveMemoryRequest,
    SearchMemoryRequest,
    SendAiMessageRequest,
    SetClusteringModeRequest,
    SourceMoveRequest,
    SourceUpdateRequest,
    StartSSHTailRequest,
    StartTailRequest,
    TestAiConnectionRequest,
    UpdateCommentRequest,
    UpdateFusionConfigRequest,
    UpdateSettingsRequest,
    UpdateSourceParserRequest,
    UpdateTemporalOffsetsRequest,
)
from parser import DrainParser
from pydantic import ValidationError
from query_parser import parse_llql
from services.fast_path import FastPathService
from services.log_file_store import DiskLogStore
from services.rag_service import RagService
from services.shared_core import SharedSourceManager
from ssh_loader import SSHLoader
from tailer import FileTailer
from workers.clustering import ClusteringWorker

A2UI_START = "[[A2UI]]"
A2UI_END = "[[/A2UI]]"
AI_STATE_DB = "ai_state.sqlite"
SQL_AND_JOIN = " AND "

INTERVAL_1_SEC = "1 second"
INTERVAL_5_SEC = "5 seconds"
INTERVAL_15_SEC = "15 seconds"
INTERVAL_1_MIN = "1 minute"
INTERVAL_5_MIN = "5 minutes"
INTERVAL_15_MIN = "15 minutes"
INTERVAL_1_HOUR = "1 hour"
INTERVAL_4_HOURS = "4 hours"
INTERVAL_12_HOURS = "12 hours"
INTERVAL_1_DAY = "1 day"
INTERVAL_30_DAYS = "30 days"

INTERVALS = {
    INTERVAL_1_SEC: (timedelta(seconds=1), "%Y-%m-%d %H:%M:%S"),
    INTERVAL_5_SEC: (timedelta(seconds=5), "%Y-%m-%d %H:%M:%S"),
    INTERVAL_15_SEC: (timedelta(seconds=15), "%Y-%m-%d %H:%M:%S"),
    INTERVAL_1_MIN: (timedelta(minutes=1), "%Y-%m-%d %H:%M"),
    INTERVAL_5_MIN: (timedelta(minutes=5), "%Y-%m-%d %H:%M"),
    INTERVAL_15_MIN: (timedelta(minutes=15), "%Y-%m-%d %H:%M"),
    INTERVAL_1_HOUR: (timedelta(hours=1), "%Y-%m-%d %H:00"),
    INTERVAL_4_HOURS: (timedelta(hours=4), "%Y-%m-%d %H:00"),
    INTERVAL_12_HOURS: (timedelta(hours=12), "%Y-%m-%d %H:00"),
    INTERVAL_1_DAY: (timedelta(days=1), "%Y-%m-%d"),
    INTERVAL_30_DAYS: (timedelta(days=30), "%Y-%m"),
}


def _determine_bucket_interval(duration_sec: float) -> str:
    if duration_sec <= 10:
        return INTERVAL_1_SEC
    if duration_sec <= 60:
        return INTERVAL_5_SEC
    if duration_sec <= 600:
        return INTERVAL_15_SEC
    if duration_sec <= 3600:
        return INTERVAL_1_MIN
    if duration_sec <= 14400:
        return INTERVAL_5_MIN
    if duration_sec <= 86400:
        return INTERVAL_15_MIN
    if duration_sec <= 259200:
        return INTERVAL_1_HOUR
    if duration_sec <= 604800:
        return INTERVAL_4_HOURS
    if duration_sec <= 2592000:
        return INTERVAL_12_HOURS
    if duration_sec <= 15552000:
        return INTERVAL_1_DAY
    return INTERVAL_30_DAYS


def _parse_ts(ts_str: str | None) -> datetime | None:
    if not ts_str:
        return None
    s = ts_str.replace("T", " ").replace("Z", "").strip()
    _formats = [
        ("%Y-%m-%d %H:%M:%S", 19),
        ("%Y-%m-%d %H:%M", 16),
        ("%Y-%m-%d %H", 13),
        ("%Y-%m-%d", 10),
        ("%Y-%m", 7),
    ]
    for fmt, length in _formats:
        try:
            return datetime.strptime(s[:length], fmt)
        except ValueError:
            continue
    return None


def _floor_to_bucket(dt: datetime, ivl: timedelta) -> datetime:
    epoch = datetime(1970, 1, 1)
    total_secs = (dt - epoch).total_seconds()
    ivl_secs = ivl.total_seconds()
    if ivl_secs <= 0:
        return dt
    floored_secs = (total_secs // ivl_secs) * ivl_secs
    return epoch + timedelta(seconds=floored_secs)


def _json_default(obj: Any) -> str:
    """Custom JSON serializer for types not supported by the stdlib encoder.

    Per architecture rules, datetime objects must NEVER appear in JSON-RPC
    responses. This acts as a safety net for any value that slips through.
    """
    if isinstance(obj, datetime):
        return obj.isoformat()
    return str(obj)


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
banner = f"--- Sidecar Tracing Session Started --- (Level: {logging.getLevelName(LOG_LEVEL)})"
logger.info(banner)
sys.stderr.write(f"{banner}\n")
sys.stderr.flush()
logger.info("Log path: %s", LOG_FILE)

DEFAULT_DB = os.path.join(PROJECT_ROOT, "data", "loglens.duckdb")


class App:
    """Main application singleton handling JSON-RPC dispatching and state orchestration."""

    RPC_MODELS: dict[str, Any] = {
        "get_logs": GetLogsRequest,
        "get_fused_logs": GetFusedLogsRequest,
        "update_fusion_config": UpdateFusionConfigRequest,
        "get_fusion_config": GetFusionConfigRequest,
        "start_tail": StartTailRequest,
        "start_ssh_tail": StartSSHTailRequest,
        "stop_tail": StartTailRequest,
        "ingest_logs": IngestLogsRequest,
        "ingest_local_file": IngestLocalFileRequest,
        "read_file": ReadFileRequest,
        "update_log_comment": UpdateCommentRequest,
        "get_temporal_offsets": GetTemporalOffsetsRequest,
        "get_workspace_sources": GetWorkspaceSourcesRequest,
        "get_ingestion_jobs": GetIngestionJobsRequest,
        "get_clustering_status": GetClusteringStatusRequest,
        "set_clustering_mode": SetClusteringModeRequest,
        "get_sample_lines": GetSampleLinesRequest,
        "update_source_parser": UpdateSourceParserRequest,
        "get_anomalies": GetAnomaliesRequest,
        "get_metadata_facets": GetMetadataFacetsRequest,
        "analyze_cluster": AnalyzeClusterRequest,
        "get_settings": GetSettingsRequest,
        "get_time_boundaries": GetTimeBoundariesRequest,
        "update_settings": UpdateSettingsRequest,
        "get_dashboard_stats": GetDashboardStatsRequest,
        "purge_inactive_workspaces": PurgeInactiveWorkspacesRequest,
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
        "delete_logs": DeleteLogsRequest,
        "delete_workspace": DeleteWorkspaceRequest,
        "get_hierarchy": GetHierarchyRequest,
        "create_folder": FolderCreateRequest,
        "update_folder": FolderUpdateRequest,
        "delete_folder": FolderDeleteRequest,
        "create_log_source": CreateLogSourceRequest,
        "update_log_source": SourceUpdateRequest,
        "delete_log_source": DeleteLogSourceRequest,
        "move_source": SourceMoveRequest,
        "factory_reset": None,
        "get_log_content": GetLogContentRequest,
        "get_health": None,
    }

    def __init__(
        self,
        db_path=None,
        start_ingestion=True,
        start_anomalies=True,
        start_mcp=True,
    ):
        if db_path is None:
            db_path = DEFAULT_DB
        elif not os.path.isabs(db_path) and db_path != ":memory:":
            # If a relative path is provided, resolve it against PROJECT_ROOT/data
            db_path = os.path.join(PROJECT_ROOT, "data", db_path)

        # Ensure data dir exists
        db_dir = os.path.dirname(db_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)

        self.db = LogDatabase(db_path)
        logger.info("Database initialized at: %s", os.path.abspath(db_path))

        # --- RAG Memory Service ---
        self.rag_service = RagService(os.path.join(PROJECT_ROOT, "data"))

        # --- Disk-First / Fast-Path store ---
        # All raw log text lives here; DuckDB only stores line_id pointers.
        storage_dir = os.path.join(PROJECT_ROOT, "data", "storage")
        self.log_store = DiskLogStore(storage_dir)
        logger.info("DiskLogStore initialized at: %s", storage_dir)
        self.fast_path = FastPathService(storage_dir, log_store=self.log_store)
        logger.info("FastPathService initialized at: %s", storage_dir)

        self.shared_manager = SharedSourceManager(self.log_store)
        logger.info("SharedSourceManager initialized")

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
        if start_ingestion:
            self.ingestion_server.start()

        # Initialize Anomaly Detection
        self.anomaly_detector = AnomalyDetector(self.db)
        if start_anomalies:
            self.anomaly_detector.start()

        # Initialize Context Manager for AI
        self.context_manager = SmartContextManager()

        # Initialize Clustering Worker
        self.clustering_worker = ClusteringWorker(self)
        self.clustering_worker.start()

        # Initialize Hybrid Orchestration Runner
        ai_data_dir = os.path.join(PROJECT_ROOT, "data")
        os.makedirs(ai_data_dir, exist_ok=True)
        self.hybrid_runner = HybridRunner(
            self, self.ai, db_path=os.path.join(ai_data_dir, AI_STATE_DB)
        )

        init_mcp(self)
        self._mcp_thread = None
        self._mcp_server_instance = None

        # Auto-start if enabled in settings
        if start_mcp and settings.get("mcp_server_enabled", "false").lower() == "true":
            self._start_mcp_server()

    def _init_ai_provider(self, settings: dict):
        """Initialize the AI provider using the factory."""
        provider = settings.get("ai_provider", "ollama")
        logger.info("Initializing AI Provider: %s", provider)

        return AIProviderFactory.get_provider(
            provider,
            api_key=settings.get("ai_api_key", ""),
            system_prompt=settings.get("ai_system_prompt", ""),
            model=settings.get("ai_model", "gemma4:e2b"),
            settings=settings,
        )

    def method_get_ingestion_jobs(self, workspace_id: str | None = None) -> list[dict]:
        """Fetch all ingestion jobs for a workspace."""
        logger.info("RPC Dispatch: get_ingestion_jobs (workspace=%s)", workspace_id)
        return self.db.get_ingestion_jobs(workspace_id)

    def method_get_clustering_status(self, workspace_id: str | None = None) -> dict:
        """Fetch current clustering worker status and backlog."""
        logger.debug("RPC Dispatch: get_clustering_status (workspace=%s)", workspace_id)
        return self.clustering_worker.get_status()

    def method_set_clustering_mode(self, mode: str, workspace_id: str | None = None) -> dict:
        """Set clustering worker mode (auto, manual, burst)."""
        logger.info("RPC Dispatch: set_clustering_mode (mode=%s, workspace=%s)", mode, workspace_id)
        self.clustering_worker.set_mode(mode)
        return {
            "status": "success",
            "mode": self.clustering_worker.mode,
            "paused": self.clustering_worker.paused,
        }

    def method_set_clustering_paused(self, paused: bool, workspace_id: str | None = None) -> dict:
        """Explicitly pause or resume the clustering worker."""
        logger.info(
            "RPC Dispatch: set_clustering_paused (paused=%s, workspace=%s)", paused, workspace_id
        )
        self.clustering_worker.set_paused(paused)
        return {"status": "success", "paused": self.clustering_worker.paused}

    def method_delete_logs(self, workspace_id: str, source_id: str | None = None) -> dict:
        """Delete logs for a workspace or specific source."""
        logger.info("RPC Dispatch: delete_logs (workspace=%s, source=%s)", workspace_id, source_id)
        self.db.delete_logs(workspace_id, source_id)
        return {"status": "success"}

    def method_delete_workspace(self, workspace_id: str) -> dict:
        """Delete all database records and storage files associated with a workspace."""
        logger.info("RPC Dispatch: delete_workspace (workspace=%s)", workspace_id)

        # 1. Stop tailers for this workspace
        keys_to_stop = [k for k in self.tailers if k.startswith(f"{workspace_id}:")]
        for key in keys_to_stop:
            try:
                self.tailers[key].stop()
                self.tailers.pop(key, None)
                logger.info("Stopped tailer for deleted workspace: %s", key)
            except Exception as e:
                logger.error("Error stopping tailer %s: %s", key, e)

        # 2. Fetch log source IDs associated with the workspace to delete physical files
        cursor = self.db.get_cursor()
        cursor.execute("SELECT id FROM log_sources WHERE workspace_id = ?", (workspace_id,))
        source_ids = [row[0] for row in cursor.fetchall()]

        # 3. Delete database records
        self.db.delete_workspace(workspace_id)

        # 4. Delete physical storage files
        if hasattr(self, "log_store"):
            for source_id in source_ids:
                try:
                    self.log_store.delete_source_files(source_id)
                except Exception as e:
                    logger.error(
                        "Error deleting physical files for source %s: %s",
                        source_id,
                        e,
                    )

        return {"status": "success"}

    def method_factory_reset(self) -> dict:
        """Total wipe of all backend persistent state (DB, AI state, Drain clusters)."""
        logger.warning("RPC Dispatch: factory_reset - PERFORMING TOTAL WIPE")

        # 1. Stop all workers and threads
        self.stop()

        # 1.5 Close raw file handles
        if hasattr(self, "log_store"):
            self.log_store.close_all()
        if hasattr(self, "fast_path"):
            self.fast_path.close_all()

        # 2. Close and reset the DB singleton
        LogDatabase.reset()

        # 3. Delete files
        data_dir = os.path.join(PROJECT_ROOT, "data")
        db_path = os.path.join(data_dir, "loglens.duckdb")
        ai_path = os.path.join(data_dir, AI_STATE_DB)
        drain_dir = os.path.join(data_dir, "drain")
        storage_dir = os.path.join(data_dir, "storage")

        files_to_delete = [db_path, f"{db_path}.wal", ai_path, f"{ai_path}-wal", f"{ai_path}-shm"]

        for f in files_to_delete:
            if os.path.exists(f):
                try:
                    os.remove(f)
                    logger.info("Deleted: %s", f)
                except Exception as e:
                    logger.error("Failed to delete %s: %s", f, e)

        for d in [drain_dir, storage_dir]:
            if os.path.exists(d):
                try:
                    shutil.rmtree(d)
                    logger.info("Deleted directory: %s", d)
                except Exception as e:
                    logger.error("Failed to delete dir: %s", e)

        # 4. Re-initialize
        # Note: We don't fully re-init 'self' because we are in a dispatch loop.
        # But we initialize a new DB instance so subsequent calls work.
        self.db = LogDatabase(db_path)
        self.parser = self.get_drain_parser()

        if hasattr(self, "log_store"):
            os.makedirs(storage_dir, exist_ok=True)
            self.log_store = DiskLogStore(storage_dir)
            self.fast_path = FastPathService(storage_dir)

        # Re-start workers
        self.ingestion_server.start()

        # FIX: Re-initialize and start anomaly detector to pick up new DB handle
        self.anomaly_detector = AnomalyDetector(self.db)
        self.anomaly_detector.start()

        # FIX: Re-initialize and start clustering worker
        self.clustering_worker = ClusteringWorker(self)
        self.clustering_worker.start()

        # FIX: Re-initialize Hybrid Runner (AI State)
        ai_data_dir = os.path.join(PROJECT_ROOT, "data")
        self.hybrid_runner = HybridRunner(
            self, self.ai, db_path=os.path.join(ai_data_dir, AI_STATE_DB)
        )

        return {"status": "ok", "message": "Backend reset complete. System fully re-initialized."}

    def _start_mcp_server(self):
        """Starts the MCP server in a background thread using FastMCP SSE."""
        if self._mcp_thread and self._mcp_thread.is_alive():
            return

        def run_mcp():
            try:
                config = uvicorn.Config(
                    mcp_server.application,  # type: ignore
                    host="127.0.0.1",
                    port=5002,
                    log_level="error",
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

    async def stop_async(self):
        """Async version of stop to handle async components."""
        self.stop()
        if hasattr(self, "hybrid_runner"):
            await self.hybrid_runner.graph_manager.close()

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

        # 4. Clustering Worker
        if hasattr(self, "clustering_worker"):
            self.clustering_worker.stop()

        # 4.5 Save Clustering States (Drain3)
        if hasattr(self, "_parsers"):
            logger.info("Sidecar: Saving clustering states...")
            for key, parser in self._parsers.items():
                try:
                    parser.save()
                except Exception as e:
                    logger.error("Failed to save clustering state for %s: %s", key, e)

        # 5. MCP Server
        self._stop_mcp_server()

        # 6. Log Store & Shared Core
        if hasattr(self, "log_store"):
            self.log_store.close_all()

        logger.info("Sidecar: Background workers stopped.")

    async def _execute_handler(self, handler, kwargs: dict) -> Any:
        res = handler(**kwargs)
        if inspect.iscoroutine(res):
            return await res
        return res

    async def dispatch(self, req: JSONRPCRequest) -> JSONRPCResponse:
        logger.info("RPC Dispatch: %s", req.method)
        try:
            method_name = f"method_{req.method}"

            if not hasattr(self, method_name):
                return JSONRPCResponse(
                    id=req.id, error={"code": -32601, "message": f"Method not found: {req.method}"}
                )

            handler = getattr(self, method_name)

            # Perform Pydantic validation if a model is defined
            model = self.RPC_MODELS.get(req.method)

            # Methods that handle large payloads/heavy DB queries and must not block the event loop
            offload_to_thread = {
                "ingest_logs",
                "ingest_local_file",
                "export_logs",
                "get_dashboard_stats",
                "get_logs",
                "get_fused_logs",
                "get_metadata_facets",
            }

            if model:
                try:
                    if req.method in offload_to_thread:
                        # Offload validation + execution for large-payload methods
                        def _run_offloaded():
                            params_model = model(**req.params)
                            return handler(**params_model.model_dump())

                        result = await asyncio.to_thread(_run_offloaded)
                    else:
                        params_model = model(**req.params)
                        result = await self._execute_handler(handler, params_model.model_dump())
                except ValidationError as ve:
                    logger.error(
                        "JSON-RPC Validation Error for method '%s': %s", req.method, ve.errors()
                    )
                    return JSONRPCResponse(
                        id=req.id,
                        error={"code": -32602, "message": "Invalid params", "data": ve.errors()},
                    )
            else:
                # Direct call for unmapped methods
                result = await self._execute_handler(handler, req.params)

            return JSONRPCResponse(id=req.id, result=result)
        except Exception as e:
            logger.exception("JSON-RPC Dispatch Error")
            return JSONRPCResponse(
                id=req.id, error={"code": -32603, "message": "Internal error", "data": str(e)}
            )

    def _process_single_filter(self, f: dict, allowed_fields: set[str], field_groups: dict):
        """Processes a single filter dict and appends the resulting SQL clause to field_groups."""
        field = f.get("field")
        value = f.get("value")
        op = f.get("operator", "equals")

        if not field or value is None:
            return

        if field.startswith("facets."):
            facet_key = field.split(".", 1)[1]
            field_sql = f"json_extract_string(l.facets, '$.{facet_key}')"
        elif field in allowed_fields:
            field_sql = f"l.{field}"
        else:
            return

        clause, param = self._build_filter_clause(field_sql, op, value)
        if clause:
            field_groups[field_sql].append((clause, param))

    def _parse_filters(self, filters: list) -> tuple[list[str], list[Any]]:
        from collections import defaultdict

        field_groups = defaultdict(list)
        allowed_fields = {"level", "source_id", "cluster_id", "raw_text", "has_comment"}

        for f in filters:
            self._process_single_filter(f, allowed_fields, field_groups)

        where_clauses = []
        params = []
        for items in field_groups.values():
            if not items:
                continue
            clauses = [item[0] for item in items]
            field_params = [item[1] for item in items]

            if len(clauses) > 1:
                where_clauses.append("(" + " OR ".join(clauses) + ")")
            else:
                where_clauses.append(clauses[0])
            params.extend(field_params)

        return where_clauses, params

    def _build_filter_clause(self, field: str, op: str, value: Any) -> tuple[str | None, Any]:
        """Maps filter operators to SQL clauses and parameters."""
        mapping = {
            "contains": (f"{field} ILIKE ?", f"%{value}%"),
            "not_contains": (f"{field} NOT ILIKE ?", f"%{value}%"),
            "equals": (f"{field} ILIKE ?" if "source_id" in field else f"{field} = ?", value),
            "not_equals": (f"{field} != ?", value),
            "starts_with": (f"{field} ILIKE ?", f"{value}%"),
            "regex": (f"regexp_matches({field}, ?)", value),
        }
        return mapping.get(op, (None, None))

    def _normalize_query_timestamp(self, ts: str | None) -> str | None:
        if not ts:
            return None
        norm = ts.replace("T", " ").replace("Z", "")
        if "." in norm:
            parts = norm.split(".")
            ms_val = parts[1].ljust(3, "0")[:3]
            if ms_val == "000":
                return parts[0]
            return parts[0] + "." + ms_val
        return norm

    def _build_logs_where_clause(
        self,
        workspace_id: str,
        source_ids: list[str] | None = None,
        filters: Any | None = None,
        query: str | None = None,
        start_time: str | None = None,
        end_time: str | None = None,
    ) -> tuple[str | None, list[Any]]:
        """Constructs the WHERE clause and parameters for log queries."""
        where_clauses = ["l.workspace_id = ?"]
        params: list[Any] = [workspace_id]

        if source_ids is not None:
            if not source_ids:
                return None, []
            placeholders = ",".join(["?"] * len(source_ids))
            where_clauses.append(f"l.source_id IN ({placeholders})")
            params.extend(source_ids)

        if filters:
            dict_filters = [f.model_dump() if hasattr(f, "model_dump") else f for f in filters]
            f_clauses, f_params = self._parse_filters(dict_filters)
            where_clauses.extend(f_clauses)
            params.extend(f_params)

        if query:
            llql_sql, llql_params = parse_llql(query)
            where_clauses.append(f"({llql_sql})")
            params.extend(llql_params)

        if start_time:
            norm_start = self._normalize_query_timestamp(start_time)
            where_clauses.append("l.timestamp >= ?")
            params.append(norm_start)
        if end_time:
            norm_end = self._normalize_query_timestamp(end_time)
            where_clauses.append("l.timestamp <= ?")
            params.append(norm_end)

        return SQL_AND_JOIN.join(where_clauses), params

    def _hydrate_log(self, log_dict: dict) -> dict:
        """Fetch raw log content for a single log dictionary using the Fast-Path mmap service."""
        if log_dict.get("raw_text"):
            log_dict["message"] = log_dict["raw_text"]
            return log_dict

        source_id = log_dict.get("source_id")
        line_id = log_dict.get("line_id")

        if source_id and line_id is not None:
            content = self.fast_path.get_line(source_id, line_id)
            if content:
                log_dict["raw_text"] = content
                log_dict["message"] = content
            else:
                logger.warning("[Hydration] Failed for source=%s, line=%d", source_id, line_id)
                log_dict["raw_text"] = "<Missing log content>"
                log_dict["message"] = "<Missing log content>"
        else:
            # Fallback if no hydration is possible
            log_dict["raw_text"] = log_dict.get("raw_text", "")
            log_dict["message"] = log_dict.get("message", "")

        return log_dict

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
        """Unified internal log fetcher with temporal offset calibration."""
        cursor = self.db.get_cursor()
        where_sql, params = self._build_logs_where_clause(
            workspace_id, source_ids, filters, query, start_time, end_time
        )

        if where_sql is None:
            return {"total": 0, "logs": [], "offset": offset, "limit": limit}

        count_query = "SELECT COUNT(*) FROM logs l WHERE " + where_sql
        cursor.execute(count_query, params)
        row = cursor.fetchone()
        total = row[0] if row else 0

        # Use a CTE or join to get total_logs count for percent calculation safely
        base_query = f"""
            WITH workspace_total AS (
                SELECT count(*) as total_count FROM logs WHERE workspace_id = ?
            )
            SELECT
                l.*,
                c.count as _cluster_count,
                c.template as cluster_template,
                CAST(c.count AS FLOAT) * 100.0 / NULLIF(workspace_total.total_count, 0) as cluster_percent
            FROM logs l
            CROSS JOIN workspace_total
            LEFT JOIN clusters c ON l.workspace_id = c.workspace_id AND l.cluster_id = c.cluster_id
            WHERE {where_sql}
        """
        # params_for_data starts with workspace_id for the CTE
        params_for_data = [workspace_id, *params]

        allowed_sort = [
            "id",
            "timestamp",
            "ingest_timestamp",
            "level",
            "source_id",
            "cluster_id",
            "has_comment",
            "cluster_percent",
        ]

        # Whitelist sorting fields
        final_sort_by = sort_by if sort_by in allowed_sort else "id"
        if final_sort_by == "cluster_id":
            final_sort_by = "cluster_percent"

        final_sort_order = "ASC" if sort_order and sort_order.upper() == "ASC" else "DESC"

        # Column names cannot be parameterized in SQL, but we use a strict whitelist above.
        data_query = (
            base_query
            + f" ORDER BY {final_sort_by} {final_sort_order}, l.id {final_sort_order} LIMIT ? OFFSET ?"
        )
        cursor.execute(data_query, [*params_for_data, limit, offset])

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

            # --- Fast-Path Hydration ---
            self._hydrate_log(log_dict)
            logs.append(log_dict)

        self._apply_temporal_offsets(workspace_id, logs)

        return {"total": total, "logs": logs, "offset": offset, "limit": limit}

    def _build_distribution_where_clause(
        self, params: GetLogDistributionRequest
    ) -> tuple[str | None, list[Any]]:
        """Constructs the WHERE clause and parameters for log distribution queries."""
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
            if not effective_source_ids:
                return None, []
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
            llql_sql, llql_params = parse_llql(params.query)
            if llql_sql:
                where_clauses.append(f"({llql_sql})")
                sql_params.extend(llql_params)

        if params.start_time:
            norm_start = self._normalize_query_timestamp(params.start_time)
            where_clauses.append("timestamp >= ?")
            sql_params.append(norm_start)

        if params.end_time:
            norm_end = self._normalize_query_timestamp(params.end_time)
            where_clauses.append("timestamp <= ?")
            sql_params.append(norm_end)

        return SQL_AND_JOIN.join(where_clauses), sql_params

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
                    ms_part = ""
                    if "." in ts_str:
                        parts = ts_str.split(".")
                        ts_str = parts[0]
                        ms_part = "." + parts[1]
                    dt = datetime.strptime(ts_str[:19], "%Y-%m-%d %H:%M:%S")
                    dt = dt + timedelta(seconds=shift_sec)
                    log["timestamp"] = dt.strftime("%Y-%m-%d %H:%M:%S") + ms_part
                except Exception:
                    pass

    def method_get_time_boundaries(self, **kwargs) -> dict:
        """Find the min and max log timestamps for a workspace/source list."""
        params = GetTimeBoundariesRequest(**kwargs)
        cursor = self.db.get_cursor()

        where_clauses = ["workspace_id = ?"]
        sql_params = [params.workspace_id]

        if params.source_ids:
            placeholders = ",".join(["?"] * len(params.source_ids))
            where_clauses.append(f"source_id IN ({placeholders})")
            sql_params.extend(params.source_ids)

        where_sql = SQL_AND_JOIN.join(where_clauses)

        # Safeguard: Check if logs exist first to prevent DuckDB assertions on empty datasets
        cursor.execute(f"SELECT EXISTS(SELECT 1 FROM logs WHERE {where_sql})", sql_params)
        row = cursor.fetchone()
        exists = row[0] if row else False
        if not exists:
            return {"min_time": "", "max_time": ""}

        query = f"SELECT MIN(timestamp), MAX(timestamp) FROM logs WHERE {where_sql}"

        cursor.execute(query, sql_params)
        row = cursor.fetchone()

        min_time = row[0] if row and row[0] else ""
        max_time = row[1] if row and row[1] else ""

        return {"min_time": min_time, "max_time": max_time}

    def method_get_logs(self, **kwargs) -> dict:
        """Fetch logs normally for a workspace/source."""
        params = GetLogsRequest(**kwargs)
        return self._get_logs_internal(**params.model_dump())

    async def method_export_logs(self, **kwargs) -> dict:
        """
        Export matching logs to a file (CSV or JSON).
        """
        params = ExportLogsRequest(**kwargs)

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

        def write_to_file():
            if file_format == "csv":
                if not logs:
                    with open(filepath, "w", newline="", encoding="utf-8") as f:
                        f.write("")
                    return 0

                # Filter out internal fields starting with _
                keys = [k for k in logs[0] if not k.startswith("_")]

                with open(filepath, "w", newline="", encoding="utf-8") as f:
                    dict_writer = csv.DictWriter(f, fieldnames=keys, extrasaction="ignore")
                    dict_writer.writeheader()
                    dict_writer.writerows(logs)
                return len(logs)
            else:
                # For JSON, we can export everything
                with open(filepath, "w", encoding="utf-8") as f:
                    json.dump(logs, f, indent=2)
                return len(logs)

        count = await asyncio.to_thread(write_to_file)

        return {"status": "ok", "count": count}

    def _determine_distribution_bounds(
        self, cursor, params: GetLogDistributionRequest, where_sql: str, sql_params: list
    ) -> tuple[str | None, str | None, float]:
        start_ts = params.start_time
        end_ts = params.end_time

        if not start_ts or not end_ts:
            cursor.execute(
                f"SELECT MIN(timestamp), MAX(timestamp) FROM logs l WHERE {where_sql}", sql_params
            )
            db_row = cursor.fetchone()
            if db_row and db_row[0] and db_row[1]:
                if not start_ts:
                    start_ts = db_row[0]
                if not end_ts:
                    end_ts = db_row[1]

        duration_sec = 3600.0
        if start_ts and end_ts:
            try:
                s_str = start_ts.replace("T", " ").replace("Z", "")
                e_str = end_ts.replace("T", " ").replace("Z", "")
                dt_s = datetime.strptime(s_str[:19], "%Y-%m-%d %H:%M:%S")
                dt_e = datetime.strptime(e_str[:19], "%Y-%m-%d %H:%M:%S")
                duration_sec = max(1.0, (dt_e - dt_s).total_seconds())
            except Exception:
                pass
        return start_ts, end_ts, duration_sec

    def _build_distribution_slots(
        self, start_ts: str | None, end_ts: str | None, delta: timedelta, format_str: str
    ) -> list[str]:
        dt_start = _parse_ts(start_ts)
        dt_end = _parse_ts(end_ts)

        all_slots: list[str] = []
        if dt_start and dt_end and delta:
            current = _floor_to_bucket(dt_start, delta)
            while current <= dt_end and len(all_slots) < 500:
                slot_label = current.strftime(format_str)
                if len(slot_label) == 13:
                    slot_label += ":00"
                all_slots.append(slot_label)
                current += delta
        return all_slots

    def method_get_log_distribution(self, **kwargs) -> dict:
        """Fetch timeline distribution of logs aggregated by time bucket and level."""
        params = GetLogDistributionRequest(**kwargs)
        cursor = self.db.get_cursor()

        where_sql, sql_params = self._build_distribution_where_clause(params)
        if where_sql is None:
            return {"buckets": []}

        # Safeguard: Check if logs exist first to prevent DuckDB assertions on empty datasets
        cursor.execute(f"SELECT EXISTS(SELECT 1 FROM logs l WHERE {where_sql})", sql_params)
        row = cursor.fetchone()
        exists = row[0] if row else False
        if not exists:
            return {"buckets": []}

        # Determine duration of the timeframe to calculate optimal buckets
        start_ts, end_ts, duration_sec = self._determine_distribution_bounds(
            cursor, params, where_sql, sql_params
        )

        # Select bucket interval based on the duration to have ~15-60 columns
        interval_str = _determine_bucket_interval(duration_sec)
        delta, format_str = INTERVALS[interval_str]

        query = f"""
            SELECT
                strftime(time_bucket(INTERVAL '{interval_str}', CAST(timestamp AS TIMESTAMP)), '{format_str}') as time_bucket,
                level,
                COUNT(*) as count
            FROM logs l
            WHERE {where_sql}
            GROUP BY time_bucket, level
            ORDER BY time_bucket ASC
        """
        cursor.execute(query, sql_params)
        rows = cursor.fetchall()

        # Reshape DB results: {"bucket": "2023...", "INFO": 5, "ERROR": 2}
        db_buckets: dict[str, dict] = {}
        for row in rows:
            time_bucket_key = row[0]
            if len(time_bucket_key) == 13:
                time_bucket_key += ":00"  # Normalize "YYYY-MM-DD HH" → "YYYY-MM-DD HH:00"
            level = row[1]
            count = row[2]
            if time_bucket_key not in db_buckets:
                db_buckets[time_bucket_key] = {"bucket": time_bucket_key}
            db_buckets[time_bucket_key][level] = count

        # ── Kibana "extended_bounds" / "min_doc_count:0" equivalent ──────────
        empty_levels = {"DEBUG": 0, "INFO": 0, "WARN": 0, "ERROR": 0}
        all_slots = self._build_distribution_slots(start_ts, end_ts, delta, format_str)

        # Merge: start from fully-filled zero grid, overlay real DB data
        full_buckets: dict[str, dict] = {}
        for slot in all_slots:
            full_buckets[slot] = {"bucket": slot, **empty_levels}
        for key, data in db_buckets.items():
            if key in full_buckets:
                full_buckets[key].update(data)
            else:
                # DB key outside generated range (shouldn't normally happen)
                full_buckets[key] = {**empty_levels, **data}

        # If slot generation failed fall back to whatever the DB returned
        final_buckets = list(full_buckets.values()) if all_slots else list(db_buckets.values())
        # Ensure sorted by bucket label (ISO-format strings sort lexicographically)
        final_buckets.sort(key=lambda b: b.get("bucket", ""))

        return {"buckets": final_buckets, "bucket_interval": interval_str}

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
            "SELECT line_id FROM logs WHERE workspace_id = ? AND source_id = ? LIMIT ?",
            (workspace_id, source_id, limit),
        )
        line_ids = [row[0] for row in cursor.fetchall()]
        return [self.fast_path.get_line(source_id, lid) or "" for lid in line_ids]

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

    def method_get_log_content(self, **kwargs) -> dict:
        """Fetch raw log content for a list of line_ids (O(1) mmap)."""
        params = GetLogContentRequest(**kwargs)
        lines = self.fast_path.get_lines(params.source_id, params.line_ids)
        return {"lines": lines}

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

    def method_start_tail(
        self, filepath: str, workspace_id: str, source_id: str | None = None
    ) -> dict:
        # Normalize to forward slashes for consistent tracking
        abs_path = os.path.abspath(filepath).replace("\\", "/")
        # Use source_id as primary key if available, else fallback to path for legacy support
        key = source_id if source_id else f"{workspace_id}:{abs_path}"

        if key in self.tailers and self.tailers[key].running:
            return {"status": "already tailing"}

        tailer = FileTailer(
            abs_path, workspace_id, self.parser, self.db, self.log_store, source_id=source_id
        )
        self.tailers[key] = tailer
        tailer.start()

        return {"status": "started", "source_id": source_id}

    def method_start_ssh_tail(
        self,
        host: str,
        port: int = 22,
        username: str | None = None,
        password: str | None = None,
        filepath: str | None = None,
        workspace_id: str | None = None,
        source_id: str | None = None,
    ) -> dict:

        # Type narrowing to resolve type checker warnings
        eff_workspace_id = workspace_id or "default"
        eff_filepath = filepath or ""
        eff_source_id = source_id or f"ssh:{eff_workspace_id}:{host}:{eff_filepath}"

        key = eff_source_id
        if key in self.tailers:
            return {"status": "already tailing"}

        # 1. Start/Get the Shared Ingestor (SSHLoader)
        ingestor_key = f"ingestor:ssh:{eff_source_id}"
        if ingestor_key not in self.tailers:
            ingestor = SSHLoader(
                host,
                port,
                username,
                password,
                eff_filepath,
                self.log_store,
                source_id=eff_source_id,
            )
            self.tailers[ingestor_key] = ingestor
            ingestor.start()
            logger.info("[SSH] Started shared ingestor for source: %s", eff_source_id)

        # 2. Start the Workspace Subscriber (FileTailer)
        # Note: we pass filepath=None to SharedSource so it doesn't try local tailing
        subscriber = FileTailer(
            eff_filepath,
            eff_workspace_id,
            self.parser,
            self.db,
            self.log_store,
            source_id=eff_source_id,
        )
        self.tailers[key] = subscriber
        subscriber.start()

        return {"status": "started", "source_id": eff_source_id}

    def _stop_all_workspace_tailers(self, workspace_id: str) -> int:
        """Internal helper to stop all tailers for a workspace."""
        count = 0
        keys_to_remove = []
        for k, t in self.tailers.items():
            if k.startswith((f"{workspace_id}:", f"ssh:{workspace_id}:")):
                t.stop()
                keys_to_remove.append(k)
                count += 1
        for k in keys_to_remove:
            self.tailers.pop(k, None)
        return count

    def method_stop_tail(
        self, filepath: str, workspace_id: str, source_id: str | None = None
    ) -> dict:
        """Stop one or all live stream tailers for a workspace."""
        if filepath == "ALL":
            count = self._stop_all_workspace_tailers(workspace_id)
            return {"status": "stopped", "count": count}

        # Use source_id as primary key if available
        key = (
            source_id
            if source_id
            else f"{workspace_id}:{os.path.abspath(filepath).replace('\\', '/')}"
        )

        if key in self.tailers:
            self.tailers[key].stop()
            self.tailers.pop(key, None)
            return {"status": "stopped", "count": 1, "source_id": source_id}

        # Fallback for SSH or partial matches
        count_stopped = 0
        keys_to_remove = []
        for k, t in self.tailers.items():
            is_match = k.startswith((f"{workspace_id}:", f"ssh:{workspace_id}:")) and filepath in k
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

    def _get_global_rules(self, cursor) -> list:
        cursor.execute("SELECT value FROM settings WHERE key = 'facet_extractions'")
        gr = cursor.fetchone()
        if gr and gr[0]:
            try:
                parsed = json.loads(gr[0])
                return parsed if isinstance(parsed, list) else []
            except Exception:
                pass
        return []

    def _ingest_source_logs_batch(
        self,
        cursor,
        ws_id: str,
        src_id: str,
        src_logs: list[dict],
        rules_cache: dict,
        global_rules: list,
        now_ts: str,
    ):
        rules = self._get_facet_rules_for_workspace(cursor, ws_id, rules_cache, global_rules)

        cursor.execute(
            "SELECT parser_config, tz_offset FROM fusion_configs WHERE workspace_id = ? AND source_id = ?",
            (ws_id, src_id),
        )
        row = cursor.fetchone()
        p_config = json.loads(row[0]) if row and row[0] else {}
        p_tz = row[1] if row and row[1] else 0

        parser = self.get_drain_parser(ws_id)

        # 1. Disk-First: write raw lines
        raw_lines = [log.get("raw_text") or log.get("message") or "" for log in src_logs]
        line_ids = self.log_store.append_batch(src_id, raw_lines)

        # 2. Process Chunk in RAM
        batch_data, cluster_increments = self._process_chunk_ram_first(
            ws_id,
            src_id,
            line_ids,
            raw_lines,
            parser,
            rules,
            p_config,
            p_tz,
            now_ts,
            original_logs=src_logs,
        )
        # 3. Bulk Insert via PyArrow
        if batch_data:
            self._insert_arrow_batch(cursor, batch_data, cluster_increments)

        self.db.commit()

        # 4. Broadcast to active overlays
        try:
            shared_src = self.shared_manager.get_source(src_id)
            shared_src.push_batch(raw_lines, line_ids)
        except Exception as e:
            logger.error("[Ingestion] Broadcast failed for %s: %s", src_id, e)

    def method_ingest_logs(self, logs: list[Any]) -> dict:
        """High-speed synchronous batch ingestion — RAM-First / PyArrow.

        Designed for streaming data (HTTP/Syslog). Runs synchronously as it is
        expected to be called from a background flush worker.
        Does NOT create ingestion jobs.
        """
        log_dicts = [log.model_dump() if hasattr(log, "model_dump") else log for log in logs]

        if not log_dicts:
            return {"status": "ok", "count": 0}

        # --- Group by (workspace_id, source_id) ---
        grouped: dict[tuple[str, str], list[dict]] = defaultdict(list)
        for log in log_dicts:
            ws = log.get("workspace_id") or "default"
            src = log.get("source_id") or "manual"
            grouped[(ws, src)].append(log)

        now_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        cursor = self.db.get_cursor()
        global_rules = self._get_global_rules(cursor)
        rules_cache = {}

        for (ws_id, src_id), src_logs in grouped.items():
            try:
                self._ingest_source_logs_batch(
                    cursor, ws_id, src_id, src_logs, rules_cache, global_rules, now_ts
                )
                # Trigger anomaly detection for this workspace
                try:
                    self.anomaly_detector.detect_anomalies(ws_id)
                except Exception as e:
                    logger.error(f"[Anomalies] Failed to run anomaly detection post-streaming: {e}")
            except Exception as exc:
                logger.exception("[Ingestion] Stream batch failed: %s", exc)

        return {"status": "ok", "count": len(log_dicts)}

    def method_ingest_local_file(self, workspace_id: str, source_id: str, filepath: str) -> dict:
        """Optimised ingestion — Disk-First / Fast-Path.

        Now runs in a background thread to prevent blocking the UI.
        """
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"File not found: {filepath}")

        # 1. Count total lines for progress tracking (quick scan)
        total_lines = 0
        with open(filepath, encoding="utf-8", errors="replace") as f:
            for line in f:
                if line.strip():
                    total_lines += 1

        if total_lines == 0:
            return {"status": "ok", "count": 0, "job_id": None}

        # 2. Create ingestion job record
        job_id = self.db.create_ingestion_job(workspace_id, source_id, total_lines)

        # 3. Launch background ingestion
        thread = threading.Thread(
            target=self._bg_ingest_local_file,
            args=(workspace_id, source_id, filepath, job_id),
            daemon=True,
        )
        thread.start()

        return {"status": "ok", "job_id": job_id, "total_lines": total_lines}

    def _ingest_chunk(
        self,
        cursor,
        workspace_id: str,
        source_id: str,
        chunk_lines: list[str],
        parser,
        rules,
        p_config,
        p_tz,
        now_ts,
    ) -> int:
        line_ids = self.log_store.append_batch(source_id, chunk_lines)
        batch_data, cluster_increments = self._process_chunk_ram_first(
            workspace_id,
            source_id,
            line_ids,
            chunk_lines,
            parser,
            rules,
            p_config,
            p_tz,
            now_ts,
        )
        if batch_data:
            self._insert_arrow_batch(cursor, batch_data, cluster_increments)
        return len(chunk_lines)

    def _read_file_chunks(self, filepath: str, initial_chunk_size: int, max_chunk_size: int):
        """Generator that reads filepath and yields chunks of stripped non-empty lines."""
        current_chunk_size = initial_chunk_size
        with open(filepath, encoding="utf-8", errors="replace") as f:
            chunk_lines: list[str] = []
            for raw_line in f:
                clean = raw_line.strip()
                if clean:
                    chunk_lines.append(clean)
                    if len(chunk_lines) >= current_chunk_size:
                        yield chunk_lines
                        chunk_lines = []
                        current_chunk_size = min(max_chunk_size, current_chunk_size * 2)
            if chunk_lines:
                yield chunk_lines

    def _bg_ingest_local_file(self, workspace_id: str, source_id: str, filepath: str, job_id: int):
        """Background worker for local file ingestion.

        RAM-First Bulk-Insert Pipeline (PyArrow Optimized):
        1. Read chunk
        2. Write FastPath
        3. Train & Tag Drain3 in RAM (Single Thread)
        4. Bulk Insert processed rows via PyArrow
        """
        initial_chunk_size = 5000
        max_chunk_size = 10000
        commit_interval = 10000

        processed_count = 0
        uncommitted_count = 0
        now_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        try:
            db_instance = self.db
            cursor = db_instance.get_cursor()

            # Pre-fetch rules and configs
            global_rules = self._get_global_rules(cursor)
            rules_cache = {}
            rules = self._get_facet_rules_for_workspace(
                cursor, workspace_id, rules_cache, global_rules
            )

            cursor.execute(
                "SELECT parser_config, tz_offset FROM fusion_configs WHERE workspace_id = ? AND source_id = ?",
                (workspace_id, source_id),
            )
            row = cursor.fetchone()
            p_config = json.loads(row[0]) if row and row[0] else {}
            p_tz = row[1] if row and row[1] else 0

            parser = self.get_drain_parser(workspace_id)

            for chunk_lines in self._read_file_chunks(filepath, initial_chunk_size, max_chunk_size):
                n = self._ingest_chunk(
                    cursor,
                    workspace_id,
                    source_id,
                    chunk_lines,
                    parser,
                    rules,
                    p_config,
                    p_tz,
                    now_ts,
                )
                processed_count += n
                uncommitted_count += n

                if uncommitted_count >= commit_interval:
                    cursor.execute(
                        "UPDATE ingestion_jobs SET processed_lines = ?, status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                        (processed_count, job_id),
                    )
                    db_instance.commit()
                    uncommitted_count = 0

            # Mark job completed
            cursor.execute(
                "UPDATE ingestion_jobs SET status = 'completed', processed_lines = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (processed_count, job_id),
            )
            db_instance.commit()

            # Trigger event-driven anomaly detection on ingestion complete
            try:
                self.anomaly_detector.detect_anomalies(workspace_id)
            except Exception as e:
                logger.error(f"[Anomalies] Failed to run anomaly detection post-ingestion: {e}")

            logger.info(
                "[Ingestion] Completed background job %d for %s: %d lines",
                job_id,
                workspace_id,
                processed_count,
            )

        except Exception as exc:
            logger.exception("[Ingestion] Failed background job %d: %s", job_id, exc)
            try:
                cursor = self.db.get_cursor()
                cursor.execute(
                    "UPDATE ingestion_jobs SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (job_id,),
                )
                self.db.commit()
            except Exception:
                pass

    def _train_chunk_sample(
        self,
        workspace_id: str,
        source_id: str,
        train_lines: list[str],
        train_ids: list[int],
        parser,
        rules,
        p_config,
        p_tz,
        now_ts,
        original_logs,
        cluster_increments,
        batch_data,
    ):
        for i, raw_text in enumerate(train_lines):
            meta = extract_log_metadata(
                raw_text, custom_rules=rules, parser_config=p_config, tz_offset=p_tz
            )
            res = parser.parse(meta["message"])
            cluster_id, template = res["cluster_id"], res["template"]

            if "facets" in res:
                meta["facets"].update(res["facets"])

            key = (workspace_id, cluster_id, template)
            cluster_increments[key] = cluster_increments.get(key, 0) + 1

            og_log = original_logs[i] if original_logs else {}
            ts = og_log.get("timestamp") or meta["timestamp"] or now_ts
            ingest_ts = og_log.get("ingest_timestamp") or meta["ingest_timestamp"] or now_ts
            lvl = og_log.get("level") or meta["level"] or "INFO"

            og_facets = og_log.get("facets") or {}
            meta["facets"].update(og_facets)

            batch_data.append(
                (
                    workspace_id,
                    source_id,
                    train_ids[i],
                    raw_text,
                    ts,
                    ingest_ts,
                    lvl,
                    cluster_id,
                    json.dumps(meta["facets"]),
                    True,
                )
            )

    def _extract_match_parameters(self, parser, template: str, message: str, facets: dict):
        try:
            params = parser.miner.extract_parameters(template, message, exact_matching=False)
            if not params:
                return
            for p in params:
                mask_key = p.mask_name.strip("<>").lower()
                if mask_key != "*":
                    facets[mask_key] = p.value
        except Exception:
            pass

    def _tag_single_remaining_line(
        self,
        workspace_id: str,
        source_id: str,
        line_id: int,
        raw_text: str,
        parser,
        rules,
        p_config,
        p_tz,
        now_ts,
        og_log: dict,
        cluster_increments: dict,
    ) -> tuple:
        meta = extract_log_metadata(
            raw_text, custom_rules=rules, parser_config=p_config, tz_offset=p_tz
        )
        match = parser.match(meta["message"])

        cluster_id = None
        template = None

        if match:
            cluster_id = str(match["cluster_id"])
            template = match["template"]

            self._extract_match_parameters(parser, template, meta["message"], meta["facets"])

            key = (workspace_id, cluster_id, template)
            cluster_increments[key] = cluster_increments.get(key, 0) + 1

        ts = og_log.get("timestamp") or meta["timestamp"] or now_ts
        ingest_ts = og_log.get("ingest_timestamp") or meta["ingest_timestamp"] or now_ts
        lvl = og_log.get("level") or meta["level"] or "INFO"

        og_facets = og_log.get("facets") or {}
        meta["facets"].update(og_facets)

        return (
            workspace_id,
            source_id,
            line_id,
            raw_text,
            ts,
            ingest_ts,
            lvl,
            cluster_id,
            json.dumps(meta["facets"]),
            True,
        )

    def _tag_chunk_remaining(
        self,
        workspace_id: str,
        source_id: str,
        tag_lines: list[str],
        tag_ids: list[int],
        parser,
        rules,
        p_config,
        p_tz,
        now_ts,
        original_logs,
        cluster_increments,
        batch_data,
        train_sample_size: int,
    ):
        for i, raw_text in enumerate(tag_lines):
            og_log = original_logs[train_sample_size + i] if original_logs else {}
            item = self._tag_single_remaining_line(
                workspace_id,
                source_id,
                tag_ids[i],
                raw_text,
                parser,
                rules,
                p_config,
                p_tz,
                now_ts,
                og_log,
                cluster_increments,
            )
            batch_data.append(item)

    def _process_chunk_ram_first(
        self,
        workspace_id: str,
        source_id: str,
        line_ids: list[int],
        chunk_lines: list[str],
        parser,
        rules,
        p_config,
        p_tz,
        now_ts,
        original_logs=None,
    ):
        train_sample_size = 200
        cluster_increments = {}
        batch_data = []

        train_lines = chunk_lines[:train_sample_size]
        train_ids = line_ids[:train_sample_size]

        tag_lines = chunk_lines[train_sample_size:]
        tag_ids = line_ids[train_sample_size:]

        # Phase 1: Train on sample
        self._train_chunk_sample(
            workspace_id,
            source_id,
            train_lines,
            train_ids,
            parser,
            rules,
            p_config,
            p_tz,
            now_ts,
            original_logs,
            cluster_increments,
            batch_data,
        )

        # Phase 2: Tag remaining sequentially
        if tag_lines:
            self._tag_chunk_remaining(
                workspace_id,
                source_id,
                tag_lines,
                tag_ids,
                parser,
                rules,
                p_config,
                p_tz,
                now_ts,
                original_logs,
                cluster_increments,
                batch_data,
                train_sample_size,
            )

        return batch_data, cluster_increments

    def _insert_arrow_batch(self, cursor, batch_data, cluster_increments):
        cursor.execute("BEGIN TRANSACTION")

        # PyArrow logs table
        cols = list(zip(*batch_data, strict=False))
        arrow_logs = pa.Table.from_arrays(  # noqa: F841
            [pa.array(c) for c in cols],
            names=[
                "workspace_id",
                "source_id",
                "line_id",
                "raw_text",
                "timestamp",
                "ingest_timestamp",
                "level",
                "cluster_id",
                "facets",
                "processed",
            ],
        )
        _ = arrow_logs

        cursor.execute(
            "INSERT INTO logs (workspace_id, source_id, line_id, raw_text, timestamp, ingest_timestamp, level, cluster_id, facets, processed) SELECT * FROM arrow_logs"
        )

        # PyArrow clusters table
        cluster_data = [(w, c, t, count) for (w, c, t), count in cluster_increments.items()]
        if cluster_data:
            c_cols = list(zip(*cluster_data, strict=False))
            arrow_clusters = pa.Table.from_arrays(  # noqa: F841
                [pa.array(c) for c in c_cols],
                names=["workspace_id", "cluster_id", "template", "count"],
            )
            _ = arrow_clusters
            cursor.execute("CREATE TEMP TABLE temp_clusters AS SELECT * FROM arrow_clusters")
            cursor.execute("""
                INSERT INTO clusters (workspace_id, cluster_id, template, count)
                SELECT workspace_id, cluster_id, template, count FROM temp_clusters
                ON CONFLICT (workspace_id, cluster_id)
                DO UPDATE SET count = clusters.count + excluded.count, template = excluded.template
            """)
            cursor.execute("DROP TABLE temp_clusters")

        cursor.execute("COMMIT")

    def method_cleanup_ingestion_jobs(self, workspace_id: str) -> dict:
        """Removes stalled ingestion jobs with no progress."""
        cursor = self.db.get_cursor()
        # Delete jobs that are 'pending' but have 0 processed lines and are older than 30 mins
        # Or jobs that are explicitly marked 'failed'
        cursor.execute(
            "DELETE FROM ingestion_jobs WHERE workspace_id = ? AND processed_lines = 0 AND (status = 'failed' OR created_at < ?)",
            (workspace_id, (datetime.now() - timedelta(minutes=30)).strftime("%Y-%m-%d %H:%M:%S")),
        )
        count = cursor.rowcount
        self.db.commit()
        logger.info("[Cleanup] Purged %d stalled ingestion jobs for %s", count, workspace_id)
        return {"status": "success", "purged_count": count}

    def method_get_metadata_facets(self, **kwargs) -> dict:
        """Return the top unique metadata facets across all logs in a workspace."""
        params = GetMetadataFacetsRequest(**kwargs)
        return self.db.get_metadata_facets(params.workspace_id, params.source_ids)

    def method_get_sample_logs(
        self, workspace_id: str, limit: int = 10, source_id: str | None = None
    ) -> dict:
        """Return random raw log lines from the beginning for column preview in the Add Column modal."""
        cursor = self.db.get_cursor()
        if source_id:
            cursor.execute(
                """SELECT raw_text FROM (
                       SELECT raw_text, id FROM logs
                       WHERE workspace_id = ? AND source_id = ? AND raw_text IS NOT NULL
                       ORDER BY id ASC LIMIT 200
                   )
                   ORDER BY RANDOM() LIMIT ?""",
                (workspace_id, source_id, max(1, min(limit, 50))),
            )
        else:
            cursor.execute(
                """SELECT raw_text FROM (
                       SELECT raw_text, id FROM logs
                       WHERE workspace_id = ? AND raw_text IS NOT NULL
                       ORDER BY id ASC LIMIT 200
                   )
                   ORDER BY RANDOM() LIMIT ?""",
                (workspace_id, max(1, min(limit, 50))),
            )
        rows = cursor.fetchall()
        return {"samples": [r[0] for r in rows if r[0]]}

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
        """Return the distinct source_id values present in a workspace's log table."""
        cursor = self.db.get_cursor()
        cursor.execute(
            "SELECT DISTINCT source_id FROM logs WHERE workspace_id = ?", (workspace_id,)
        )
        # Merge with log_sources table if available
        existing_sources = [r[0] for r in cursor.fetchall()]

        cursor.execute("SELECT path FROM log_sources WHERE workspace_id = ?", (workspace_id,))
        managed_sources = [r[0] for r in cursor.fetchall()]

        return sorted(set(existing_sources + managed_sources))

    # --- Hierarchy Methods ---

    def method_get_hierarchy(self, workspace_id: str) -> dict:
        return self.db.get_hierarchy(workspace_id)

    def method_create_folder(
        self, workspace_id: str, name: str, parent_id: str | None = None
    ) -> dict:
        folder_id = str(uuid.uuid4())
        self.db.create_folder(workspace_id, folder_id, name, parent_id)
        return {"status": "success", "folder_id": folder_id}

    def method_update_folder(
        self, folder_id: str, name: str | None = None, parent_id: str | None = None
    ) -> dict:
        self.db.update_folder(folder_id, name, parent_id)
        return {"status": "success"}

    def method_delete_folder(self, folder_id: str) -> dict:
        self.db.delete_folder(folder_id)
        return {"status": "success"}

    def method_create_log_source(
        self,
        workspace_id: str,
        name: str,
        type: str,
        path: str,
        folder_id: str | None = None,
    ) -> dict:
        source_id = str(uuid.uuid4())
        self.db.upsert_log_source(workspace_id, source_id, name, type, path, folder_id)
        return {"status": "success", "source_id": source_id}

    def method_update_log_source(self, source_id: str, **kwargs) -> dict:
        self.db.update_log_source(source_id, **kwargs)
        return {"status": "success"}

    def method_delete_log_source(self, source_id: str) -> dict:
        self.db.delete_log_source(source_id)
        if hasattr(self, "log_store"):
            try:
                self.log_store.delete_source_files(source_id)
            except Exception as e:
                logger.error("Error deleting physical files for source %s: %s", source_id, e)
        return {"status": "success"}

    def method_move_source(self, source_id: str, folder_id: str | None = None) -> dict:
        self.db.update_log_source(source_id, folder_id=folder_id)
        return {"status": "success"}

    def method_is_tailing(self, filepath: str, workspace_id: str) -> bool:
        abs_path = os.path.abspath(filepath).replace("\\", "/")
        key = f"{workspace_id}:{abs_path}"
        return key in self.tailers and self.tailers[key].running

    def method_get_clusters(self, workspace_id: str) -> list:
        clusters = self.get_drain_parser(workspace_id).get_clusters()
        return [
            {"id": c.cluster_id, "template": c.get_template(), "size": c.size} for c in clusters
        ]

    async def method_analyze_cluster(self, **kwargs) -> dict:
        params = AnalyzeClusterRequest(**kwargs)
        cursor = self.db.get_cursor()

        cursor.execute(
            "SELECT source_id, line_id FROM logs WHERE workspace_id = ? AND cluster_id = ? LIMIT ?",
            (params.workspace_id, params.cluster_id, params.sample_size),
        )
        rows = cursor.fetchall()
        samples = []
        for row in rows:
            content = self.fast_path.get_line(row[0], row[1])
            if content:
                samples.append(content)

        clusters = self.parser.get_clusters()
        template = ""
        for c in clusters:
            if str(c.cluster_id) == params.cluster_id:
                template = c.get_template()
                break

        return await self.ai.analyze_logs(template, samples)

    async def method_list_ai_models(self) -> list[str]:
        """Fetch models available for the current AI provider."""
        return await self.ai.list_models()

    async def method_test_ai_connection(self, **kwargs) -> dict:
        """Verify credentials and connectivity for the current AI provider."""
        _ = TestAiConnectionRequest(**kwargs)
        return await self.ai.test_connection()

    def _prepare_ai_session(
        self, params: SendAiMessageRequest
    ) -> tuple[str, str | None, list[AIChatMessage]]:
        cursor = self.db.get_cursor()

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
            query = f"SELECT id, timestamp, level, source_id, line_id, cluster_id FROM logs WHERE id IN ({placeholders})"
            cursor.execute(query, params.context_logs)
            columns = [desc[0] for desc in cursor.description]
            raw_logs = [dict(zip(columns, row, strict=False)) for row in cursor.fetchall()]

            # Hydrate logs with actual text from Fast-Path
            logs = [self._hydrate_log(log) for log in raw_logs]

            if logs:
                summary = self.context_manager.prepare_log_context(logs)
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

        # Column names are whitelisted to prevent injection
        allowed_cols = {"last_modified", "provider_session_id"}
        fields = [k for k in updates if k in allowed_cols]
        update_clause = ", ".join([f"{f} = ?" for f in fields])
        params = [updates[f] for f in fields] + [session_id]

        cursor.execute(
            f"UPDATE ai_sessions SET {update_clause} WHERE session_id = ?",
            params,
        )

        self.db.commit()
        self._sync_ai_sessions_to_json()

    async def method_send_ai_message(self, **kwargs) -> dict:
        """Handle multi-turn AI chat investigation session with log context."""
        params = SendAiMessageRequest(**kwargs)
        session_id, provider_session_id, history = self._prepare_ai_session(params)

        # 4. Call Hybrid Runner for mission-based investigation
        full_response = ""
        async for chunk in self.hybrid_runner.run_investigation(
            workspace_id=params.workspace_id,
            session_id=session_id,
            user_message=params.message,
            history=[{"role": m.role, "content": m.content} for m in history[:-1]],
            model=params.model,
            reasoning=params.reasoning,
        ):
            full_response += chunk

        # 5. Extract A2UI if present (simple check for non-streaming mode)
        a2ui_payload = None
        if A2UI_START in full_response:
            try:
                parts = full_response.split(A2UI_START)
                json_str = parts[1].split(A2UI_END)[0]
                a2ui_payload = json.loads(json_str)
            except Exception:
                pass

        # 6. Record Assistant Message
        self._finalize_ai_session(session_id, full_response, provider_session_id, a2ui_payload)

        return {"session_id": session_id, "response": full_response}

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
        """Save a learned resolution to the workspace memory via LanceDB."""
        return self.rag_service.save_memory(workspace_id, issue_signature, resolution)

    def method_search_memory(self, workspace_id: str, query: str, limit: int = 5) -> list:
        """Search the workspace memory for an issue signature or resolution via LanceDB."""
        return self.rag_service.search_memory(workspace_id, query, limit)

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

        # 1. Update persistent settings
        self._persist_settings(cursor, settings, workspace_id)

        # 2. Re-initialize AI Provider if relevant settings changed
        self._check_ai_provider_reload(settings, workspace_id)

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
            http_port = int(current_settings.get("ingestion_http_port", "5001"))
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

    def get_drain_parser(self, workspace_id: str | None = None) -> DrainParser:
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

        data_dir = os.path.join(PROJECT_ROOT, "data", "drain")
        os.makedirs(data_dir, exist_ok=True)

        if scope == "global" or not workspace_id:
            key = "__global__"
            path = os.path.join(data_dir, "global.state")
        else:
            key = workspace_id
            path = os.path.join(data_dir, f"workspace_{workspace_id}.state")

        if key not in self._parsers:
            self._parsers[key] = DrainParser(
                persistence_path=path,
                sim_th=sim_th,
                max_children=max_children,
                max_clusters=max_clusters,
                masking_instructions=masking_instructions,
            )
        return self._parsers[key]

    def method_reset_templates(self, workspace_id: str | None = None) -> dict:
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
            logger.debug(
                "RPC Response [%s]: %s",
                req.method,
                json.dumps(resp_data, default=_json_default)[:100],
            )
            # Use custom encoder to handle any datetime objects in the response
            return web.Response(
                text=json.dumps(resp_data, default=_json_default),
                content_type="application/json",
            )
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

            extracted_a2ui = None
            full_text = []

            async for chunk in self.hybrid_runner.run_investigation(
                workspace_id=params.workspace_id,
                session_id=session_id,
                user_message=params.message,
                history=[{"role": m.role, "content": m.content} for m in history[:-1]],
                model=params.model,
                reasoning=params.reasoning,
            ):
                full_text.append(chunk)
                await response.write(f"data: {json.dumps({'chunk': chunk})}\n\n".encode())

            final_text = "".join(full_text)
            # Last resort extraction if stream failed to catch it
            if not extracted_a2ui:
                extracted_a2ui = self._extract_a2ui_payload(final_text)

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
            logger.error("AI Stream Error: %s", str(e))
            traceback.print_exc()
            await response.write(f"data: {json.dumps({'error': str(e)})}\n\n".encode())
            return response

    async def method_generate_facet_regex(
        self, log_line: str, selected_text: str, **_kwargs
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
            return {"regex": f"({re.escape(selected_text)})"}

    def method_get_health(self) -> dict:
        """Fetch sidecar internal health and status metrics."""
        cursor = self.db.get_cursor()

        # 1. DB Stats
        cursor.execute("SELECT COUNT(*) FROM logs")
        row1 = cursor.fetchone()
        total_logs = row1[0] if row1 else 0

        cursor.execute("SELECT COUNT(*) FROM clusters")
        row2 = cursor.fetchone()
        total_clusters = row2[0] if row2 else 0

        # 2. Tailer Stats
        active_tailers = [k for k, t in self.tailers.items() if t.running]

        # 3. Uptime calculation
        uptime_sec = 0
        if hasattr(self, "_start_time"):
            uptime_sec = int(time.time() - self._start_time)

        return {
            "status": "ok",
            "uptime": uptime_sec,
            "database": {"logs": total_logs, "clusters": total_clusters},
            "active_tailers": len(active_tailers),
            "tailer_keys": active_tailers,
            "hydration": {
                "misses": self.fast_path.hydrate_misses,
                "quarantine_size": getattr(self.clustering_worker, "_quarantine", {}).__len__(),
            },
            "workers": {
                "clustering": self.clustering_worker.running,
                "ingestion": self.ingestion_server.running
                if hasattr(self.ingestion_server, "running")
                else True,
            },
        }

    def _prepare_dashboard_where(
        self,
        workspace_id: str | None = None,
        source_id: str | None = None,
        start_time: str | None = None,
        end_time: str | None = None,
        active_workspace_ids: list[str] | None = None,
    ) -> tuple[str, list[Any], str | None]:
        """Helper to build WHERE clause for dashboard stats."""
        where_clauses = []
        params = []
        norm_start = None
        if workspace_id:
            where_clauses.append("l.workspace_id = ?")
            params.append(workspace_id)
        if source_id:
            where_clauses.append("l.source_id = ?")
            params.append(source_id)
        if start_time:
            norm_start = self._normalize_query_timestamp(start_time)
            where_clauses.append("l.timestamp >= ?")
            params.append(norm_start)
        if end_time:
            norm_end = self._normalize_query_timestamp(end_time)
            where_clauses.append("l.timestamp <= ?")
            params.append(norm_end)
        if active_workspace_ids:
            placeholders = ", ".join(["?"] * len(active_workspace_ids))
            where_clauses.append(f"l.workspace_id IN ({placeholders})")
            params.extend(active_workspace_ids)

        where_sql = " WHERE " + SQL_AND_JOIN.join(where_clauses) if where_clauses else ""
        return where_sql, params, norm_start

    def _get_dashboard_bucket_params(
        self, cursor, where_sql: str, params: list
    ) -> tuple[str, str, str | None, str | None]:
        bucket_interval_str = "1 hour"
        bucket_format = "%Y-%m-%d %H:00:00"
        ts_min_time = None
        ts_max_time = None
        try:
            cursor.execute(
                "SELECT MIN(l.timestamp), MAX(l.timestamp) FROM logs l" + where_sql,
                params,
            )
            min_ts_row, max_ts_row = cursor.fetchone()
            if min_ts_row and max_ts_row:
                ts_min_time = str(min_ts_row)
                ts_max_time = str(max_ts_row)
                try:
                    _s = ts_min_time.replace("T", " ").replace("Z", "")[:19]
                    _e = ts_max_time.replace("T", " ").replace("Z", "")[:19]
                    min_dt_ts = datetime.strptime(_s, "%Y-%m-%d %H:%M:%S")
                    max_dt_ts = datetime.strptime(_e, "%Y-%m-%d %H:%M:%S")
                    seconds_span = max((max_dt_ts - min_dt_ts).total_seconds(), 1.0)
                    bucket_interval_str = _determine_bucket_interval(seconds_span)
                    _, bucket_format = INTERVALS[bucket_interval_str]
                except Exception:
                    pass
        except Exception as e:
            logger.error("Failed to calculate dynamic time bucket size: %s", e)
        return bucket_interval_str, bucket_format, ts_min_time, ts_max_time

    def _build_dashboard_filled_slots(
        self,
        start_time: str | None,
        end_time: str | None,
        ts_min_time: str | None,
        ts_max_time: str | None,
        bucket_interval_str: str,
        bucket_format: str,
    ) -> list[str]:
        delta_dash, _ = INTERVALS.get(bucket_interval_str, (timedelta(hours=1), "%Y-%m-%d %H:00"))
        filled_slots: list[str] = []

        _ts_min = start_time or ts_min_time
        _ts_max = end_time or ts_max_time

        if _ts_min and _ts_max:
            try:
                _s2 = _ts_min.replace("T", " ").replace("Z", "")[:19]
                _e2 = _ts_max.replace("T", " ").replace("Z", "")[:19]
                cur_dt = datetime.strptime(_s2, "%Y-%m-%d %H:%M:%S")
                end_dt = datetime.strptime(_e2, "%Y-%m-%d %H:%M:%S")
                # Align to epoch-anchored bucket boundary (matches DuckDB time_bucket)
                _epoch_dash = datetime(1970, 1, 1)
                _ivl_secs_dash = delta_dash.total_seconds()
                if _ivl_secs_dash > 0:
                    _elapsed = (cur_dt - _epoch_dash).total_seconds()
                    cur_dt = _epoch_dash + timedelta(
                        seconds=(_elapsed // _ivl_secs_dash) * _ivl_secs_dash
                    )
                while cur_dt <= end_dt and len(filled_slots) < 500:
                    slot = cur_dt.strftime(bucket_format)
                    if len(slot) == 13:
                        slot += ":00"
                    filled_slots.append(slot)
                    cur_dt += delta_dash
            except Exception:
                pass
        return filled_slots

    def _build_dashboard_time_series(
        self,
        ts_raw: list[tuple],
        start_time: str | None,
        end_time: str | None,
        ts_min_time: str | None,
        ts_max_time: str | None,
        bucket_interval_str: str,
        bucket_format: str,
    ) -> list[dict]:
        # Build pivot from DB results
        ts_pivot: dict[str, dict] = {}
        for bucket_val, level, count in ts_raw:
            bucket_key = str(bucket_val) if bucket_val is not None else ""
            if len(bucket_key) == 13:
                bucket_key += ":00"
            if bucket_key not in ts_pivot:
                ts_pivot[bucket_key] = {"timestamp": bucket_key}
            ts_pivot[bucket_key][str(level) if level else "UNKNOWN"] = count

        empty_ts_levels = {"DEBUG": 0, "INFO": 0, "WARN": 0, "ERROR": 0}
        filled_slots = self._build_dashboard_filled_slots(
            start_time, end_time, ts_min_time, ts_max_time, bucket_interval_str, bucket_format
        )

        full_ts: dict[str, dict] = {}
        for slot in filled_slots:
            full_ts[slot] = {"timestamp": slot, **empty_ts_levels}
        for key, data in ts_pivot.items():
            if key in full_ts:
                full_ts[key].update(data)
            else:
                full_ts[key] = {**{"timestamp": key}, **empty_ts_levels, **data}

        time_series = list(full_ts.values()) if filled_slots else list(ts_pivot.values())
        time_series.sort(key=lambda b: b.get("timestamp", ""))
        return time_series

    def _fetch_top_error_clusters(self, where_sql: str, params: list) -> list[dict]:
        cursor = self.db.get_cursor()
        error_where = (
            f"{where_sql} AND l.level IN ('ERROR', 'FATAL', 'CRITICAL') AND l.cluster_id IS NOT NULL"
            if where_sql
            else " WHERE l.level IN ('ERROR', 'FATAL', 'CRITICAL') AND l.cluster_id IS NOT NULL"
        )
        error_cluster_query = (
            "SELECT COALESCE(c.template, 'Pattern ' || l.cluster_id) as template, COUNT(*) as count, l.cluster_id "
            "FROM logs l LEFT JOIN clusters c ON l.workspace_id = c.workspace_id AND l.cluster_id = c.cluster_id "
            + error_where
            + " GROUP BY template, l.cluster_id ORDER BY count DESC LIMIT 5"
        )
        cursor.execute(error_cluster_query, params)
        return [
            {"template": row[0], "count": row[1], "cluster_id": str(row[2])}
            for row in cursor.fetchall()
        ]

    def _fetch_pattern_drift(self, start_time: str | None, norm_start: str | None) -> int:
        cursor = self.db.get_cursor()
        new_patterns_count = 0
        try:
            cursor.execute(
                "SELECT count(*) FROM information_schema.columns WHERE table_name = 'clusters' AND column_name = 'created_at'"
            )
            if cursor.fetchone()[0] > 0:
                drift_where = " WHERE created_at >= ?" if start_time else ""
                drift_params = [norm_start] if start_time else []
                q8 = f"SELECT COUNT(*) FROM clusters{drift_where}"
                cursor.execute(q8, drift_params)
                new_patterns_count = cursor.fetchone()[0]
        except Exception:
            pass
        return new_patterns_count

    def _fetch_source_heatmap(self, where_sql: str, params: list, bucket_format: str) -> list[dict]:
        cursor = self.db.get_cursor()
        source_heatmap = []
        try:
            sh_query = (
                f"SELECT strftime('{bucket_format}', TRY_CAST(l.timestamp AS TIMESTAMP)) as bucket, l.source_id, s.name as source_name, COUNT(*) as count "
                "FROM logs l LEFT JOIN log_sources s ON l.source_id = s.id "
                + where_sql
                + " GROUP BY bucket, l.source_id, s.name ORDER BY bucket ASC"
            )
            cursor.execute(sh_query, params)
            source_heatmap = [
                {"timestamp": r[0], "source_id": r[1], "source_name": r[2], "count": r[3]}
                for r in cursor.fetchall()
            ]
        except Exception:
            pass
        return source_heatmap

    def _fetch_latest_insight(self, workspace_id: str | None) -> str | None:
        cursor = self.db.get_cursor()
        latest_insight = None
        try:
            insight_query = """
                SELECT m.content
                FROM ai_messages m
                JOIN ai_sessions s ON m.session_id = s.session_id
                WHERE m.role = 'assistant'
            """
            insight_params = []
            if workspace_id:
                insight_query += " AND s.workspace_id = ?"
                insight_params.append(workspace_id)

            insight_query += " ORDER BY m.timestamp DESC LIMIT 1"
            cursor.execute(insight_query, insight_params)
            row = cursor.fetchone()
            if row:
                content = row[0].strip()
                clean_content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
                latest_insight = (
                    (clean_content[:150] + "...") if len(clean_content) > 150 else clean_content
                )
        except Exception:
            pass
        return latest_insight

    def _fetch_total_logs(self, where_sql: str, params: list) -> int:
        cur = self.db.get_cursor()
        q = "SELECT COUNT(*) FROM logs l" + where_sql
        cur.execute(q, params)
        row = cur.fetchone()
        return row[0] if row else 0

    def _fetch_level_counts(self, where_sql: str, params: list) -> dict:
        cur = self.db.get_cursor()
        q = "SELECT l.level, COUNT(*) FROM logs l" + where_sql + " GROUP BY l.level"
        cur.execute(q, params)
        return {row[0]: row[1] for row in cur.fetchall()}

    def _fetch_total_clusters(self, where_sql: str, params: list) -> int:
        cur = self.db.get_cursor()
        q = "SELECT COUNT(DISTINCT l.cluster_id) FROM logs l" + where_sql
        cur.execute(q, params)
        row = cur.fetchone()
        return row[0] if row else 0

    def _fetch_top_clusters(self, where_sql: str, params: list) -> list[dict]:
        cur = self.db.get_cursor()
        cluster_where = (
            f"{where_sql} AND l.cluster_id IS NOT NULL"
            if where_sql
            else " WHERE l.cluster_id IS NOT NULL"
        )
        cluster_query = (
            "SELECT COALESCE(c.template, 'Pattern ' || l.cluster_id) as template, COUNT(*) as count, l.cluster_id "
            "FROM logs l LEFT JOIN clusters c ON l.workspace_id = c.workspace_id AND l.cluster_id = c.cluster_id "
            + cluster_where
            + " GROUP BY template, l.cluster_id ORDER BY count DESC LIMIT 10"
        )
        cur.execute(cluster_query, params)
        return [
            {"template": row[0], "count": row[1], "cluster_id": str(row[2])}
            for row in cur.fetchall()
        ]

    def _fetch_workspace_count(self, active_workspace_ids: list[str] | None) -> int:
        cur = self.db.get_cursor()
        if active_workspace_ids:
            placeholders = ", ".join(["?"] * len(active_workspace_ids))
            q = f"SELECT COUNT(DISTINCT workspace_id) FROM logs WHERE workspace_id IN ({placeholders})"
            cur.execute(q, active_workspace_ids)
        else:
            cur.execute("SELECT COUNT(DISTINCT workspace_id) FROM logs")
        row = cur.fetchone()
        return row[0] if row else 0

    def _fetch_time_series(
        self,
        bucket_interval_str: str,
        bucket_format: str,
        where_sql: str,
        params: list,
        start_time: str | None,
        end_time: str | None,
        ts_min_time: str | None,
        ts_max_time: str | None,
    ) -> list[dict]:
        cur = self.db.get_cursor()
        ts_null_guard = "l.timestamp IS NOT NULL"
        ts_where = (
            (where_sql + " AND " + ts_null_guard) if where_sql else (" WHERE " + ts_null_guard)
        )
        ts_query = (
            f"SELECT strftime(time_bucket(INTERVAL '{bucket_interval_str}', CAST(l.timestamp AS TIMESTAMP)), '{bucket_format}') as bucket, l.level, COUNT(*) as count "
            f"FROM logs l {ts_where} GROUP BY bucket, l.level ORDER BY bucket ASC"
        )
        cur.execute(ts_query, params)
        ts_raw = cur.fetchall()
        return self._build_dashboard_time_series(
            ts_raw,
            start_time,
            end_time,
            ts_min_time,
            ts_max_time,
            bucket_interval_str,
            bucket_format,
        )

    def method_get_dashboard_stats(
        self,
        workspace_id: str | None = None,
        source_id: str | None = None,
        start_time: str | None = None,
        end_time: str | None = None,
        active_workspace_ids: list[str] | None = None,
    ) -> dict:
        """Fetch high-level metrics for the Dashboard view with advanced filtering in parallel."""
        # Trigger on-demand anomaly detection (throttled to max once every 10 seconds per workspace)
        try:
            self.anomaly_detector.detect_anomalies(workspace_id)
        except Exception as e:
            logger.error(
                f"[Anomalies] Failed to run anomaly detection on dashboard stats request: {e}"
            )

        import concurrent.futures

        # Establish base WHERE clause and fetch bounds first to get bucket configuration
        cursor = self.db.get_cursor()
        where_sql, params, norm_start = self._prepare_dashboard_where(
            workspace_id, source_id, start_time, end_time, active_workspace_ids
        )

        # 1. Sequential step: get time bounds and bucket configuration (needs to be first)
        bucket_interval_str, bucket_format, ts_min_time, ts_max_time = (
            self._get_dashboard_bucket_params(cursor, where_sql, params)
        )

        # Run remaining queries in parallel
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = {
                "total_logs": executor.submit(self._fetch_total_logs, where_sql, params),
                "level_counts": executor.submit(self._fetch_level_counts, where_sql, params),
                "total_clusters": executor.submit(self._fetch_total_clusters, where_sql, params),
                "top_clusters": executor.submit(self._fetch_top_clusters, where_sql, params),
                "workspace_count": executor.submit(
                    self._fetch_workspace_count, active_workspace_ids
                ),
                "time_series": executor.submit(
                    self._fetch_time_series,
                    bucket_interval_str,
                    bucket_format,
                    where_sql,
                    params,
                    start_time,
                    end_time,
                    ts_min_time,
                    ts_max_time,
                ),
                "top_error_clusters": executor.submit(
                    self._fetch_top_error_clusters, where_sql, params
                ),
                "new_patterns_count": executor.submit(
                    self._fetch_pattern_drift, start_time, norm_start
                ),
                "source_heatmap": executor.submit(
                    self._fetch_source_heatmap, where_sql, params, bucket_format
                ),
                "latest_insight": executor.submit(self._fetch_latest_insight, workspace_id),
            }
            results = {k: f.result() for k, f in futures.items()}

        return {
            "total_logs": results["total_logs"],
            "total_clusters": results["total_clusters"],
            "level_counts": results["level_counts"],
            "top_clusters": results["top_clusters"],
            "top_error_clusters": results["top_error_clusters"],
            "time_series": results["time_series"],
            "source_heatmap": results["source_heatmap"],
            "latest_insight": results["latest_insight"],
            "new_patterns_count": results["new_patterns_count"],
            "workspace_count": results["workspace_count"],
            "active_tailers": len([k for k, t in self.tailers.items() if t.running]),
            "bucket_interval": bucket_interval_str,
            "time_bounds": {
                "min": ts_min_time or "",
                "max": ts_max_time or "",
            },
        }

    def method_purge_inactive_workspaces(self, active_workspace_ids: list[str]) -> dict:
        """Permanently delete logs and clusters from workspaces not in the active list."""
        if not active_workspace_ids:
            return {"status": "error", "message": "Active workspace list cannot be empty for purge"}

        cursor = self.db.get_cursor()
        placeholders = ", ".join(["?"] * len(active_workspace_ids))

        # Delete logs
        q1 = f"DELETE FROM logs WHERE workspace_id NOT IN ({placeholders})"
        cursor.execute(q1, active_workspace_ids)
        logs_deleted = cursor.rowcount

        # Delete clusters
        q2 = f"DELETE FROM clusters WHERE workspace_id NOT IN ({placeholders})"
        cursor.execute(q2, active_workspace_ids)
        clusters_deleted = cursor.rowcount

        # Delete workspace settings
        q3 = f"DELETE FROM workspace_settings WHERE workspace_id NOT IN ({placeholders})"
        cursor.execute(q3, active_workspace_ids)

        return {
            "status": "ok",
            "logs_deleted": logs_deleted,
            "clusters_deleted": clusters_deleted,
            "message": f"Purged data for inactive workspaces. {logs_deleted} logs removed.",
        }

    # --- Private Helpers for Complexity Reduction ---

    def _get_facet_rules_for_workspace(
        self, cursor: Any, workspace_id: str, cache: dict, global_rules: list
    ) -> list:
        if workspace_id not in cache:
            ws_rules = []
            cursor.execute(
                "SELECT value FROM workspace_settings WHERE workspace_id = ? AND key = 'facet_extractions'",
                (workspace_id,),
            )
            wr = cursor.fetchone()
            if wr and wr[0]:
                try:
                    parsed = json.loads(wr[0])
                    ws_rules = parsed if isinstance(parsed, list) else []
                except Exception:
                    pass
            cache[workspace_id] = global_rules + ws_rules
        return cache[workspace_id]

    def _persist_settings(self, cursor: Any, settings: dict, workspace_id: str | None):
        if workspace_id:
            query = (
                "INSERT INTO workspace_settings (workspace_id, key, value) VALUES (?, ?, ?) "
                "ON CONFLICT (workspace_id, key) DO UPDATE SET value = excluded.value"
            )
            for k, v in settings.items():
                val = json.dumps(v) if isinstance(v, (list, dict)) else str(v)
                cursor.execute(query, (workspace_id, k, val))
        else:
            query = (
                "INSERT INTO settings (key, value) VALUES (?, ?) "
                "ON CONFLICT (key) DO UPDATE SET value = excluded.value"
            )
            for k, v in settings.items():
                val = json.dumps(v) if isinstance(v, (list, dict)) else str(v)
                cursor.execute(query, (k, val))

    def _check_ai_provider_reload(self, settings: dict, workspace_id: str | None):
        ai_keys = ["ai_provider", "ai_api_key", "ai_model", "ai_ollama_host", "ai_openai_host"]
        if not workspace_id and any(k in settings for k in ai_keys):
            current_settings = self.method_get_settings()
            self.ai = self._init_ai_provider(current_settings)

            # CRITICAL FIX: Also re-initialize the hybrid runner with the new provider instance!
            ai_data_dir = os.path.join(PROJECT_ROOT, "data")
            self.hybrid_runner = HybridRunner(
                self, self.ai, db_path=os.path.join(ai_data_dir, AI_STATE_DB)
            )
            logger.info("AI Provider and HybridRunner re-initialized with new settings.")

    async def _handle_chat_streaming(
        self,
        response: web.StreamResponse,
        params: SendAiMessageRequest,
        history: list,
        session_id: str,
        provider_session_id: str | None,
        full_text: list[str],
    ) -> dict | None:
        extracted_a2ui = None
        is_collecting_a2ui = False
        a2ui_buffer = ""

        async for chunk in self.ai.chat_stream(
            messages=history,
            model=params.model,
            reasoning=params.reasoning,
            session_id=session_id,
            provider_session_id=provider_session_id,
        ):
            full_text.append(chunk)

            # --- Reasoning/Thinking Mode Handling ---
            # We parse reasoning blocks on the fly if possible,
            # though regex on chunks is tricky. For now, we normalize and send.
            normalized_chunk = parse_reasoning_blocks(chunk)

            # Detect if we are inside a thought block
            # (Simplistic implementation for streaming: if chunk has <think> but not </think>)
            # For better UX, we just pass the normalized chunk.

            # A2UI Transition Detection
            if A2UI_START in chunk and not is_collecting_a2ui:
                is_collecting_a2ui = True
                parts = chunk.split(A2UI_START)
                a2ui_buffer = parts[1]
            elif is_collecting_a2ui:
                a2ui_buffer += chunk

            # A2UI Completion Detection
            if is_collecting_a2ui and A2UI_END in a2ui_buffer:
                extracted_a2ui = self._extract_a2ui_payload(a2ui_buffer)
                if extracted_a2ui:
                    await response.write(
                        f"data: {json.dumps({'a2ui_payload': extracted_a2ui})}\n\n".encode()
                    )
                is_collecting_a2ui = False

            # Send chunk to UI. The UI components (ReasoningBlock) will handle <think> tags.
            await response.write(f"data: {json.dumps({'chunk': normalized_chunk})}\n\n".encode())

        return extracted_a2ui

    async def _handle_chat_sync_fallback(
        self,
        response: web.StreamResponse,
        params: SendAiMessageRequest,
        history: list,
        session_id: str,
        provider_session_id: str | None,
        full_text: list[str],
    ) -> dict | None:
        resp_msg = await self.ai.chat(
            history,
            model=params.model,
            session_id=session_id,
            provider_session_id=provider_session_id,
        )
        full_text.append(resp_msg.content)
        extracted_a2ui = self._extract_a2ui_payload(resp_msg.content)

        payload: dict[str, Any] = {"chunk": resp_msg.content}
        if extracted_a2ui:
            payload["a2ui_payload"] = extracted_a2ui

        await response.write(f"data: {json.dumps(payload)}\n\n".encode())
        return extracted_a2ui

    def _extract_a2ui_payload(self, text: str) -> dict | None:
        """Parses A2UI block from text, supporting both JSON and raw markup."""
        if A2UI_START not in text:
            return None

        try:
            raw_content = text.split(A2UI_START)[1].split(A2UI_END)[0].strip()
            try:
                return json.loads(raw_content)
            except ValueError:
                return {"type": "markup", "raw": raw_content}
        except Exception:
            return None


async def on_cleanup(server_app):
    """Lifecycle hook to clean up background workers when aiohttp stops."""
    app = server_app.get("sidecar_app")
    if app:
        await app.stop_async()
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
                allow_methods="*",
            ),
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


async def start_background_http(app: App, port: int = 5000):
    """Starts the aiohttp server in the background without blocking."""
    server = web.Application()

    # Configure CORS
    cors = aiohttp_cors.setup(
        server,
        defaults={
            "*": aiohttp_cors.ResourceOptions(
                allow_credentials=True,
                expose_headers="*",
                allow_headers="*",
                allow_methods="*",
            ),
        },
    )

    resource = server.router.add_resource("/rpc")
    route = resource.add_route("POST", app.aiohttp_handler)
    cors.add(route)

    stream_resource = server.router.add_resource("/api/stream_chat")
    stream_route = stream_resource.add_route("POST", app.aiohttp_stream_chat)
    cors.add(stream_route)

    server["sidecar_app"] = app

    runner = web.AppRunner(server)
    await runner.setup()
    site = web.TCPSite(runner, "127.0.0.1", port)
    try:
        await site.start()
        logger.info("Background HTTP server started on port %s", port)
        return runner
    except Exception as e:
        if "10048" in str(e) or "EADDRINUSE" in str(e):
            logger.warning("Port %s in use. Background HTTP server skipped.", port)
        else:
            logger.error("Failed to start background HTTP server: %s", e)
        return None


async def run_stdio_async(db_path=DEFAULT_DB, start_http=False, http_port=5000):
    app = App(db_path=db_path)
    app.dev_mode = False

    _http_runner = None
    if start_http:
        _http_runner = await start_background_http(app, port=http_port)

    try:
        loop = asyncio.get_event_loop()

        while True:
            line = await loop.run_in_executor(None, sys.stdin.readline)
            if not line:
                break

            if not line.strip():
                continue

            req_dict = None
            try:
                req_dict = json.loads(line)
                req = JSONRPCRequest(**req_dict)
                res = await app.dispatch(req)
                print(json.dumps(res.model_dump(), default=_json_default), flush=True)
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
    except (KeyboardInterrupt, EOFError, asyncio.CancelledError):
        pass
    finally:
        await app.stop_async()
        LogDatabase.reset()
        logger.info("Sidecar: Cleanly exited.")


def run_stdio(db_path=DEFAULT_DB, start_http=False, http_port=5000):
    asyncio.run(run_stdio_async(db_path=db_path, start_http=start_http, http_port=http_port))
