import re

with open('sidecar/src/workers/clustering.py', encoding='utf-8') as f:
    content = f.read()

# Fix collateral damage from previous replace on line 239
# Better: just fix line 240 and 246 to use _line_id
content = content.replace('self._hydrate_log_text(source_id, line_id, raw_text, now)', 'self._hydrate_log_text(source_id, _line_id, raw_text, now)')
content = content.replace('hydrated_rows.append((log_id, ws_id, source_id, line_id, facets_json, hydrated))', 'hydrated_rows.append((log_id, ws_id, source_id, _line_id, facets_json, hydrated))')

# Fix TRY401
content = re.sub(r'logger\.exception\("(\[Worker\] Error in clustering cycle:) %s", e\)', r'logger.exception("\1")', content)
content = re.sub(r'logger\.exception\("(\[Worker\] Train phase failed for log %s:) %s", log_id, e\)', r'logger.exception("\1", log_id)', content)
content = re.sub(r'logger\.exception\("(\[Worker\] Future resolution failed:) %s", e\)', r'logger.exception("\1")', content)
content = re.sub(r'logger\.exception\("(\[Worker\] Transaction failed:) %s", e\)', r'logger.exception("\1")', content)
content = re.sub(r'logger\.exception\("(\[Worker\] Job status sync failed:) %s", e\)', r'logger.exception("\1")', content)

# Fix S110
content = content.replace('except Exception:\n                pass  # noqa: S110', 'except Exception:\n                pass')
content = content.replace('except Exception:\n                pass', 'except Exception:\n                logger.debug("Failed to parse", exc_info=True)')

with open('sidecar/src/workers/clustering.py', 'w', encoding='utf-8') as f:
    f.write(content)
