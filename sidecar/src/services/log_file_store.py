"""
services/log_file_store.py
--------------------------
Disk-First ingestion layer.

Every source_id gets a dedicated flat log file under ``data/storage/``.
Instead of persisting raw text in DuckDB, we:

  1. Append the raw line to  ``<storage_dir>/<safe_source_id>.log``
  2. Return the 0-based ``line_id`` (the line's index within that file)

The caller inserts only (workspace_id, source_id, line_id, ...) into DuckDB.
This removes ~80 % of write amplification and enables future mmap seeks.
"""

import contextlib
import logging
import os
import re
import struct
import threading
from collections.abc import Sequence

logger = logging.getLogger(__name__)

# Characters that are unsafe in file names on Windows / POSIX.
_UNSAFE = re.compile(r"[^A-Za-z0-9_\-]")


def _safe_name(source_id: str) -> str:
    """Convert an arbitrary source_id to a filesystem-safe stem."""
    sanitized = _UNSAFE.sub("_", source_id)
    # Truncate to avoid MAX_PATH issues; 64 chars is plenty for a stem.
    return sanitized[:64]


class SourceFileHandle:
    """
    Per-source file handle, protected by its own lock.
    Maintains both the .log file and a companion .index file.

    The index file is a sequence of 64-bit unsigned integers (little-endian).
    index[N] = byte offset of the start of line N.
    The index always contains (line_count + 1) entries, where the last entry
    is the current total size of the log file.
    """

    __slots__ = ("path", "idx_path", "line_count", "lock", "_fh", "_ifh")

    def __init__(self, path: str, idx_path: str, existing_count: int) -> None:
        self.path = path
        self.idx_path = idx_path
        self.line_count = existing_count
        self.lock = threading.Lock()

        # Open log in append mode; binary for consistent '\n'
        self._fh = open(path, "ab")  # noqa: SIM115
        # Open index in append mode
        self._ifh = open(idx_path, "ab")  # noqa: SIM115

        # If it's a new file, the first offset is always 0
        if self.line_count == 0 and os.path.getsize(self.idx_path) == 0:
            self._ifh.write(struct.pack("<Q", 0))
            self._ifh.flush()

    def write_line(self, raw: str) -> int:
        """Append *raw* as a single line and return its 0-based line_id."""
        encoded = (raw.rstrip("\n") + "\n").encode("utf-8", errors="replace")
        with self.lock:
            # 1. Write the log line
            self._fh.write(encoded)
            self._fh.flush()

            # 2. Record the new offset (current file size)
            new_offset = self._fh.tell()
            self._ifh.write(struct.pack("<Q", new_offset))
            self._ifh.flush()

            line_id = self.line_count
            self.line_count += 1
        return line_id

    def write_batch(self, raws: Sequence[str]) -> list[int]:
        """Append multiple lines and return their line_ids."""
        if not raws:
            return []

        encoded_lines = [
            (r.rstrip("\n") + "\n").encode("utf-8", errors="replace") for r in raws
        ]

        with self.lock:
            start_id = self.line_count
            for enc in encoded_lines:
                # Write line
                self._fh.write(enc)
                # Record new offset
                new_offset = self._fh.tell()
                self._ifh.write(struct.pack("<Q", new_offset))

            self._fh.flush()
            self._ifh.flush()
            self.line_count += len(encoded_lines)

        return list(range(start_id, start_id + len(encoded_lines)))

    def close(self) -> None:
        with self.lock:
            if hasattr(self, "_fh") and not self._fh.closed:
                self._fh.close()
            if hasattr(self, "_ifh") and not self._ifh.closed:
                self._ifh.close()

    def __del__(self) -> None:
        with contextlib.suppress(Exception):
            self.close()


class DiskLogStore:
    """
    Manager for per-source log storage with companion indexing.
    """

    def __init__(self, storage_dir: str) -> None:
        os.makedirs(storage_dir, exist_ok=True)
        self._storage_dir = storage_dir
        self._registry: dict[str, SourceFileHandle] = {}
        self._registry_lock = threading.Lock()
        logger.info("[DiskLogStore] Initialised at: %s", storage_dir)

    def append_line(self, source_id: str, raw: str) -> int:
        handle = self._get_handle(source_id)
        return handle.write_line(raw)

    def append_batch(self, source_id: str, raws: Sequence[str]) -> list[int]:
        handle = self._get_handle(source_id)
        return handle.write_batch(raws)

    def file_path(self, source_id: str) -> str:
        return os.path.join(self._storage_dir, f"{_safe_name(source_id)}.log")

    def index_path(self, source_id: str) -> str:
        return os.path.join(self._storage_dir, f"{_safe_name(source_id)}.index")

    def close_all(self) -> None:
        with self._registry_lock:
            for handle in self._registry.values():
                handle.close()
            self._registry.clear()

    def _get_handle(self, source_id: str) -> SourceFileHandle:
        with self._registry_lock:
            if source_id not in self._registry:
                path = self.file_path(source_id)
                idx_path = self.index_path(source_id)

                # Ensure index is consistent with the log file
                count = self._ensure_index(path, idx_path)

                logger.debug(
                    "[DiskLogStore] Opening handle for %s at line %d",
                    source_id,
                    count,
                )
                self._registry[source_id] = SourceFileHandle(path, idx_path, count)
            return self._registry[source_id]

    def _ensure_index(self, path: str, idx_path: str) -> int:
        """
        Validates the index file or rebuilds it if missing/corrupt.
        Returns the current line count.
        """
        if not os.path.exists(path):
            # Clean up orphan index if log is gone
            if os.path.exists(idx_path):
                os.remove(idx_path)
            return 0

        log_size = os.path.getsize(path)

        if os.path.exists(idx_path):
            idx_size = os.path.getsize(idx_path)
            # Index should be (N+1) * 8 bytes.
            if idx_size >= 8 and idx_size % 8 == 0:
                # Check the last entry in the index matches the log size
                with open(idx_path, "rb") as f:
                    f.seek(-8, os.SEEK_END)
                    last_offset = struct.unpack("<Q", f.read(8))[0]
                    if last_offset == log_size:
                        return (idx_size // 8) - 1

        # Rebuild required
        logger.info("[DiskLogStore] Rebuilding index for %s...", path)
        return self._rebuild_index(path, idx_path)

    def _rebuild_index(self, path: str, idx_path: str) -> int:
        count = 0
        try:
            with open(path, "rb") as lf, open(idx_path, "wb") as idx:
                # First offset is always 0
                idx.write(struct.pack("<Q", 0))

                while True:
                    chunk = lf.read(1 << 20)
                    if not chunk:
                        break
                    # We need to find every \n and record the offset AFTER it
                    base_offset = lf.tell() - len(chunk)
                    pos = chunk.find(b"\n")
                    while pos != -1:
                        count += 1
                        abs_offset = base_offset + pos + 1
                        idx.write(struct.pack("<Q", abs_offset))
                        pos = chunk.find(b"\n", pos + 1)

                # Ensure the very last byte of the file is indexed if not ending in \n
                # But our ingestion always appends \n.
                # Just in case, check if the last written offset matches file size
                final_size = lf.tell()
                idx.flush()
                if os.path.getsize(idx_path) > 0:
                    with open(idx_path, "rb+") as f:
                        f.seek(-8, os.SEEK_END)
                        if struct.unpack("<Q", f.read(8))[0] != final_size:
                            f.write(struct.pack("<Q", final_size))

        except Exception as exc:
            logger.error("[DiskLogStore] Failed to rebuild index for %s: %s", path, exc)
            return 0
        return count
