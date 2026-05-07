import logging
import threading
import time
import json
from typing import Any
from datetime import datetime

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
            "SELECT id, workspace_id, message, raw_text FROM logs WHERE processed = FALSE ORDER BY id ASC LIMIT ?",
            (self.batch_size,)
        )
        batch = cursor.fetchall()
        
        if not batch:
            return 0

        logger.info(f"[Worker] Processing batch of {len(batch)} logs...")
        
        updates = []
        cluster_increments = {} # (ws_id, cluster_id, template) -> count

        for log_id, ws_id, message, raw_text in batch:
            try:
                # Fallback to raw_text if message is missing
                msg_to_parse = message or raw_text or ""
                
                # 2. Get Drain3 result
                parser = self.app.get_drain_parser(ws_id)
                res = parser.parse(msg_to_parse)
                cluster_id = str(res["cluster_id"])
                template = res["template"]
                
                updates.append((cluster_id, log_id))
                
                # Aggregate cluster counts to minimize DB writes
                key = (ws_id, cluster_id, template)
                cluster_increments[key] = cluster_increments.get(key, 0) + 1
                
            except Exception as e:
                logger.error(f"[Worker] Failed to cluster log {log_id}: {e}")
                # Mark as processed anyway to avoid stuck logs, but with 'unknown' cluster
                updates.append(("unknown", log_id))

        # 3. Update logs table in bulk
        if updates:
            cursor.executemany(
                "UPDATE logs SET cluster_id = ?, processed = TRUE WHERE id = ?",
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
        affected_workspaces = list(set(ws_id for ws_id, _, _ in cluster_increments.keys()))
        for ws_id in affected_workspaces:
            # BUG-002 Resolution: Use explicit parameter for comparison to avoid stale subquery value
            cursor.execute(
                "SELECT COUNT(*) FROM logs WHERE workspace_id = ? AND processed = TRUE", 
                (ws_id,)
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
                WHERE workspace_id = ? AND status IN ('pending', 'processing')
                """,
                (processed_now, processed_now, ws_id)
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
            # Find workspaces with active jobs
            cursor.execute("SELECT DISTINCT workspace_id FROM ingestion_jobs WHERE status IN ('pending', 'processing')")
            workspaces = [row[0] for row in cursor.fetchall()]
            
            for ws_id in workspaces:
                # If there are no more unprocessed logs for this workspace, mark all jobs as completed
                cursor.execute("SELECT COUNT(*) FROM logs WHERE workspace_id = ? AND processed = FALSE", (ws_id,))
                unprocessed = cursor.fetchone()[0]
                
                if unprocessed == 0:
                    # All currently existing logs for this workspace are processed
                    # We sync the processed_lines and mark as completed
                    cursor.execute("SELECT COUNT(*) FROM logs WHERE workspace_id = ? AND processed = TRUE", (ws_id,))
                    processed_now = cursor.fetchone()[0]
                    
                    cursor.execute(
                        """
                        UPDATE ingestion_jobs 
                        SET processed_lines = ?,
                            status = 'completed',
                            updated_at = CURRENT_TIMESTAMP
                        WHERE workspace_id = ? AND status IN ('pending', 'processing')
                        """,
                        (processed_now, ws_id)
                    )
            self.db.commit()
        except Exception as e:
            logger.error(f"[Worker] Job status sync failed: {e}")
