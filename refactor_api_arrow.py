import re

with open("sidecar/src/api.py", "r", encoding="utf-8") as f:
    content = f.read()

start_idx = content.find("def _bg_ingest_local_file(")
end_idx = content.find("def method_cleanup_ingestion_jobs", start_idx)

# Find end of method correctly
end_idx = content.rfind("\n\n", start_idx, end_idx) + 2

new_methods = '''    def _bg_ingest_local_file(self, workspace_id: str, source_id: str, filepath: str, job_id: int):
        """Background worker for local file ingestion.

        RAM-First Bulk-Insert Pipeline (PyArrow Optimized):
        1. Read chunk
        2. Write FastPath
        3. Train & Tag Drain3 in RAM (Single Thread)
        4. Bulk Insert fully processed rows via PyArrow
        """
        import time
        import json
        import pyarrow as pa
        from metadata_extractor import extract_log_metadata

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

                for raw_line in f:
                    clean = raw_line.strip()
                    if not clean:
                        continue
                    chunk_lines.append(clean)

                    if len(chunk_lines) >= current_chunk_size:
                        # 1. Write FastPath
                        line_ids = self.log_store.append_batch(source_id, chunk_lines)

                        # 2. Process Chunk in RAM
                        batch_data, cluster_increments = self._process_chunk_ram_first(
                            workspace_id, source_id, line_ids, chunk_lines,
                            parser, rules, p_config, p_tz, now, now_ts
                        )

                        # 3. Bulk Insert via PyArrow
                        if batch_data:
                            self._insert_arrow_batch(cursor, batch_data, cluster_increments)

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
                        parser, rules, p_config, p_tz, now, now_ts
                    )
                    if batch_data:
                        self._insert_arrow_batch(cursor, batch_data, cluster_increments)
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
        parser, rules, p_config, p_tz, now, now_ts
    ):
        import json
        from metadata_extractor import extract_log_metadata

        TRAIN_SAMPLE_SIZE = 200
        cluster_increments = {}
        batch_data = []

        train_lines = chunk_lines[:TRAIN_SAMPLE_SIZE]
        train_ids = line_ids[:TRAIN_SAMPLE_SIZE]

        tag_lines = chunk_lines[TRAIN_SAMPLE_SIZE:]
        tag_ids = line_ids[TRAIN_SAMPLE_SIZE:]

        # Phase 1: Train on sample
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

        # Phase 2: Tag remaining sequentially
        if tag_lines:
            for i, raw_text in enumerate(tag_lines):
                meta = extract_log_metadata(raw_text, custom_rules=rules, parser_config=p_config, tz_offset=p_tz)
                match = parser.match(meta["message"])

                cluster_id = None
                template = None

                if match:
                    cluster_id = str(match["cluster_id"])
                    template = match["template"]

                    try:
                        params = parser.miner.extract_parameters(template, meta["message"], exact_matching=False)
                        if params:
                            for p in params:
                                meta["facets"][p.mask_name.strip("<>").lower()] = p.value
                    except Exception:
                        pass

                    key = (workspace_id, cluster_id, template)
                    cluster_increments[key] = cluster_increments.get(key, 0) + 1

                batch_data.append((
                    workspace_id,
                    source_id,
                    tag_ids[i],
                    raw_text,
                    meta["timestamp"] or now_ts,
                    meta["level"] or "INFO",
                    cluster_id,
                    json.dumps(meta["facets"]),
                    True, # processed = True
                ))

        return batch_data, cluster_increments

    def _insert_arrow_batch(self, cursor, batch_data, cluster_increments):
        import pyarrow as pa
        cursor.execute("BEGIN TRANSACTION")

        # PyArrow logs table
        cols = list(zip(*batch_data))
        arrow_logs = pa.Table.from_arrays(
            [pa.array(c) for c in cols],
            names=['workspace_id', 'source_id', 'line_id', 'raw_text', 'timestamp', 'level', 'cluster_id', 'facets', 'processed']
        )

        cursor.execute("INSERT INTO logs (workspace_id, source_id, line_id, raw_text, timestamp, level, cluster_id, facets, processed) SELECT * FROM arrow_logs")

        # PyArrow clusters table
        cluster_data = [(w, c, t, count) for (w, c, t), count in cluster_increments.items()]
        if cluster_data:
            c_cols = list(zip(*cluster_data))
            arrow_clusters = pa.Table.from_arrays(
                [pa.array(c) for c in c_cols],
                names=['workspace_id', 'cluster_id', 'template', 'count']
            )
            cursor.execute("CREATE TEMP TABLE temp_clusters AS SELECT * FROM arrow_clusters")
            cursor.execute("""
                INSERT INTO clusters (workspace_id, cluster_id, template, count)
                SELECT workspace_id, cluster_id, template, count FROM temp_clusters
                ON CONFLICT (workspace_id, cluster_id)
                DO UPDATE SET count = clusters.count + excluded.count, template = excluded.template
            """)
            cursor.execute("DROP TABLE temp_clusters")

        cursor.execute("COMMIT")

'''

new_content = content[:start_idx] + new_methods + content[end_idx:]

with open("sidecar/src/api.py", "w", encoding="utf-8") as f:
    f.write(new_content)

print("api.py updated with PyArrow ingestion pipeline!")
