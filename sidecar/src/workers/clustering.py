"""
ClusteringWorker — Train-then-Tag Parallel Pipeline
=====================================================
Phase 1 (Train):  Main thread runs parser.parse() on a training sample (first
                  TRAIN_SAMPLE_SIZE rows) to keep the Drain tree consistent.
Phase 2 (Tag):    Remaining rows are dispatched to a ProcessPoolExecutor.
                  Each worker receives a snapshot of the Drain cluster-map
                  (plain dict, fully picklable) and calls a free function
                  (_tag_log_row) that uses drain3 match logic locally without
                  touching the live miner object.
Aggregation:      All worker results flow back to the main thread for a single
                  atomic _apply_batch_updates() transaction — no shared DB state
                  across process boundaries.
"""

import json
import logging
import os
import threading
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import Any

from drain3 import TemplateMiner
from metadata_extractor import extract_log_metadata

logger = logging.getLogger("ClusteringWorker")

# ---------------------------------------------------------------------------
# Configuration constants
# ---------------------------------------------------------------------------
TRAIN_SAMPLE_SIZE = 200  # rows processed by the main thread to update the tree
MAX_PARALLEL_WORKERS = max(1, (os.cpu_count() or 4) - 1)  # leave one core for I/O


# ---------------------------------------------------------------------------
# Top-level picklable worker function (must live at module scope)
# ---------------------------------------------------------------------------
def _tag_log_row(  # noqa: PLR0913
    row: tuple,
    cluster_map: dict,
    miner_config: Any,
    rules: list,
    p_config: dict,
    p_tz: int,
    _now: float,
) -> dict:
    """
    Pure, picklable function executed in a child process.

    Performs metadata extraction and cluster-matching against a snapshot of
    the Drain tree. It reconstructs a temporary, in-memory TemplateMiner
    from the cluster map to leverage the official `match` logic.

    Never writes to the Drain tree or the database.

    Returns a result dict with keys:
      - log_id, ws_id, source_id, cluster_id, template, timestamp, level,
        facets_json, status ('ok' | 'missing' | 'error')
    """
    log_id, ws_id, source_id, _line_id, facets_json, raw_text = row
    try:
        if not raw_text:
            return {"status": "missing", "log_id": log_id, "ws_id": ws_id, "source_id": source_id}

        meta = extract_log_metadata(
            raw_text, custom_rules=rules, parser_config=p_config, tz_offset=p_tz
        )

        # Merge pre-existing facets
        existing_facets = json.loads(facets_json) if facets_json else {}
        meta["facets"].update(existing_facets)

        message = meta["message"]

        # Read-only Drain match: reconstruct a temporary miner and use its
        # official .match() method. This is safer and more accurate than
        # re-implementing the matching logic manually.
        cluster_id = None
        template = None
        if cluster_map:
            # Create a new, temporary, in-memory miner for this one-off task.
            # This avoids any pickling issues with locks from the main parser.
            temp_miner = TemplateMiner(config=miner_config)
            for c in cluster_map.values():
                # Manually reconstruct the cluster in the temporary miner.
                temp_miner.drain.id_to_cluster[c.cluster_id] = c
                temp_miner.drain.add_seq_to_prefix_tree(temp_miner.drain.root_node, c)

            # Now use the official, optimized match method.
            match_result = temp_miner.match(message)
            if match_result:
                cluster_id = str(match_result.cluster_id)
                template = match_result.get_template()

        return {
            "status": "ok",
            "log_id": log_id,
            "ws_id": ws_id,
            "source_id": source_id,
            "cluster_id": cluster_id,
            "template": template,
            "timestamp": meta["timestamp"],
            "level": meta["level"],
            "facets_json": json.dumps(meta["facets"]),
        }

    except Exception as exc:
        return {
            "status": "error",
            "log_id": log_id,
            "ws_id": ws_id,
            "source_id": source_id,
            "error": str(exc),
            "facets_json": facets_json,
        }


# ---------------------------------------------------------------------------
# Main worker class
# ---------------------------------------------------------------------------
class ClusteringWorker:
    """
    Background worker that processes logs for Drain3 clustering.
    Ensures that log ingestion is non-blocking and resumable.

    Uses a Train-then-Tag strategy:
      - TRAIN_SAMPLE_SIZE rows per batch update the Drain tree (main thread).
      - Remaining rows are tagged in parallel via ProcessPoolExecutor.
    """

    def __init__(self, app_instance: Any, batch_size: int = 500, interval: float = 2.0):
        self.app = app_instance
        self.db = app_instance.db
        self.batch_size = batch_size
        self.interval = interval
        self.running = False
        self.mode = "auto"  # auto, burst
        self.paused = False
        self.processed_session = 0
        self._thread = None
        self._stop_event = threading.Event()
        self._force_cycle = threading.Event()
        # Executor is lazily created and reused across batches
        self._executor: ProcessPoolExecutor | None = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self):
        if self.running:
            return
        self.running = True
        self._stop_event.clear()
        self._executor = ProcessPoolExecutor(max_workers=MAX_PARALLEL_WORKERS)
        self._thread = threading.Thread(target=self._run, name="ClusteringWorker", daemon=True)
        self._thread.start()
        logger.info("[Worker] Clustering worker started (max_workers=%d).", MAX_PARALLEL_WORKERS)

    def stop(self):
        self.running = False
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5)
        if self._executor:
            self._executor.shutdown(wait=False)
            self._executor = None
        logger.info("[Worker] Clustering worker stopped.")

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------

    def _run(self):
        while not self._stop_event.is_set():
            try:
                if self.paused and not self._force_cycle.is_set():
                    self._force_cycle.wait(timeout=1.0)
                    if not self._force_cycle.is_set():
                        continue

                current_batch_size = self.batch_size
                current_interval = self.interval

                if self.mode == "burst":
                    current_batch_size = self.batch_size * 4
                    current_interval = 0.1

                processed_count = self._process_batch(batch_size=current_batch_size)
                self.processed_session += processed_count

                if processed_count == 0:
                    self._force_cycle.clear()
                    self._sync_job_statuses()
                    time.sleep(current_interval)
                elif self.mode == "burst":
                    time.sleep(current_interval)
                else:
                    time.sleep(0.1)

            except Exception:
                logger.exception("[Worker] Error in clustering cycle:")
                time.sleep(self.interval * 2)

    # ------------------------------------------------------------------
    # Batch processing — Train-then-Tag
    # ------------------------------------------------------------------

    def _process_batch(self, batch_size: int | None = None) -> int:
        cursor = self.db.get_cursor()
        limit = batch_size or self.batch_size

        if not hasattr(self, "_quarantine"):
            self._quarantine = {}

        cursor.execute(
            "SELECT id, workspace_id, source_id, line_id, facets, raw_text FROM logs WHERE processed = FALSE ORDER BY id ASC LIMIT ?",  # noqa: E501
            (limit,),
        )
        batch = cursor.fetchall()
        if not batch:
            return 0

        logger.debug("[Worker] Processing batch of %d logs...", len(batch))
        rules_cache, global_rules = {}, self._get_global_rules(cursor)
        updates: list = []
        cluster_increments: dict = {}
        batch_counts: dict = {}
        parser_configs: dict = {}
        now = time.time()

        # ----------------------------------------------------------------
        # Phase 0: Hydrate — resolve any missing raw_text from fast_path.
        # We do this synchronously as it may involve per-source I/O that
        # we want quarantine logic to handle correctly.
        # ----------------------------------------------------------------
        hydrated_rows: list = []
        for row in batch:
            log_id, ws_id, source_id, _line_id, facets_json, raw_text = row
            hydrated = self._hydrate_log_text(source_id, _line_id, raw_text, now)
            if hydrated is False:
                continue  # quarantined — skip this cycle
            if hydrated is None:
                updates.append((None, "MISSING", "{}", None, log_id))
                continue
            hydrated_rows.append((log_id, ws_id, source_id, _line_id, facets_json, hydrated))

        if not hydrated_rows:
            if updates:
                self._apply_batch_updates(cursor, updates, cluster_increments)
                self._update_ingestion_jobs(cursor, batch_counts)
                self.db.commit()
            return len(batch)

        # ----------------------------------------------------------------
        # Phase 1: Train — feed the first TRAIN_SAMPLE_SIZE rows into the
        # Drain tree (parse() acquires the miner lock internally).
        # This keeps the tree accurate without blocking long.
        # ----------------------------------------------------------------
        train_rows = hydrated_rows[:TRAIN_SAMPLE_SIZE]
        tag_rows = hydrated_rows[TRAIN_SAMPLE_SIZE:]

        for log_id, ws_id, source_id, _line_id, facets_json, raw_text in train_rows:
            try:
                rules = self.app._get_facet_rules_for_workspace(  # noqa: SLF001
                    cursor, ws_id, rules_cache, global_rules
                )
                p_config, p_tz = self._get_parser_config(cursor, ws_id, source_id, parser_configs)
                meta = extract_log_metadata(
                    raw_text, custom_rules=rules, parser_config=p_config, tz_offset=p_tz
                )

                existing_facets = json.loads(facets_json) if facets_json else {}
                meta["facets"].update(existing_facets)

                parser = self.app.get_drain_parser(ws_id)
                res = parser.parse(meta["message"])  # ← updates tree
                cluster_id, template = res["cluster_id"], res["template"]

                key = (ws_id, cluster_id, template)
                cluster_increments[key] = cluster_increments.get(key, 0) + 1
                updates.append(
                    (
                        meta["timestamp"],
                        meta["level"],
                        json.dumps(meta["facets"]),
                        cluster_id,
                        log_id,
                    )
                )

                job_key = (ws_id, source_id)
                batch_counts[job_key] = batch_counts.get(job_key, 0) + 1

            except Exception:
                logger.exception("[Worker] Train phase failed for log %s:", log_id)
                updates.append((None, "ERROR", facets_json, None, log_id))

        # ----------------------------------------------------------------
        # Phase 2: Tag — dispatch remaining rows to the process pool.
        # We build a cluster-map snapshot (plain dict) from the live Drain
        # tree — fully picklable, no locks passed across process boundaries.
        # ----------------------------------------------------------------
        if tag_rows and self._executor is not None:
            # Group tag rows by (ws_id, source_id) to reuse parser + config
            ws_source_groups: dict[tuple, list] = {}
            for row in tag_rows:
                key = (row[1], row[2])  # (ws_id, source_id)
                ws_source_groups.setdefault(key, []).append(row)

            futures = []
            for (ws_id, source_id), rows in ws_source_groups.items():
                parser = self.app.get_drain_parser(ws_id)
                cluster_map = {c.cluster_id: c for c in parser.get_clusters()}
                rules = self.app._get_facet_rules_for_workspace(  # noqa: SLF001
                    cursor, ws_id, rules_cache, global_rules
                )
                p_config, p_tz = self._get_parser_config(cursor, ws_id, source_id, parser_configs)

                miner_config = parser.miner.config
                for row in rows:
                    fut = self._executor.submit(
                        _tag_log_row, row, cluster_map, miner_config, rules, p_config, p_tz, now
                    )
                    futures.append(fut)

            for fut in as_completed(futures):
                try:
                    result = fut.result()
                    status = result["status"]
                    log_id = result["log_id"]
                    ws_id = result["ws_id"]
                    source_id = result["source_id"]

                    if status == "ok":
                        cluster_id = result["cluster_id"]
                        template = result["template"]

                        if cluster_id and template:
                            key = (ws_id, cluster_id, template)
                            cluster_increments[key] = cluster_increments.get(key, 0) + 1

                        updates.append(
                            (
                                result["timestamp"],
                                result["level"],
                                result["facets_json"],
                                cluster_id,
                                log_id,
                            )
                        )
                        job_key = (ws_id, source_id)
                        batch_counts[job_key] = batch_counts.get(job_key, 0) + 1

                    elif status == "missing":
                        updates.append((None, "MISSING", "{}", None, log_id))

                    else:
                        logger.error(
                            "[Worker] Tag worker error for log %s: %s", log_id, result.get("error")
                        )
                        updates.append((None, "ERROR", result.get("facets_json"), None, log_id))

                except Exception:
                    logger.exception("[Worker] Future resolution failed:")

        # ----------------------------------------------------------------
        # Aggregation: single atomic commit for the entire batch
        # ----------------------------------------------------------------
        if updates:
            self._apply_batch_updates(cursor, updates, cluster_increments)

        self._update_ingestion_jobs(cursor, batch_counts)
        self.db.commit()
        return len(batch)

    # ------------------------------------------------------------------
    # Database helpers
    # ------------------------------------------------------------------

    def _apply_batch_updates(self, cursor: Any, updates: list, cluster_increments: dict):
        """Applies batch updates to logs and clusters tables atomically."""
        cursor.execute("BEGIN TRANSACTION")
        try:
            cursor.executemany(
                "UPDATE logs SET timestamp = COALESCE(?, timestamp), level = ?, facets = ?, cluster_id = ?, processed = TRUE WHERE id = ?",  # noqa: E501
                updates,
            )
            for (ws_id, cluster_id, template), count in cluster_increments.items():
                cursor.execute(
                    """
                    INSERT INTO clusters (workspace_id, cluster_id, template, count)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT (workspace_id, cluster_id)
                    DO UPDATE SET count = count + excluded.count, template = excluded.template
                    """,
                    (ws_id, cluster_id, template, count),
                )
            cursor.execute("COMMIT")
        except Exception:
            cursor.execute("ROLLBACK")
            logger.exception("[Worker] Transaction failed:")
            raise

    def _update_ingestion_jobs(self, cursor: Any, batch_counts: dict):
        """Updates ingestion job progress."""
        for (ws_id, src_id), count in batch_counts.items():
            cursor.execute(
                """
                UPDATE ingestion_jobs
                SET processed_lines = processed_lines + ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = (
                    SELECT id FROM ingestion_jobs
                    WHERE workspace_id = ? AND source_id = ? AND status IN ('pending', 'processing')
                    ORDER BY created_at DESC LIMIT 1
                )
                """,
                (count, ws_id, src_id),
            )
            cursor.execute(
                "UPDATE ingestion_jobs SET status = 'completed' WHERE workspace_id = ? AND source_id = ? AND status = 'processing' AND processed_lines >= total_lines",  # noqa: E501
                (ws_id, src_id),
            )
        self.db.commit()

    def _sync_job_statuses(self):
        """
        Forcefully syncs ingestion job statuses when the worker is idle.
        Resolves cases where total_lines > actual_lines due to duplicate suppression.
        """
        try:
            cursor = self.db.get_cursor()
            cursor.execute(
                "SELECT workspace_id, source_id FROM ingestion_jobs WHERE status IN ('pending', 'processing')"  # noqa: E501
            )
            active_jobs = cursor.fetchall()

            for ws_id, src_id in active_jobs:
                cursor.execute(
                    "SELECT COUNT(*) FROM logs WHERE workspace_id = ? AND source_id = ? AND processed = FALSE",  # noqa: E501
                    (ws_id, src_id),
                )
                unprocessed = cursor.fetchone()[0]

                if unprocessed == 0:
                    cursor.execute(
                        "SELECT COUNT(*) FROM logs WHERE workspace_id = ? AND source_id = ? AND processed = TRUE",  # noqa: E501
                        (ws_id, src_id),
                    )
                    processed_now = cursor.fetchone()[0]

                    cursor.execute(
                        """
                        UPDATE ingestion_jobs
                        SET processed_lines = ?,
                            status = 'completed',
                            updated_at = CURRENT_TIMESTAMP
                        WHERE workspace_id = ? AND source_id = ?
                        AND status IN ('pending', 'processing')
                        """,
                        (processed_now, ws_id, src_id),
                    )
            self.db.commit()
        except Exception:
            logger.exception("[Worker] Job status sync failed:")

    # ------------------------------------------------------------------
    # Hydration & config helpers
    # ------------------------------------------------------------------

    def _hydrate_log_text(
        self, source_id: str, line_id: int, raw_text: str | None, now: float
    ) -> str | None | bool:
        """Hydrates log text from fast_path if missing, handling quarantine."""
        if raw_text:
            return raw_text

        q_key = (source_id, line_id)
        if q_key in self._quarantine:
            retries, last_t = self._quarantine[q_key]
            wait_time = min(32, 2**retries)
            if now - last_t < wait_time:
                return False  # Skip for now

        raw_text = self.app.fast_path.get_line(source_id, line_id)
        if raw_text is None:
            retries, _ = self._quarantine.get(q_key, (0, 0))
            if retries < 8:  # noqa: PLR2004
                self._quarantine[q_key] = (retries + 1, now)
                return False
            logger.warning(
                "[Worker] Hydration failure for %s:%s. Marking as MISSING.", source_id, line_id
            )
            if q_key in self._quarantine:
                del self._quarantine[q_key]
            return None  # Missing permanently

        if q_key in self._quarantine:
            del self._quarantine[q_key]
        return raw_text

    def _get_parser_config(
        self, cursor: Any, ws_id: str, source_id: str, parser_configs: dict
    ) -> tuple[dict, int]:
        """Fetches and caches parser configuration."""
        source_key = (ws_id, source_id)
        if source_key not in parser_configs:
            cursor.execute(
                "SELECT parser_config, tz_offset FROM fusion_configs WHERE workspace_id = ? AND source_id = ?",  # noqa: E501
                (ws_id, source_id),
            )
            row = cursor.fetchone()
            if row:
                parser_configs[source_key] = (
                    json.loads(row[0]) if row[0] else {},
                    row[1] or 0,
                )
            else:
                parser_configs[source_key] = ({}, 0)
        return parser_configs[source_key]

    def _get_global_rules(self, cursor: Any) -> list:
        """Helper to fetch global extraction rules."""
        cursor.execute("SELECT value FROM settings WHERE key = 'facet_extractions'")
        gr = cursor.fetchone()
        if gr and gr[0]:
            try:
                parsed = json.loads(gr[0])
                return parsed if isinstance(parsed, list) else []
            except Exception:
                logger.debug("Failed to parse", exc_info=True)
        return []

    # ------------------------------------------------------------------
    # Status & control
    # ------------------------------------------------------------------

    def get_status(self) -> dict:
        """Returns the current status of the clustering worker."""
        cursor = self.db.get_cursor()
        cursor.execute("SELECT COUNT(*) FROM logs WHERE processed = FALSE")
        backlog = cursor.fetchone()[0]

        return {
            "mode": self.mode,
            "running": self.running,
            "paused": self.paused,
            "backlog": backlog,
            "processed_session": self.processed_session,
        }

    def set_mode(self, mode: str):
        """Changes the operational mode of the worker.
        'manual' is deprecated and now mapped to auto + paused.
        """
        if mode == "manual":
            self.mode = "auto"
            self.paused = True
        elif mode in ["auto", "burst"]:
            self.mode = mode
            self.paused = False
            self._force_cycle.set()
        else:
            raise ValueError(f"Invalid clustering mode: {mode}")

        logger.info("[Worker] Clustering mode changed to: %s (paused=%s)", self.mode, self.paused)

    def set_paused(self, paused: bool):  # noqa: FBT001
        """Explicitly pause or resume the worker."""
        self.paused = paused
        if not paused:
            self._force_cycle.set()
        logger.info("[Worker] Clustering %s", "paused" if paused else "resumed")

    def trigger_cycle(self):
        """Manually trigger a single processing cycle."""
        self._force_cycle.set()
