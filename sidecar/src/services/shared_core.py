# Assume Role: Backend Engineer (@backend)
import logging
import os
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
        self._modified_event = threading.Event()

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
        self._modified_event.clear()
        self._tailer_thread = threading.Thread(target=self._run_tail, daemon=True)
        self._tailer_thread.start()
        logger.info("[SharedSource] Started tailing %s", self.filepath)

    def _stop_tailing(self):
        self._running = False
        self._modified_event.set()
        logger.info("[SharedSource] Stopped tailing %s", self.filepath)

    def cleanup(self):
        """Final cleanup when source is removed."""
        self._stop_tailing()
        if self._tailer_thread and self._tailer_thread.is_alive():
            self._tailer_thread.join(timeout=1.0)

    def _run_tail(self):
        if not self.filepath:
            logger.warning("[SharedSource] Cannot tail: filepath is None")
            return

        try:
            from watchdog.events import FileSystemEventHandler
            from watchdog.observers import Observer

            target_path = os.path.abspath(self.filepath)

            class FileChangeHandler(FileSystemEventHandler):
                def __init__(self, event):
                    self.event = event

                def on_modified(self, event):
                    if not event.is_directory and os.path.abspath(event.src_path) == target_path:
                        self.event.set()

            handler = FileChangeHandler(self._modified_event)
            observer = Observer()
            dir_to_watch = os.path.dirname(target_path) or "."
            observer.schedule(handler, path=dir_to_watch, recursive=False)
            observer.start()

            try:
                with open(self.filepath, encoding="utf-8", errors="replace") as f:
                    f.seek(0, 2)

                    while self._running:
                        while self._running:
                            line = f.readline()
                            if not line:
                                break
                            self._handle_new_line(line.rstrip("\n"))

                        if not self._running:
                            break

                        # Wait for modifications, with 1.0s timeout as safety pulse
                        self._modified_event.wait(timeout=1.0)
                        self._modified_event.clear()
            finally:
                observer.stop()
                observer.join(timeout=1.0)

        except Exception as e:
            logger.warning("[SharedSource] Watchdog tailing failed, falling back to polling: %s", e)
            self._run_tail_polling()

    def _run_tail_polling(self):
        if not self.filepath:
            return
        try:
            with open(self.filepath, encoding="utf-8", errors="replace") as f:
                f.seek(0, 2)

                while self._running:
                    line = f.readline()
                    if not line:
                        time_to_sleep = 0.1
                        time.sleep(time_to_sleep)
                        continue

                    self._handle_new_line(line.rstrip("\n"))
        except Exception as e:
            logger.error("[SharedSource] Polling tailer failed for %s: %s", self.filepath, e)
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

    def __init__(self, log_store: DiskLogStore | None = None):
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
                assert self.log_store is not None, (
                    "SharedSourceManager log_store is not initialized"
                )
                self._sources[source_id] = SharedSource(source_id, filepath, self.log_store)
            return self._sources[source_id]

    def cleanup(self):
        """Shutdown all active tailers."""
        with self._lock:
            for source in self._sources.values():
                source.cleanup()
            self._sources.clear()
