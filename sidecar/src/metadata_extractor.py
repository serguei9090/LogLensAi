import datetime
import json
import re

from db import Database


def extract_log_metadata(workspace_id: str, source_id: str, raw_line: str) -> dict:
    """
    Applies source-specific regex patterns and timezone normalization to a raw log line.
    Shared by both one-time ingestion and live tailing.
    """
    # Defaults
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    level = "INFO"

    # Generic heuristic for level
    upper_line = raw_line.upper()
    for lvl in ["FATAL", "ERROR", "WARN", "DEBUG", "TRACE", "INFO"]:
        if lvl in upper_line:
            level = lvl
            break

    # Fetch configuration from DuckDB
    db = Database()
    cursor = db.get_cursor()
    try:
        cursor.execute(
            "SELECT parser_config, tz_offset FROM fusion_configs WHERE workspace_id = ? AND source_id = ?",
            (workspace_id, source_id),
        )
        row = cursor.fetchone()

        if row and row[0]:
            config = json.loads(row[0])
            pattern = config.get("regex")
            if pattern:
                match = re.search(pattern, raw_line)
                if match:
                    groups = match.groupdict()
                    extracted_ts = None
                    if "timestamp" in groups:
                        extracted_ts = groups["timestamp"]
                    elif match.groups():
                        extracted_ts = match.group(1)
                    else:
                        extracted_ts = match.group(0)

                    if extracted_ts:
                        # PARS-004: Basic Timezone Normalization
                        # In a real-world scenario, we'd use a robust parser like dateutil.
                        # For now, if it looks like a standard format, we apply the offset.
                        timestamp = extracted_ts

                        try:
                            # Attempt to parse common formats: YYYY-MM-DD HH:MM:SS
                            # If it matches, we apply the offset to normalize to UTC
                            dt = datetime.datetime.strptime(timestamp[:19], "%Y-%m-%d %H:%M:%S")
                            offset_hrs = row[1] or 0
                            if offset_hrs != 0:
                                dt = dt + datetime.timedelta(hours=offset_hrs)
                                timestamp = dt.strftime("%Y-%m-%d %H:%M:%S")
                        except Exception:
                            pass  # Keep raw extracted string if parsing fails

                    if "level" in groups:
                        level = groups["level"].upper()
    except Exception as e:
        print(f"[MetadataExtractor] Failed to process line from {source_id}: {e}")

    return {"timestamp": timestamp, "level": level}
