# Assume Role: Backend Engineer (@backend)
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


class StaleCacheError(Exception):
    def __init__(self, workspace_id: str, version: int):
        self.workspace_id = workspace_id
        self.version = version
        super().__init__(f"Stale cache for {workspace_id}: expected version {version}")


# Process-local cache for reconstructed TemplateMiner instances
_worker_cluster_cache: dict[str, tuple[int, Any]] = {}

# ---------------------------------------------------------------------------
# Configuration constants
# ---------------------------------------------------------------------------
TRAIN_SAMPLE_SIZE = 200  # rows processed by the main thread to update the tree
MAX_PARALLEL_WORKERS = max(1, (os.cpu_count() or 4) - 1)  # leave one core for I/O


# ---------------------------------------------------------------------------
# Top-level picklable worker function (must live at module scope)
# ---------------------------------------------------------------------------
def _match_and_extract_parameters(
    temp_miner: Any, message: str, meta_facets: dict
) -> tuple[str | None, str | None]:
    """Matches message against the template miner and extracts parameters into meta_facets."""
    if not temp_miner:
        return None, None

    match_result = temp_miner.match(message)
    if not match_result:
        return None, None

    cluster_id = str(match_result.cluster_id)
    template = match_result.get_template()
    try:
        params = temp_miner.extract_parameters(template, message, exact_matching=False)
        if params:
            for param in params:
                mask_key = param.mask_name.strip("<>").lower()
                if mask_key != "*":
                    meta_facets[mask_key] = param.value
    except Exception:
        pass
    return cluster_id, template


def _tag_single_row(
    row: tuple,
    temp_miner: Any,
    rules: list,
    p_config: dict,
    p_tz: int,
) -> dict:
    log_id, ws_id, source_id, _line_id, facets_json, raw_text = row
    if not raw_text:
        return {"status": "missing", "log_id": log_id, "ws_id": ws_id, "source_id": source_id}

    try:
        meta = extract_log_metadata(
            raw_text, custom_rules=rules, parser_config=p_config, tz_offset=p_tz
        )

        # Merge pre-existing facets
        existing_facets = json.loads(facets_json) if facets_json else {}
        meta["facets"].update(existing_facets)

        cluster_id, template = _match_and_extract_parameters(
            temp_miner, meta["message"], meta["facets"]
        )

        return {
            "status": "ok",
            "log_id": log_id,
            "ws_id": ws_id,
            "source_id": source_id,
            "line_id": _line_id,
            "raw_text": raw_text,
            "cluster_id": cluster_id,
            "template": template,
            "timestamp": meta["timestamp"],
            "level": meta["level"],
            "facets_json": json.dumps(meta["facets"]),
        }

    except Exception as exc:
        logger.debug("Failed to parse", exc_info=True)
        return {
            "status": "error",
            "log_id": log_id,
            "ws_id": ws_id,
            "source_id": source_id,
            "line_id": _line_id,
            "raw_text": raw_text,
            "error": str(exc),
            "facets_json": facets_json,
        }


def _tag_log_batch(  # noqa: PLR0913
    rows: list[tuple],
    cluster_map: dict | None,
    miner_config: Any,
    rules: list,
    p_config: dict,
    p_tz: int,
    _now: float,
    cluster_version: int = 0,
) -> list[dict]:
    """
    Pure, picklable function executed in a child process.

    Performs metadata extraction and cluster-matching against a snapshot of
    the Drain tree for a batch of rows. It reconstructs or retrieves a cached,
    in-memory TemplateMiner to leverage the official `match` logic.

    Never writes to the Drain tree or the database.

    Returns a list of result dicts with keys:
      - log_id, ws_id, source_id, cluster_id, template, timestamp, level,
        facets_json, status ('ok' | 'missing' | 'error')
    """
    global _worker_cluster_cache

    ws_id = rows[0][1] if rows else "default"

    cached = _worker_cluster_cache.get(ws_id)
    if not cached or cached[0] < cluster_version:
        if cluster_map is None:
            # We don't have the map, and cache is missing/stale -> request full map
            raise StaleCacheError(ws_id, cluster_version)

        temp_miner = TemplateMiner(config=miner_config)
        for c in cluster_map.values():
            temp_miner.drain.id_to_cluster[c.cluster_id] = c
            temp_miner.drain.add_seq_to_prefix_tree(temp_miner.drain.root_node, c)

        _worker_cluster_cache[ws_id] = (cluster_version, temp_miner)
    else:
        temp_miner = cached[1]

    return [_tag_single_row(row, temp_miner, rules, p_config, p_tz) for row in rows]


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
                    self._stop_event.wait(current_interval)
                elif self.mode == "burst":
                    self._stop_event.wait(current_interval)
                else:
                    self._stop_event.wait(0.1)

            except Exception:
                logger.exception("[Worker] Error in clustering cycle:")
                self._stop_event.wait(self.interval * 2)

    # ------------------------------------------------------------------
    # Batch processing — Train-then-Tag
    # ------------------------------------------------------------------

    def _select_unprocessed_logs(self, cursor: Any, limit: int) -> list:
        try:
            cursor.execute(
                "SELECT id, workspace_id, source_id, line_id, facets, raw_text FROM logs WHERE processed = FALSE ORDER BY id ASC LIMIT ?",  # noqa: E501
                (limit,),
            )
            return cursor.fetchall()
        except Exception as e:
            if "Table with name logs does not exist" in str(e):
                return []
            raise e

    def _hydrate_batch_rows(self, batch: list, now: float, updates: list) -> list:
        hydrated_rows = []
        sources_to_hydrate: dict[str, list[tuple]] = {}
        for row in batch:
            if row[5] is None:
                sources_to_hydrate.setdefault(row[2], []).append(row)
            else:
                hydrated_rows.append(row)

        for source_id, rows in sources_to_hydrate.items():
            if self._quarantine.get(source_id, 0) > now:
                continue

            line_ids = [r[3] for r in rows]
            raw_texts = self.app.fast_path.get_lines(source_id, line_ids)

            for i, raw in enumerate(raw_texts):
                row = rows[i]
                if raw is None:
                    self._quarantine[source_id] = now + 5.0
                    updates.append((None, "MISSING", "{}", None, row[0]))
                    continue
                hydrated_rows.append((row[0], row[1], row[2], row[3], row[4], raw))
        return hydrated_rows

    def _train_single_row(
        self,
        row: tuple,
        cursor: Any,
        rules_cache: dict,
        global_rules: list,
        parser_configs: dict,
        updates: list,
        cluster_increments: dict,
        batch_counts: dict,
    ):
        log_id, ws_id, source_id, _line_id, facets_json, raw_text = row
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
            res = parser.parse(meta["message"])
            cluster_id, template = res["cluster_id"], res["template"]
            if "facets" in res:
                meta["facets"].update(res["facets"])

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

    def _tag_rows_sync(
        self,
        tag_rows: list,
        cursor: Any,
        rules_cache: dict,
        global_rules: list,
        parser_configs: dict,
        now: float,
        updates: list,
        cluster_increments: dict,
        batch_counts: dict,
    ):
        t_tag_start = time.time()
        ws_id = tag_rows[0][1]
        parser = self.app.get_drain_parser(ws_id)
        cluster_map = {c.cluster_id: c for c in parser.get_clusters()}
        miner_config = parser.miner.config

        rules = self.app._get_facet_rules_for_workspace(  # noqa: SLF001
            cursor, ws_id, rules_cache, global_rules
        )
        p_config, p_tz = self._get_parser_config(cursor, ws_id, tag_rows[0][2], parser_configs)

        batch_results = _tag_log_batch(
            tag_rows, cluster_map, miner_config, rules, p_config, p_tz, now
        )

        for result in batch_results:
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

        t_tag_total = time.time() - t_tag_start
        logger.info(
            "[Worker] SYNC Tagging Phase: %d lines in %.4fs (%.2f lines/sec)",
            len(tag_rows),
            t_tag_total,
            len(tag_rows) / t_tag_total if t_tag_total > 0 else 0,
        )

    def _process_single_tag_result(
        self,
        result: dict,
        updates: list,
        cluster_increments: dict,
        batch_counts: dict,
    ):
        """Processes a single tag result from a parallel chunk worker."""
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
                "[Worker] Tag worker error for log %s: %s",
                log_id,
                result.get("error"),
            )
            updates.append((None, "ERROR", result.get("facets_json"), None, log_id))

    def _handle_stale_cache(
        self,
        sce: StaleCacheError,
        meta: dict,
        futures_meta: dict,
        pending: list,
    ):
        """Handles StaleCacheError by resubmitting the future with the full cluster map."""
        logger.debug(
            "[Worker] Stale cache encountered for %s (v%d). Re-submitting with full cluster map.",
            sce.workspace_id,
            sce.version,
        )
        assert self._executor is not None, "ProcessPoolExecutor is not initialized"
        new_fut = self._executor.submit(
            _tag_log_batch,
            meta["chunk"],
            meta["cluster_map"],
            meta["miner_config"],
            meta["rules"],
            meta["p_config"],
            meta["p_tz"],
            meta["now"],
            meta["version"],
        )
        futures_meta[new_fut] = meta
        pending.append(new_fut)
        if not hasattr(self, "_last_submitted_versions"):
            self._last_submitted_versions = {}
        self._last_submitted_versions[sce.workspace_id] = sce.version

    def _process_parallel_results(
        self,
        futures_meta: dict,
        updates: list,
        cluster_increments: dict,
        batch_counts: dict,
    ):
        """Iterates over futures and processes results as they complete."""
        pending = list(futures_meta.keys())
        while pending:
            done_futures = as_completed(pending)
            for fut in done_futures:
                pending.remove(fut)
                meta = futures_meta[fut]
                try:
                    batch_results = fut.result()
                    for result in batch_results:
                        self._process_single_tag_result(
                            result, updates, cluster_increments, batch_counts
                        )
                except StaleCacheError as sce:
                    self._handle_stale_cache(sce, meta, futures_meta, pending)
                    break
                except Exception:
                    logger.exception("[Worker] Future resolution failed:")

    def _tag_rows_parallel(
        self,
        tag_rows: list,
        cursor: Any,
        rules_cache: dict,
        global_rules: list,
        parser_configs: dict,
        now: float,
        updates: list,
        cluster_increments: dict,
        batch_counts: dict,
    ):
        assert self._executor is not None, "ProcessPoolExecutor is not initialized"
        t_tag_start = time.time()
        ws_source_groups: dict[tuple, list] = {}
        for row in tag_rows:
            key = (row[1], row[2])
            ws_source_groups.setdefault(key, []).append(row)

        if not hasattr(self, "_cluster_versions"):
            self._cluster_versions = {}
        if not hasattr(self, "_last_submitted_versions"):
            self._last_submitted_versions = {}

        futures_meta = {}
        for (ws_id, source_id), rows in ws_source_groups.items():
            parser = self.app.get_drain_parser(ws_id)
            cluster_map = {c.cluster_id: c for c in parser.get_clusters()}
            rules = self.app._get_facet_rules_for_workspace(  # noqa: SLF001
                cursor, ws_id, rules_cache, global_rules
            )
            p_config, p_tz = self._get_parser_config(cursor, ws_id, source_id, parser_configs)

            version = self._cluster_versions.get(ws_id, 0)
            last_sent = self._last_submitted_versions.get(ws_id)

            if last_sent is None or last_sent < version:
                cluster_map_to_send = cluster_map
                self._last_submitted_versions[ws_id] = version
            else:
                cluster_map_to_send = None

            miner_config = parser.miner.config
            chunk_size = max(500, len(rows) // MAX_PARALLEL_WORKERS)
            for i in range(0, len(rows), chunk_size):
                chunk = rows[i : i + chunk_size]
                fut = self._executor.submit(
                    _tag_log_batch,
                    chunk,
                    cluster_map_to_send,
                    miner_config,
                    rules,
                    p_config,
                    p_tz,
                    now,
                    version,
                )
                futures_meta[fut] = {
                    "chunk": chunk,
                    "cluster_map": cluster_map,
                    "miner_config": miner_config,
                    "rules": rules,
                    "p_config": p_config,
                    "p_tz": p_tz,
                    "now": now,
                    "version": version,
                }

        self._process_parallel_results(futures_meta, updates, cluster_increments, batch_counts)

        t_tag_total = time.time() - t_tag_start
        logger.info(
            "[Worker] PARALLEL Tagging Phase: %d lines in %.4fs (%.2f lines/sec)",
            len(tag_rows),
            t_tag_total,
            len(tag_rows) / t_tag_total if t_tag_total > 0 else 0,
        )

    def _train_batch(
        self,
        train_rows: list,
        cursor: Any,
        rules_cache: dict,
        global_rules: list,
        parser_configs: dict,
        updates: list,
        cluster_increments: dict,
        batch_counts: dict,
    ):
        """Processes training rows to update the Drain tree."""
        trained_workspaces = set()
        for row in train_rows:
            ws_id = row[1]
            trained_workspaces.add(ws_id)
            self._train_single_row(
                row,
                cursor,
                rules_cache,
                global_rules,
                parser_configs,
                updates,
                cluster_increments,
                batch_counts,
            )

        if not hasattr(self, "_cluster_versions"):
            self._cluster_versions = {}
        for ws_id in trained_workspaces:
            self._cluster_versions[ws_id] = self._cluster_versions.get(ws_id, 0) + 1

    def _tag_batch(
        self,
        tag_rows: list,
        cursor: Any,
        rules_cache: dict,
        global_rules: list,
        parser_configs: dict,
        now: float,
        updates: list,
        cluster_increments: dict,
        batch_counts: dict,
    ):
        """Processes tagging rows, either synchronously or in parallel."""
        if not tag_rows:
            return

        bypass_parallel = os.environ.get("BYPASS_PARALLEL_TAG") == "1"
        if bypass_parallel:
            self._tag_rows_sync(
                tag_rows,
                cursor,
                rules_cache,
                global_rules,
                parser_configs,
                now,
                updates,
                cluster_increments,
                batch_counts,
            )
        elif self._executor is not None:
            self._tag_rows_parallel(
                tag_rows,
                cursor,
                rules_cache,
                global_rules,
                parser_configs,
                now,
                updates,
                cluster_increments,
                batch_counts,
            )

    def _process_batch(self, batch_size: int | None = None) -> int:
        cursor = self.db.get_cursor()
        limit = batch_size or self.batch_size

        if not hasattr(self, "_quarantine"):
            self._quarantine = {}

        t0 = time.time()
        batch = self._select_unprocessed_logs(cursor, limit)
        t_select = time.time()
        if t_select - t0 > 0.05:
            logger.info(f"[Clustering] SELECT took {t_select - t0:.3f}s for limit {limit}")

        if not batch:
            return 0

        logger.debug("[Worker] Processing batch of %d logs...", len(batch))
        rules_cache, global_rules = {}, self._get_global_rules(cursor)
        updates: list = []
        cluster_increments: dict = {}
        batch_counts: dict = {}
        parser_configs: dict = {}
        now = time.time()

        # Phase 0: Hydrate
        hydrated_rows = self._hydrate_batch_rows(batch, now, updates)
        t_hydrate_end = time.time()
        if t_hydrate_end - t_select > 0.05:
            logger.info(f"[Clustering] Hydration took {t_hydrate_end - t_select:.3f}s")

        if not hydrated_rows:
            if updates:
                self._apply_batch_updates(cursor, updates, cluster_increments)
                self._update_ingestion_jobs(cursor, batch_counts)
                self.db.commit()
            return len(batch)

        # Phase 1: Train
        train_rows = hydrated_rows[:TRAIN_SAMPLE_SIZE]
        tag_rows = hydrated_rows[TRAIN_SAMPLE_SIZE:]
        self._train_batch(
            train_rows,
            cursor,
            rules_cache,
            global_rules,
            parser_configs,
            updates,
            cluster_increments,
            batch_counts,
        )

        # Phase 2: Tag
        self._tag_batch(
            tag_rows,
            cursor,
            rules_cache,
            global_rules,
            parser_configs,
            now,
            updates,
            cluster_increments,
            batch_counts,
        )

        # Phase 3: Aggregation
        if updates:
            t_agg_start = time.time()
            self._apply_batch_updates(cursor, updates, cluster_increments)
            t_agg_total = time.time() - t_agg_start
            logger.info(
                "[Worker] Aggregation Phase: %.4fs for %d updates", t_agg_total, len(updates)
            )

        self._update_ingestion_jobs(cursor, batch_counts)
        self.db.commit()
        return len(batch)

    # ------------------------------------------------------------------
    # Database helpers
    # ------------------------------------------------------------------

    def _apply_batch_updates(self, cursor: Any, updates: list, cluster_increments: dict):
        """Applies batch updates to logs and clusters tables atomically."""
        if not updates and not cluster_increments:
            return

        t_start = time.time()

        # Performance Trick: In DuckDB, row-by-row updates are slow.
        # Vectorized updates via a temporary table are significantly faster.
        cursor.execute("BEGIN TRANSACTION")
        try:
            if updates:
                # 1. Create a schema-matched temporary table (use VARCHAR for flexible inputs)
                cursor.execute(
                    "CREATE TEMPORARY TABLE updates_temp (ts VARCHAR, lvl VARCHAR, fcts VARCHAR, cid VARCHAR, lid BIGINT)"
                )

                # 2. Bulk insert into the temp table (no indexes = fast)
                cursor.executemany("INSERT INTO updates_temp VALUES (?, ?, ?, ?, ?)", updates)

                # 3. Perform a vectorized JOIN update
                cursor.execute("""
                    UPDATE logs 
                    SET timestamp = COALESCE(updates_temp.ts, logs.timestamp),
                        level = updates_temp.lvl,
                        facets = updates_temp.fcts::JSON,
                        cluster_id = updates_temp.cid,
                        processed = TRUE
                    FROM updates_temp
                    WHERE logs.id = updates_temp.lid
                """)

                # 3.5. Incrementally update pre-aggregated hourly stats
                cursor.execute("""
                    INSERT INTO hourly_cluster_counts (workspace_id, cluster_id, hour_bucket, count)
                    SELECT 
                        logs.workspace_id,
                        updates_temp.cid,
                        SUBSTRING(REPLACE(COALESCE(updates_temp.ts, logs.timestamp), 'T', ' '), 1, 13) as hr,
                        COUNT(*)
                    FROM updates_temp
                    JOIN logs ON logs.id = updates_temp.lid
                    WHERE updates_temp.cid IS NOT NULL AND COALESCE(updates_temp.ts, logs.timestamp) IS NOT NULL
                    GROUP BY logs.workspace_id, updates_temp.cid, hr
                    ON CONFLICT (workspace_id, cluster_id, hour_bucket)
                    DO UPDATE SET count = count + excluded.count
                """)

                # 4. Clean up
                cursor.execute("DROP TABLE updates_temp")

            t_logs_end = time.time()

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

        t_end = time.time()
        if t_end - t_start > 0.1:
            logger.info(
                f"[Clustering] Aggregation Phase: {t_end - t_start:.4f}s for {len(updates)} updates "
                f"(Logs: {t_logs_end - t_start:.4f}s, Clusters: {t_end - t_logs_end:.4f}s)"
            )

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
            try:
                cursor.execute(
                    "SELECT workspace_id, source_id FROM ingestion_jobs WHERE status IN ('pending', 'processing')"  # noqa: E501
                )
            except Exception as e:
                if "Table with name ingestion_jobs does not exist" in str(e):
                    return
                raise e
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
