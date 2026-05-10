import json
import logging
import threading
import time
from typing import Any

from metadata_extractor import extract_log_metadata

logger = logging.getLogger("ClusteringWorker")


class ClusteringWorker:
    """
    Background worker that processes logs for Drain3 clustering.
    Ensures that log ingestion is non-blocking and resumable.
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

    def start(self):
        if self.running:
            return
        self.running = True
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, name="ClusteringWorker", daemon=True)
        self._thread.start()
        logger.info("[Worker] Clustering worker started.")

    def stop(self):
        self.running = False
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5)
        logger.info("[Worker] Clustering worker stopped.")

    def _run(self):
        while not self._stop_event.is_set():
            try:
                # If paused, wait for force_cycle or stop_event
                if self.paused and not self._force_cycle.is_set():
                    self._force_cycle.wait(timeout=1.0)
                    if not self._force_cycle.is_set():
                        continue

                # Adjust batch size and interval based on mode
                current_batch_size = self.batch_size
                current_interval = self.interval

                if self.mode == "burst":
                    current_batch_size = self.batch_size * 4
                    current_interval = 0.1

                processed_count = self._process_batch(batch_size=current_batch_size)
                self.processed_session += processed_count

                if processed_count == 0:
                    self._force_cycle.clear()
                    # STAB-005: Periodic sync to handle ingestion jobs stuck by duplicate suppression
                    self._sync_job_statuses()
                    time.sleep(current_interval)
                elif self.mode == "burst":
                    # In burst mode, keep hammering without much delay
                    time.sleep(current_interval)
                else:
                    # Normal pacing
                    time.sleep(0.1)  # Small gap between batches even in auto

            except Exception as e:
                logger.error(f"[Worker] Error in clustering cycle: {e}")
                time.sleep(self.interval * 2)  # Back off on error

    def _hydrate_log_text(self, source_id: str, line_id: int, raw_text: str | None, now: float) -> str | None | bool:
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
            if retries < 8:
                self._quarantine[q_key] = (retries + 1, now)
                return False  # Skip for now
            
            logger.warning(f"[Worker] Hydration failure for {source_id}:{line_id}. Marking as MISSING.")
            if q_key in self._quarantine:
                del self._quarantine[q_key]
            return None  # Missing permanently

        if q_key in self._quarantine:
            del self._quarantine[q_key]
        return raw_text

    def _get_parser_config(self, cursor: Any, ws_id: str, source_id: str, parser_configs: dict) -> tuple[dict, int]:
        """Fetches and caches parser configuration."""
        source_key = (ws_id, source_id)
        if source_key not in parser_configs:
            cursor.execute(
                "SELECT parser_config, tz_offset FROM fusion_configs WHERE workspace_id = ? AND source_id = ?",
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

    def _process_batch(self, batch_size: int | None = None) -> int:
        cursor = self.db.get_cursor()
        limit = batch_size or self.batch_size

        if not hasattr(self, "_quarantine"):
            self._quarantine = {}

        cursor.execute(
            "SELECT id, workspace_id, source_id, line_id, facets, raw_text FROM logs WHERE processed = FALSE ORDER BY id ASC LIMIT ?",
            (limit,),
        )
        batch = cursor.fetchall()
        if not batch:
            return 0

        logger.debug(f"[Worker] Processing batch of {len(batch)} logs...")
        rules_cache, global_rules = {}, self._get_global_rules(cursor)
        updates, cluster_increments, batch_counts, parser_configs = [], {}, {}, {}
        now = time.time()

        for log_id, ws_id, source_id, line_id, facets_json, raw_text in batch:
            try:
                # 1. Hydrate
                raw_text = self._hydrate_log_text(source_id, line_id, raw_text, now)
                if raw_text is False: continue
                if raw_text is None:
                    updates.append((None, "MISSING", "{}", None, log_id))
                    continue

                # 2. Extract Metadata
                rules = self.app._get_facet_rules_for_workspace(cursor, ws_id, rules_cache, global_rules)
                p_config, p_tz = self._get_parser_config(cursor, ws_id, source_id, parser_configs)
                meta = extract_log_metadata(raw_text, custom_rules=rules, parser_config=p_config, tz_offset=p_tz)
                
                # Merge facets
                existing_facets = json.loads(facets_json) if facets_json else {}
                meta["facets"].update(existing_facets)
                
                # 3. Pattern Mining
                parser = self.app.get_drain_parser(ws_id)
                res = parser.parse(meta["message"])
                cluster_id, template = res["cluster_id"], res["template"]

                # 4. Cache for Bulk Update
                key = (ws_id, cluster_id, template)
                cluster_increments[key] = cluster_increments.get(key, 0) + 1
                updates.append((meta["timestamp"], meta["level"], json.dumps(meta["facets"]), cluster_id, log_id))
                
                job_key = (ws_id, source_id)
                batch_counts[job_key] = batch_counts.get(job_key, 0) + 1

            except Exception as e:
                logger.error(f"[Worker] Failed to process log {log_id}: {e}")
                updates.append((None, "ERROR", facets_json, None, log_id))

        if updates:
            self._apply_batch_updates(cursor, updates, cluster_increments)
        
        self._update_ingestion_jobs(cursor, batch_counts)
        self.db.commit()
        return len(batch)

    def _apply_batch_updates(self, cursor: Any, updates: list, cluster_increments: dict):
        """Applies batch updates to logs and clusters tables."""
        cursor.execute("BEGIN TRANSACTION")
        try:
            cursor.executemany(
                "UPDATE logs SET timestamp = COALESCE(?, timestamp), level = ?, facets = ?, cluster_id = ?, processed = TRUE WHERE id = ?",
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
        except Exception as e:
            cursor.execute("ROLLBACK")
            logger.error(f"[Worker] Transaction failed: {e}")
            raise e

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
                "UPDATE ingestion_jobs SET status = 'completed' WHERE workspace_id = ? AND source_id = ? AND status = 'processing' AND processed_lines >= total_lines",
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
            # Find active jobs and their sources
            cursor.execute(
                "SELECT workspace_id, source_id FROM ingestion_jobs WHERE status IN ('pending', 'processing')"
            )
            active_jobs = cursor.fetchall()

            for ws_id, src_id in active_jobs:
                # If there are no more unprocessed logs for this source, mark job as completed
                cursor.execute(
                    "SELECT COUNT(*) FROM logs WHERE workspace_id = ? AND source_id = ? AND processed = FALSE",
                    (ws_id, src_id),
                )
                unprocessed = cursor.fetchone()[0]

                if unprocessed == 0:
                    cursor.execute(
                        "SELECT COUNT(*) FROM logs WHERE workspace_id = ? AND source_id = ? AND processed = TRUE",
                        (ws_id, src_id),
                    )
                    processed_now = cursor.fetchone()[0]

                    cursor.execute(
                        """
                        UPDATE ingestion_jobs 
                        SET processed_lines = ?,
                            status = 'completed',
                            updated_at = CURRENT_TIMESTAMP
                        WHERE workspace_id = ? AND source_id = ? AND status IN ('pending', 'processing')
                        """,
                        (processed_now, ws_id, src_id),
                    )
            self.db.commit()
        except Exception as e:
            logger.error(f"[Worker] Job status sync failed: {e}")

    def _get_global_rules(self, cursor: Any) -> list:
        """Helper to fetch global extraction rules."""
        cursor.execute("SELECT value FROM settings WHERE key = 'facet_extractions'")
        gr = cursor.fetchone()
        if gr and gr[0]:
            try:
                parsed = json.loads(gr[0])
                return parsed if isinstance(parsed, list) else []
            except Exception:
                pass
        return []

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

        logger.info(f"[Worker] Clustering mode changed to: {self.mode} (paused={self.paused})")

    def set_paused(self, paused: bool):
        """Explicitly pause or resume the worker."""
        self.paused = paused
        if not paused:
            self._force_cycle.set()
        logger.info(f"[Worker] Clustering {'paused' if paused else 'resumed'}")

    def trigger_cycle(self):
        """Manually trigger a single processing cycle."""
        self._force_cycle.set()
