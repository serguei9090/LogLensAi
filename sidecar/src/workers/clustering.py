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
        self._thread = None
        self._stop_event = threading.Event()

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
                processed_count = self._process_batch()
                if processed_count == 0:
                    # STAB-005: Periodic sync to handle ingestion jobs stuck by duplicate suppression
                    self._sync_job_statuses()
                    time.sleep(self.interval)
            except Exception as e:
                logger.error(f"[Worker] Error in clustering cycle: {e}")
                time.sleep(self.interval * 2) # Back off on error

    def _process_batch(self) -> int:
        cursor = self.db.get_cursor()
        
        # 1. Fetch a batch of unprocessed logs
        # We process logs in order of ID to maintain sequence
        cursor.execute(
            "SELECT id, workspace_id, source_id, line_id, facets FROM logs WHERE processed = FALSE ORDER BY id ASC LIMIT ?",
            (self.batch_size,)
        )
        batch = cursor.fetchall()
        
        if not batch:
            return 0

        logger.info(f"[Worker] Processing batch of {len(batch)} logs...")
        
        # Caches for this batch
        rules_cache = {}
        global_rules = self._get_global_rules(cursor)

        updates = []
        cluster_increments = {}  # (ws_id, cluster_id, template) -> count

        for log_id, ws_id, source_id, line_id, facets_json in batch:
            try:
                # 0. Fetch raw text via Fast-Path
                raw_text = self.app.fast_path.get_line(source_id, line_id)
                if raw_text is None:
                    logger.warning(f"[Worker] Missing raw text for source {source_id}, line {line_id}")
                    raw_text = ""

                # 2. Rich Metadata Extraction (Regex parsing)
                existing_facets = json.loads(facets_json) if facets_json else {}
                rules = self.app._get_facet_rules_for_workspace(cursor, ws_id, rules_cache, global_rules)
                
                meta = extract_log_metadata(ws_id, source_id, raw_text, custom_rules=rules)
                
                # Merge heuristic facets with existing ones
                meta["facets"].update(existing_facets)
                
                timestamp = meta["timestamp"]
                level = meta["level"]
                message = meta["message"]
                facets = json.dumps(meta["facets"])

                # 3. Get Drain3 result (Pattern Mining)
                parser = self.app.get_drain_parser(ws_id)
                res = parser.parse(message)
                cluster_id = str(res["cluster_id"])
                template = res["template"]
                
                updates.append((timestamp, level, facets, cluster_id, log_id))
                
                # Aggregate cluster counts to minimize DB writes
                key = (ws_id, cluster_id, template)
                cluster_increments[key] = cluster_increments.get(key, 0) + 1
                
            except Exception as e:
                logger.error(f"[Worker] Failed to process log {log_id}: {e}")
                # Mark as processed with fallback to raw info
                updates.append((None, "ERROR", facets_json, "unknown", log_id))

        # 4. Update logs table in bulk
        if updates:
            cursor.executemany(
                """
                UPDATE logs 
                SET timestamp = COALESCE(?, timestamp), 
                    level = ?, 
                    facets = ?, 
                    cluster_id = ?, 
                    processed = TRUE 
                WHERE id = ?
                """,
                updates
            )

        # 4. Update clusters metadata table
        for (ws_id, cluster_id, template), count in cluster_increments.items():
            cursor.execute(
                """
                INSERT INTO clusters (workspace_id, cluster_id, template, count) 
                VALUES (?, ?, ?, ?)
                ON CONFLICT (workspace_id, cluster_id) 
                DO UPDATE SET count = count + excluded.count, template = excluded.template
                """,
                (ws_id, cluster_id, template, count)
            )

        # 5. Update Ingestion Job Status (Checkpointing)
        affected_sources = list({(ws_id, src_id) for _, ws_id, src_id, _, _ in batch})
        for ws_id, src_id in affected_sources:
            # Get processed count for this specific source
            cursor.execute(
                "SELECT COUNT(*) FROM logs WHERE workspace_id = ? AND source_id = ? AND processed = TRUE", 
                (ws_id, src_id)
            )
            processed_now = cursor.fetchone()[0]

            cursor.execute(
                """
                UPDATE ingestion_jobs 
                SET processed_lines = ?,
                status = CASE 
                    WHEN ? >= total_lines THEN 'completed' 
                    ELSE 'processing' 
                END,
                updated_at = CURRENT_TIMESTAMP
                WHERE workspace_id = ? AND source_id = ? AND status IN ('pending', 'processing')
                """,
                (processed_now, processed_now, ws_id, src_id)
            )

        self.db.commit()
        return len(batch)

    def _sync_job_statuses(self):
        """
        Forcefully syncs ingestion job statuses when the worker is idle.
        Resolves cases where total_lines > actual_lines due to duplicate suppression.
        """
        try:
            cursor = self.db.get_cursor()
            # Find active jobs and their sources
            cursor.execute("SELECT workspace_id, source_id FROM ingestion_jobs WHERE status IN ('pending', 'processing')")
            active_jobs = cursor.fetchall()
            
            for ws_id, src_id in active_jobs:
                # If there are no more unprocessed logs for this source, mark job as completed
                cursor.execute("SELECT COUNT(*) FROM logs WHERE workspace_id = ? AND source_id = ? AND processed = FALSE", (ws_id, src_id))
                unprocessed = cursor.fetchone()[0]
                
                if unprocessed == 0:
                    cursor.execute("SELECT COUNT(*) FROM logs WHERE workspace_id = ? AND source_id = ? AND processed = TRUE", (ws_id, src_id))
                    processed_now = cursor.fetchone()[0]
                    
                    cursor.execute(
                        """
                        UPDATE ingestion_jobs 
                        SET processed_lines = ?,
                            status = 'completed',
                            updated_at = CURRENT_TIMESTAMP
                        WHERE workspace_id = ? AND source_id = ? AND status IN ('pending', 'processing')
                        """,
                        (processed_now, ws_id, src_id)
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
