import os
import threading
import time

from metadata_extractor import extract_log_metadata
from parser import DrainParser


class FileTailer:
    def __init__(
        self,
        filepath: str,
        workspace_id: str,
        parser: DrainParser,
        db,
        log_store,
        source_id: str = None,
    ) -> None:
        # Normalize to forward slashes for consistent source_id across OS
        self.filepath = os.path.abspath(filepath).replace("\\", "/")
        self.workspace_id = workspace_id
        # Use the provided source_id (UUID) or fallback to filepath (legacy)
        self.source_id = source_id or self.filepath
        self.parser = parser
        self.running = False
        self.thread = None
        self.db = db
        self.log_store = log_store

    def start(self):
        if self.running:
            return
        self.running = True
        self.thread = threading.Thread(target=self._tail, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=2)

    def _tail(self):
        try:
            with open(self.filepath, encoding="utf-8", errors="replace") as f:
                # Seek to end for live tailing
                f.seek(0, 2)

                while self.running:
                    line = f.readline()
                    if not line:
                        time.sleep(0.1)
                        continue

                    self._process_line(line.rstrip())
        except FileNotFoundError:
            self.running = False

    def _process_line(self, line: str) -> None:
        if not line:
            return

        # 1. Disk-First: write raw line to the source's flat file and get its line_id.
        line_id = self.log_store.append_line(self.source_id, line)

        # 2. Lightweight metadata extraction (timestamp + level only).
        custom_rules = self._get_rules()
        p_config, p_tz = self._get_parser_config()
        
        metadata = extract_log_metadata(
            line, 
            custom_rules=custom_rules,
            parser_config=p_config,
            tz_offset=p_tz
        )
        timestamp = metadata["timestamp"]
        level = metadata["level"]
        facets = metadata.get("facets", {})

        # 3. Insert the skinny row
        import json

        facets_json = json.dumps(facets) if facets else None
        cursor = self.db.get_cursor()
        cursor.execute(
            """
            INSERT INTO logs (workspace_id, source_id, line_id, timestamp, level, cluster_id, facets, processed)
            VALUES (?, ?, ?, ?, ?, NULL, ?, FALSE)
            """,
            (
                self.workspace_id,
                self.source_id,
                line_id,
                timestamp,
                level,
                facets_json,
            ),
        )

    def _get_parser_config(self) -> tuple[dict, float]:
        """Fetches and caches parser configuration for the source."""
        now = time.time()
        if not hasattr(self, "_p_config_cache"):
            self._p_config_cache = None
            self._p_config_expiry = 0

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
                import json
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
            self._rules_expiry = 0

        if self._rules_cache is not None and now < self._rules_expiry:
            return self._rules_cache

        custom_rules = []
        try:
            cursor = self.db.get_cursor()
            # Fetch global rules
            cursor.execute("SELECT value FROM settings WHERE key = 'facet_extractions'")
            global_row = cursor.fetchone()
            if global_row and global_row[0]:
                import json

                rules = json.loads(global_row[0])
                custom_rules.extend(rules if isinstance(rules, list) else [])

            # Fetch workspace-specific rules
            cursor.execute(
                "SELECT value FROM workspace_settings WHERE workspace_id = ? AND key = 'facet_extractions'",
                (self.workspace_id,),
            )
            ws_row = cursor.fetchone()
            if ws_row and ws_row[0]:
                import json

                rules = json.loads(ws_row[0])
                custom_rules.extend(rules if isinstance(rules, list) else [])
        except Exception:
            pass

        self._rules_cache = custom_rules
        self._rules_expiry = now + 10  # Cache for 10 seconds
        return custom_rules
