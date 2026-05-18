with open("sidecar/src/api.py", encoding="utf-8") as f:
    content = f.read()

start_idx = content.find(
    "    def _bg_ingest_logs(self, workspace_id: str, source_id: str, logs: list[dict], job_id: int):"
)
end_idx = content.find("    def method_ingest_local_file(", start_idx)

# Go back up slightly
end_idx = content.rfind("\n\n", start_idx, end_idx) + 2

new_method = '''    def _bg_ingest_logs(self, workspace_id: str, source_id: str, logs: list[dict], job_id: int):
        """Background worker for batch ingestion (PyArrow Optimized)."""
        import time
        import json
        import pyarrow as pa
        from metadata_extractor import extract_log_metadata

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

            # 1. Disk-First: write raw lines in a single batch call
            raw_lines = [log.get("raw_text") or log.get("message") or "" for log in logs]
            line_ids = self.log_store.append_batch(source_id, raw_lines)

            # 2. Process Chunk in RAM
            batch_data, cluster_increments = self._process_chunk_ram_first(
                workspace_id, source_id, line_ids, raw_lines,
                parser, rules, p_config, p_tz, now, now_ts
            )

            # 3. Bulk Insert via PyArrow
            if batch_data:
                self._insert_arrow_batch(cursor, batch_data, cluster_increments)

            # 4. Mark job completed
            cursor.execute(
                "UPDATE ingestion_jobs SET status = 'completed', processed_lines = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (len(logs), job_id),
            )
            db_instance.commit()

            # 5. Broadcast to active overlays
            try:
                shared_src = self.shared_source_mgr.get_source(source_id)
                shared_src.push_batch(raw_lines, line_ids)
            except Exception as e:
                logger.error("[Ingestion] Broadcast failed for %s: %s", source_id, e)

        except Exception as exc:
            logger.exception("[Ingestion] Failed background batch job %d: %s", job_id, exc)
            try:
                self.db.get_cursor().execute(
                    "UPDATE ingestion_jobs SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (job_id,),
                )
                self.db.commit()
            except Exception:
                pass
'''

content = content[:start_idx] + new_method + content[end_idx:]

with open("sidecar/src/api.py", "w", encoding="utf-8") as f:
    f.write(content)

print("Updated _bg_ingest_logs")
