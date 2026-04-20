import os
import threading
import time

from db import Database
from metadata_extractor import extract_log_metadata
from parser import DrainParser


class FileTailer:
    def __init__(self, filepath, workspace_id, parser: DrainParser):
        # Normalize to forward slashes for consistent source_id across OS
        self.filepath = os.path.abspath(filepath).replace("\\", "/")
        self.workspace_id = workspace_id
        self.parser = parser
        self.running = False
        self.thread = None
        self.db = Database()

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

    def _process_line(self, line: str):
        if not line:
            return

        # 1. Fetch custom extraction rules (TODO: Cache these)
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

        # 2. Shared Metadata Extraction (Regex/Parser logic)
        metadata = extract_log_metadata(
            self.workspace_id, self.filepath, line, custom_rules=custom_rules
        )
        timestamp = metadata["timestamp"]
        level = metadata["level"]
        raw_message = metadata["message"]
        facets = metadata.get("facets", {})

        # 3. Clustering (Pattern Mining)
        try:
            res = self.parser.parse(raw_message)
            cluster_id = str(res["cluster_id"])
            message = res["template"]
        except Exception:
            cluster_id = "unknown"
            message = raw_message

        # 4. Persistence
        cursor = self.db.get_cursor()
        import json

        facets_json = json.dumps(facets) if facets else None
        cursor.execute(
            """
            INSERT INTO logs (workspace_id, source_id, timestamp, level, message, cluster_id, raw_text, facets)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                self.workspace_id,
                self.filepath,
                timestamp,
                level,
                message,
                cluster_id,
                line,
                facets_json,
            ),
        )
