# Assume Role: Backend Engineer (@backend)
import json
import logging
import os
import queue
import threading
import time

from metadata_extractor import extract_log_metadata
from parser import DrainParser
from services.shared_core import SharedSourceManager

logger = logging.getLogger("FileTailer")


class FileTailer:
    """
    A workspace-specific subscriber to a SharedSource.
    Handles metadata extraction and database insertion for a single workspace.
    """

    def __init__(
        self,
        filepath: str,
        workspace_id: str,
        parser: DrainParser,
        db,
        log_store,
        source_id: str | None = None,
    ) -> None:
        # Normalize to forward slashes for consistent source_id across OS
        self.filepath = os.path.abspath(filepath).replace("\\", "/")
        self.workspace_id = workspace_id
        # Use the provided source_id (UUID) or fallback to filepath (legacy)
        self.source_id = source_id or self.filepath
        self.parser = parser
        self.db = db
        self.log_store = log_store

        # Shared source management
        self._manager = SharedSourceManager(log_store)
        self._shared_source = None

        # Micro-batching queue & thread
        self._queue = queue.Queue()
        self._flush_lock = threading.Lock()
        self._flush_running = False
        self._flush_thread = None

    @property
    def running(self) -> bool:
        """Returns True if currently subscribed to a shared source."""
        return self._shared_source is not None

    def start(self):
        """Subscribe to the shared source."""
        if self._shared_source:
            return

        self._flush_running = True
        self._flush_thread = threading.Thread(
            target=self._flush_loop, name=f"FileTailerFlush-{self.source_id}", daemon=True
        )
        self._flush_thread.start()

        self._shared_source = self._manager.get_source(self.source_id, self.filepath)
        self._shared_source.subscribe(self._process_line_callback)

    def stop(self):
        """Unsubscribe from the shared source."""
        if self._shared_source:
            self._shared_source.unsubscribe(self._process_line_callback)
            self._shared_source = None

        if self._flush_running:
            self._flush_running = False
            if self._flush_thread:
                self._flush_thread.join(timeout=1.0)
                self._flush_thread = None
            self._flush_remaining()

    def _process_line_callback(self, line: str, line_id: int) -> None:
        """Callback from SharedSource when a new line is detected."""
        self._process_line(line, line_id)

    def _process_line(self, line: str, line_id: int) -> None:
        if not line:
            return

        # 2. Lightweight metadata extraction (timestamp + level only).
        custom_rules = self._get_rules()
        p_config, p_tz = self._get_parser_config()

        metadata = extract_log_metadata(
            line, custom_rules=custom_rules, parser_config=p_config, tz_offset=p_tz
        )
        timestamp = metadata["timestamp"]
        ingest_timestamp = metadata["ingest_timestamp"]
        level = metadata["level"]
        facets = metadata.get("facets", {})

        # Put into the queue for batch insertion
        facets_json = json.dumps(facets) if facets else None
        self._queue.put(
            (
                self.workspace_id,
                self.source_id,
                line_id,
                line,
                timestamp,
                ingest_timestamp,
                level,
                facets_json,
            )
        )

    def _flush_loop(self):
        while self._flush_running:
            batch = []
            while len(batch) < 500:
                try:
                    # Timeout of 100ms (0.1 seconds)
                    item = self._queue.get(timeout=0.1)
                    batch.append(item)
                except queue.Empty:
                    break

            if batch:
                self._flush_batch(batch)

    def _flush_batch(self, batch: list):
        with self._flush_lock:
            cursor = self.db.get_cursor()
            cursor.execute("BEGIN TRANSACTION")
            try:
                cursor.executemany(
                    """
                    INSERT INTO logs (workspace_id, source_id, line_id, raw_text, timestamp, ingest_timestamp, level, cluster_id, facets, processed)
                    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, FALSE)
                    """,
                    batch,
                )
                cursor.execute("COMMIT")
            except Exception:
                cursor.execute("ROLLBACK")
                logger.exception("Failed to insert log batch in FileTailer:")

    def _flush_remaining(self):
        batch = []
        while not self._queue.empty():
            try:
                batch.append(self._queue.get_nowait())
            except queue.Empty:
                break
        if batch:
            self._flush_batch(batch)

    def _get_parser_config(self) -> tuple[dict, float]:
        """Fetches and caches parser configuration for the source."""
        now = time.time()
        if not hasattr(self, "_p_config_cache"):
            self._p_config_cache = None
            self._p_config_expiry = 0.0

        if self._p_config_cache is not None and now < self._p_config_expiry:
            return self._p_config_cache

        config = {}
        tz_offset = 0.0
        try:
            cursor = self.db.get_cursor()
            cursor.execute(
                "SELECT parser_config, tz_offset FROM fusion_configs WHERE workspace_id = ? AND source_id = ?",
                (self.workspace_id, self.source_id),
            )
            row = cursor.fetchone()
            if row:
                config = json.loads(row[0]) if row[0] else {}
                tz_offset = row[1] or 0.0
        except Exception:
            pass

        self._p_config_cache = (config, tz_offset)
        self._p_config_expiry = now + 30  # Cache for 30 seconds
        return self._p_config_cache

    def _get_rules(self) -> list:
        now = time.time()
        # Initialize instance cache if not exists
        if not hasattr(self, "_rules_cache"):
            self._rules_cache = None
            self._rules_expiry = 0.0

        if self._rules_cache is not None and now < self._rules_expiry:
            return self._rules_cache

        custom_rules = []
        try:
            cursor = self.db.get_cursor()
            # Fetch global rules
            cursor.execute("SELECT value FROM settings WHERE key = 'facet_extractions'")
            global_row = cursor.fetchone()
            if global_row and global_row[0]:
                rules = json.loads(global_row[0])
                custom_rules.extend(rules if isinstance(rules, list) else [])

            # Fetch workspace-specific rules
            cursor.execute(
                "SELECT value FROM workspace_settings WHERE workspace_id = ? AND key = 'facet_extractions'",
                (self.workspace_id,),
            )
            ws_row = cursor.fetchone()
            if ws_row and ws_row[0]:
                rules = json.loads(ws_row[0])
                custom_rules.extend(rules if isinstance(rules, list) else [])
        except Exception:
            pass

        self._rules_cache = custom_rules
        self._rules_expiry = now + 10  # Cache for 10 seconds
        return custom_rules
