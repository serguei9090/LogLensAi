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

        # 1. Shared Metadata Extraction (Regex/Parser logic)
        metadata = extract_log_metadata(self.workspace_id, self.filepath, line)
        timestamp = metadata["timestamp"]
        level = metadata["level"]
        raw_message = metadata["message"]

        # 2. Clustering (Pattern Mining)
        try:
            # Cluster on the extracted message (cleaner)
            res = self.parser.parse(raw_message)
            cluster_id = str(res["cluster_id"])
            message = res["template"]
        except Exception:
            cluster_id = "unknown"
            message = raw_message

        # 3. Persistence
        cursor = self.db.get_cursor()
        cursor.execute(
            """
            INSERT INTO logs (workspace_id, source_id, timestamp, level, message, cluster_id, raw_text)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (self.workspace_id, self.filepath, timestamp, level, message, cluster_id, line),
        )
