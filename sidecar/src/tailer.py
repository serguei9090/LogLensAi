import os
import threading
import time

from src.db import Database
from src.parser import DrainParser


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
            with open(self.filepath) as f:
                # Seek to end for live tailing
                f.seek(0, 2)

                while self.running:
                    line = f.readline()
                    if not line:
                        time.sleep(0.1)
                        continue

                    self._process_line(line.strip())
        except FileNotFoundError:
            self.running = False

    def _process_line(self, line: str):
        if not line:
            return

        cluster_id = str(self.parser.parse(line))

        # Simple heuristic for level extraction, usually this would be more robust
        level = "INFO"
        upper_line = line.upper()
        for lvl in ["ERROR", "WARN", "DEBUG", "TRACE", "INFO"]:
            if lvl in upper_line:
                level = lvl
                break

        # Timestamp placeholder (e.g. current time if missing)
        import datetime

        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        cursor = self.db.get_cursor()
        cursor.execute(
            """
            INSERT INTO logs (id, workspace_id, source_id, timestamp, level, message, cluster_id, raw_text)
            VALUES (nextval('log_id_seq'), ?, ?, ?, ?, ?, ?, ?)
        """,
            (self.workspace_id, self.filepath, timestamp, level, line, cluster_id, line),
        )
