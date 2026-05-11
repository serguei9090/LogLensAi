import re

with open("sidecar/src/api.py", "r", encoding="utf-8") as f:
    content = f.read()

start_idx = content.find("    def method_ingest_logs(self, logs: list[IngestLogEntry]) -> dict:")
end_idx = content.find("    def method_ingest_local_file(self,", start_idx)

new_method = '''    def method_ingest_logs(self, logs: list[any]) -> dict:
        """High-speed synchronous batch ingestion — RAM-First / PyArrow.

        Designed for streaming data (HTTP/Syslog). Runs synchronously as it is
        expected to be called from a background flush worker.
        Does NOT create ingestion jobs.
        """
        import time
        import json

        log_dicts = [log.model_dump() if hasattr(log, "model_dump") else log for log in logs]

        if not log_dicts:
            return {"status": "ok", "count": 0}

        # --- Group by (workspace_id, source_id) ---
        from collections import defaultdict

        grouped: dict[tuple[str, str], list[dict]] = defaultdict(list)
        for log in log_dicts:
            ws = log.get("workspace_id") or "default"
            src = log.get("source_id") or "manual"
            grouped[(ws, src)].append(log)

        now = time.time()
        now_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        db_instance = self.db
        cursor = db_instance.get_cursor()

        # Pre-fetch rules
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

        for (ws_id, src_id), src_logs in grouped.items():
            try:
                rules = self._get_facet_rules_for_workspace(cursor, ws_id, rules_cache, global_rules)

                cursor.execute(
                    "SELECT parser_config, tz_offset FROM fusion_configs WHERE workspace_id = ? AND source_id = ?",
                    (ws_id, src_id),
                )
                row = cursor.fetchone()
                p_config = json.loads(row[0]) if row and row[0] else {}
                p_tz = row[1] if row and row[1] else 0

                parser = self.get_drain_parser(ws_id)

                # 1. Disk-First: write raw lines
                raw_lines = [log.get("raw_text") or log.get("message") or "" for log in src_logs]
                line_ids = self.log_store.append_batch(src_id, raw_lines)

                # 2. Process Chunk in RAM
                batch_data, cluster_increments = self._process_chunk_ram_first(
                    ws_id, src_id, line_ids, raw_lines,
                    parser, rules, p_config, p_tz, now, now_ts
                )

                # 3. Bulk Insert via PyArrow
                if batch_data:
                    self._insert_arrow_batch(cursor, batch_data, cluster_increments)

                db_instance.commit()

                # 4. Broadcast to active overlays
                try:
                    shared_src = self.shared_source_mgr.get_source(src_id)
                    shared_src.push_batch(raw_lines, line_ids)
                except Exception as e:
                    logger.error("[Ingestion] Broadcast failed for %s: %s", src_id, e)

            except Exception as exc:
                logger.exception("[Ingestion] Stream batch failed: %s", exc)

        return {"status": "ok", "count": len(log_dicts)}

'''

content = content[:start_idx] + new_method + content[end_idx:]

with open("sidecar/src/api.py", "w", encoding="utf-8") as f:
    f.write(content)

print("Replaced method_ingest_logs and removed _bg_ingest_logs")
