import re

with open("sidecar/src/ingestion.py", "r", encoding="utf-8") as f:
    content = f.read()

# We want to add a queue and a flush worker
new_init = """    def __init__(
        self, app, syslog_port=514, http_port=5001, syslog_enabled=True, http_enabled=True
    ):
        import queue
        self.app = app
        self.syslog_port = syslog_port
        self.http_port = http_port
        self.syslog_enabled = syslog_enabled
        self.http_enabled = http_enabled
        self.running = False
        self._stop_event = threading.Event()
        self._threads = []
        self._http_runner = None
        self._http_loop = None
        self._streams_cache = []  # List of dicts: {workspace_id, name, type, port}
        self._log_queue = queue.Queue()"""

content = re.sub(
    r"    def __init__\([\s\S]*?self\._streams_cache = \[\]  # List of dicts: \{workspace_id, name, type, port\}",
    new_init,
    content,
)

new_start = """    def start(self):
        if self.running:
            return
        self.running = True
        self._stop_event.clear()
        self._threads = []

        self.refresh_log_streams()

        flush_thread = threading.Thread(target=self._run_flush_worker, name="IngestionFlush", daemon=True)
        self._threads.append(flush_thread)
        flush_thread.start()"""

content = content.replace(
    """    def start(self):
        if self.running:
            return
        self.running = True
        self._stop_event.clear()
        self._threads = []

        self.refresh_log_streams()""",
    new_start,
)

new_flush_worker = """    def _run_flush_worker(self):
        import time
        batch = []
        last_flush = time.time()

        while not self._stop_event.is_set() or not self._log_queue.empty():
            try:
                import queue
                log = self._log_queue.get(timeout=0.5)
                batch.append(log)
            except queue.Empty:
                pass

            now = time.time()
            if batch and (len(batch) >= 1000 or (now - last_flush) >= 1.0):
                try:
                    self.app.method_ingest_logs(batch)
                except Exception as e:
                    logger.error(f"Failed to bulk ingest streams: {e}")
                batch = []
                last_flush = now"""

content = content.replace(
    "    def _run_syslog(self):", new_flush_worker + "\n\n    def _run_syslog(self):"
)

# Fix Syslog ingest call
content = content.replace(
    """                    try:
                        self.app.method_ingest_logs([log_entry])
                    except Exception as ingest_err:
                        logger.error(
                            "Syslog ingestion processing error (WS: %s): %s",
                            stream["workspace_id"],
                            ingest_err,
                        )""",
    """                    self._log_queue.put(log_entry)""",
)

# Fix HTTP ingest call
content = content.replace(
    """                    try:
                        self.app.method_ingest_logs(workspace_logs)
                    except Exception as ingest_err:
                        logger.error(
                            f"HTTP ingestion processing error (WS: {stream['workspace_id']}): {ingest_err}"
                        )""",
    """                    for entry in workspace_logs:
                        self._log_queue.put(entry)""",
)

with open("sidecar/src/ingestion.py", "w", encoding="utf-8") as f:
    f.write(content)

print("Updated ingestion.py")
