import sys

with open("sidecar/src/api.py", encoding="utf-8") as f:
    content = f.read()

# Make sure _tag_log_batch is available
if "from workers.clustering import" not in content:
    pass

old_method_sig = "    def _bg_ingest_local_file(self, workspace_id: str, source_id: str, filepath: str, job_id: int):"

start_idx = content.find(old_method_sig)
if start_idx == -1:
    print("Could not find method signature")
    sys.exit(1)

end_idx = content.find("    def method_cleanup_ingestion_jobs", start_idx)
end_idx = len(content) if end_idx == -1 else content.rfind("\n\n", start_idx, end_idx) + 2

new_method = '''    def _bg_ingest_local_file(self, workspace_id: str, source_id: str, filepath: str, job_id: int):
        """Background worker for local file ingestion.

        RAM-First Bulk-Insert Pipeline:
        1. Read chunk
        2. Write FastPath
        3. Train Drain3 on sample
        4. Parallel tag remaining
        5. Bulk Insert fully processed rows
        """
        import time
        from concurrent.futures import ProcessPoolExecutor, as_completed
        from metadata_extractor import extract_log_metadata
        from workers.clustering import _tag_log_batch
        import json

        initial_chunk_size = 5000
        max_chunk_size = 10000
        commit_interval = 10000

        current_chunk_size = initial_chunk_size
        processed_count = 0
        uncommitted_count = 0
        now = time.time()
        now_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        try:
            db_instance = self.db
            cursor = db_instance.get_cursor()

            # Pre-fetch rules and configs
            cursor.execute("SELECT value FROM settings WHERE key = 'facet_extractions'")
            gr = cursor.fetchone()
            global_rules = []
            if gr and gr[0]:
                try:
                    parsed = json.loads(gr[0])
                    global_rules = parsed if isinstance(parsed, list) else []
                except Exception:
                    pass

            rules_cache = {}
            rules = self._get_facet_rules_for_workspace(cursor, workspace_id, rules_cache, global_rules)

            cursor.execute(
                "SELECT parser_config, tz_offset FROM fusion_configs WHERE workspace_id = ? AND source_id = ?",
                (workspace_id, source_id),
            )
            row = cursor.fetchone()
            p_config = json.loads(row[0]) if row and row[0] else {}
            p_tz = row[1] if row and row[1] else 0

            parser = self.get_drain_parser(workspace_id)

            with open(filepath, encoding="utf-8", errors="replace") as f:
                chunk_lines: list[str] = []

                # We can reuse the executor across chunks
                with ProcessPoolExecutor(max_workers=max(1, (os.cpu_count() or 4) - 1)) as executor:
                    for raw_line in f:
                        clean = raw_line.strip()
                        if not clean:
                            continue
                        chunk_lines.append(clean)

                        if len(chunk_lines) >= current_chunk_size:
                            # 1. Write FastPath
                            line_ids = self.log_store.append_batch(source_id, chunk_lines)

                            # 2. Process Chunk
                            batch_data, cluster_increments = self._process_chunk_ram_first(
                                workspace_id, source_id, line_ids, chunk_lines,
                                parser, rules, p_config, p_tz, executor, _tag_log_batch, now, now_ts
                            )

                            # 3. Bulk Insert
                            cursor.executemany(
                                "INSERT INTO logs"
                                " (workspace_id, source_id, line_id, raw_text, timestamp, level, cluster_id, facets, processed)"
                                " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                                batch_data,
                            )
                            for (ws_id, cluster_id, template), count in cluster_increments.items():
                                cursor.execute(
                                    """
                                    INSERT INTO clusters (workspace_id, cluster_id, template, count)
                                    VALUES (?, ?, ?, ?)
                                    ON CONFLICT (workspace_id, cluster_id)
                                    DO UPDATE SET count = clusters.count + excluded.count, template = excluded.template
                                    """,
                                    (ws_id, cluster_id, template, count),
                                )

                            processed_count += len(chunk_lines)
                            uncommitted_count += len(chunk_lines)

                            if uncommitted_count >= commit_interval:
                                cursor.execute(
                                    "UPDATE ingestion_jobs SET processed_lines = ?, status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                                    (processed_count, job_id),
                                )
                                db_instance.commit()
                                uncommitted_count = 0

                            chunk_lines = []
                            current_chunk_size = min(max_chunk_size, current_chunk_size * 2)

                    # Final chunk
                    if chunk_lines:
                        line_ids = self.log_store.append_batch(source_id, chunk_lines)
                        batch_data, cluster_increments = self._process_chunk_ram_first(
                            workspace_id, source_id, line_ids, chunk_lines,
                            parser, rules, p_config, p_tz, executor, _tag_log_batch, now, now_ts
                        )
                        cursor.executemany(
                            "INSERT INTO logs"
                            " (workspace_id, source_id, line_id, raw_text, timestamp, level, cluster_id, facets, processed)"
                            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                            batch_data,
                        )
                        for (ws_id, cluster_id, template), count in cluster_increments.items():
                            cursor.execute(
                                """
                                INSERT INTO clusters (workspace_id, cluster_id, template, count)
                                VALUES (?, ?, ?, ?)
                                ON CONFLICT (workspace_id, cluster_id)
                                DO UPDATE SET count = clusters.count + excluded.count, template = excluded.template
                                """,
                                (ws_id, cluster_id, template, count),
                            )
                        processed_count += len(chunk_lines)

            # Mark job completed
            cursor.execute(
                "UPDATE ingestion_jobs SET status = 'completed', processed_lines = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (processed_count, job_id),
            )
            db_instance.commit()
            logger.info(
                "[Ingestion] Completed background job %d for %s: %d lines",
                job_id,
                workspace_id,
                processed_count,
            )

        except Exception as exc:
            logger.exception("[Ingestion] Failed background job %d: %s", job_id, exc)
            try:
                cursor = self.db.get_cursor()
                cursor.execute(
                    "UPDATE ingestion_jobs SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (job_id,),
                )
                self.db.commit()
            except Exception:
                pass

    def _process_chunk_ram_first(
        self, workspace_id: str, source_id: str, line_ids: list[int], chunk_lines: list[str],
        parser, rules, p_config, p_tz, executor, tag_func, now, now_ts
    ):
        import json
        import os
        from metadata_extractor import extract_log_metadata
        from concurrent.futures import as_completed

        TRAIN_SAMPLE_SIZE = 200
        cluster_increments = {}
        batch_data = []

        train_lines = chunk_lines[:TRAIN_SAMPLE_SIZE]
        train_ids = line_ids[:TRAIN_SAMPLE_SIZE]

        tag_lines = chunk_lines[TRAIN_SAMPLE_SIZE:]
        tag_ids = line_ids[TRAIN_SAMPLE_SIZE:]

        # Phase 1: Train
        for i, raw_text in enumerate(train_lines):
            meta = extract_log_metadata(raw_text, custom_rules=rules, parser_config=p_config, tz_offset=p_tz)
            res = parser.parse(meta["message"])
            cluster_id, template = res["cluster_id"], res["template"]

            if "facets" in res:
                meta["facets"].update(res["facets"])

            key = (workspace_id, cluster_id, template)
            cluster_increments[key] = cluster_increments.get(key, 0) + 1

            batch_data.append((
                workspace_id,
                source_id,
                train_ids[i],
                raw_text,
                meta["timestamp"] or now_ts,
                meta["level"] or "INFO",
                cluster_id,
                json.dumps(meta["facets"]),
                True, # processed = True
            ))

        # Phase 2: Tag
        if tag_lines:
            cluster_map = {c.cluster_id: c for c in parser.get_clusters()}
            miner_config = parser.miner.config

            # Prepare rows for tagging: (log_id, ws_id, source_id, line_id, facets_json, raw_text)
            # log_id doesn't exist yet, pass None
            tag_rows = [
                (None, workspace_id, source_id, tag_ids[i], "{}", tag_lines[i])
                for i in range(len(tag_lines))
            ]

            chunk_size = max(100, len(tag_rows) // max(1, (os.cpu_count() or 4) - 1))
            futures = []
            for i in range(0, len(tag_rows), chunk_size):
                chunk = tag_rows[i : i + chunk_size]
                fut = executor.submit(
                    tag_func, chunk, cluster_map, miner_config, rules, p_config, p_tz, now
                )
                futures.append(fut)

            for fut in as_completed(futures):
                try:
                    batch_results = fut.result()
                    for result in batch_results:
                        status = result["status"]
                        line_id = result.get("line_id")
                        raw_text = result.get("raw_text")

                        if status == "ok":
                            cluster_id = result["cluster_id"]
                            template = result["template"]

                            if cluster_id and template:
                                key = (workspace_id, cluster_id, template)
                                cluster_increments[key] = cluster_increments.get(key, 0) + 1

                            batch_data.append((
                                workspace_id,
                                source_id,
                                line_id,
                                raw_text,
                                result["timestamp"] or now_ts,
                                result["level"] or "INFO",
                                cluster_id,
                                result["facets_json"],
                                True, # processed = True
                            ))
                        else:
                            # Still insert it, just without cluster
                            batch_data.append((
                                workspace_id,
                                source_id,
                                line_id,
                                raw_text,
                                now_ts,
                                "INFO",
                                None,
                                "{}",
                                True,
                            ))
                except Exception:
                    pass

        return batch_data, cluster_increments
'''

content = content[:start_idx] + new_method + content[end_idx:]

with open("sidecar/src/api.py", "w", encoding="utf-8") as f:
    f.write(content)
