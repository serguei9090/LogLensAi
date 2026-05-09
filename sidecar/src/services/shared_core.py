import logging
import threading
import time
from collections.abc import Callable

from services.log_file_store import DiskLogStore

logger = logging.getLogger(__name__)


class SharedSource:
    """
    Manages a single log source shared across multiple workspaces.
    Encapsulates the file handle (if physical) and a pub/sub system for real-time updates.
    """

    def __init__(self, source_id: str, filepath: str | None, log_store: DiskLogStore):
        self.source_id = source_id
        self.filepath = filepath
        self.log_store = log_store
        self.handle = log_store.get_handle(source_id)
        self._subscribers: set[Callable[[str, int], None]] = set()
        self._lock = threading.Lock()
        self._tailer_thread = None
        self._running = False

    def subscribe(self, callback: Callable[[str, int], None]):
        """
        Subscribe to new log lines.
        The callback receives (raw_line, line_id).
        """
        with self._lock:
            self._subscribers.add(callback)
            if not self._running and self.filepath:
                self._start_tailing()

    def unsubscribe(self, callback: Callable[[str, int], None]):
        """Unsubscribe from updates."""
        with self._lock:
            self._subscribers.discard(callback)
            if not self._subscribers and self._running:
                self._stop_tailing()

    def _start_tailing(self):
        self._running = True
        self._tailer_thread = threading.Thread(target=self._run_tail, daemon=True)
        self._tailer_thread.start()
        logger.info("[SharedSource] Started tailing %s", self.filepath)

    def _stop_tailing(self):
        self._running = False
        # Thread will exit on next loop or timeout
        logger.info("[SharedSource] Stopped tailing %s", self.filepath)

    def cleanup(self):
        """Final cleanup when source is removed."""
        self._stop_tailing()
        if self._tailer_thread and self._tailer_thread.is_alive():
            self._tailer_thread.join(timeout=1.0)

    def _run_tail(self):
        try:
            # We use a dedicated file pointer for tailing
            with open(self.filepath, encoding="utf-8", errors="replace") as f:
                # Seek to end for live tailing
                f.seek(0, 2)

                while self._running:
                    line = f.readline()
                    if not line:
                        # Sleep briefly to avoid CPU spin
                        time_to_sleep = 0.1
                        # (Simple sleep is fine for background daemon)
                        time.sleep(time_to_sleep)
                        continue

                    self._handle_new_line(line.rstrip("\n"))
        except Exception as e:
            logger.error("[SharedSource] Tailing failed for %s: %s", self.filepath, e)
            self._running = False

    def push_line(self, line: str):
        """
        Manually push a line into the shared source.
        Used by API-based ingestion or SSH loaders.
        """
        self._handle_new_line(line)

    def push_batch(self, lines: list[str], line_ids: list[int]):
        """
        Broadcast a batch of lines that were already persisted to disk.
        Used by batch ingestion in api.py.
        """
        with self._lock:
            subs = list(self._subscribers)

        if not subs:
            return

        for i, line in enumerate(lines):
            for sub in subs:
                try:
                    sub(line, line_ids[i])
                except Exception as e:
                    logger.error("[SharedSource] Subscriber error: %s", e)

    def _handle_new_line(self, line: str):
        # 1. Update the centralized log store (RAM buffer + Disk)
        line_id = self.log_store.append_line(self.source_id, line)

        # 2. Broadcast to all active workspace subscribers
        with self._lock:
            subs = list(self._subscribers)

        for sub in subs:
            try:
                sub(line, line_id)
            except Exception as e:
                logger.error("[SharedSource] Subscriber error: %s", e)


class SharedSourceManager:
    """
    Singleton manager for all SharedSource instances.
    Ensures only one tailer exists per physical file.
    """

    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self, log_store: DiskLogStore = None):
        if self._initialized:
            return
        self.log_store = log_store
        self._sources: dict[str, SharedSource] = {}
        self._lock = threading.Lock()
        self._initialized = True

    def get_source(self, source_id: str, filepath: str | None = None) -> SharedSource:
        """Get or create a shared source for the given file."""
        with self._lock:
            if source_id not in self._sources:
                self._sources[source_id] = SharedSource(source_id, filepath, self.log_store)
            return self._sources[source_id]

    def cleanup(self):
        """Shutdown all active tailers."""
        with self._lock:
            for source in self._sources.values():
                source.cleanup()
            self._sources.clear()
