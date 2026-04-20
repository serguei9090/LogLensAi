import datetime
import ipaddress
import json
import logging
import re

from db import Database


def extract_log_metadata(
    workspace_id: str, source_id: str, raw_line: str, custom_rules: list = None
) -> dict:
    """
    Applies source-specific regex patterns and timezone normalization to a raw log line.
    Shared by both one-time ingestion and live tailing.
    """
    # Defaults
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    level = "INFO"
    message = raw_line

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
                        timestamp = extracted_ts

                        try:
                            # Attempt to parse common formats: YYYY-MM-DD HH:MM:SS
                            dt = datetime.datetime.strptime(timestamp[:19], "%Y-%m-%d %H:%M:%S")
                            offset_hrs = row[1] or 0
                            if offset_hrs != 0:
                                dt = dt + datetime.timedelta(hours=offset_hrs)
                                timestamp = dt.strftime("%Y-%m-%d %H:%M:%S")
                        except Exception:
                            pass  # Keep raw extracted string if parsing fails

                    if "level" in groups:
                        level = groups["level"].upper()

                    if "message" in groups:
                        message = groups["message"]
    except Exception as e:
        logging.getLogger("LogLensSidecar").error(
            "Failed to process line from %s: %s", source_id, e
        )

    # --- Facet Extraction (Generic Heuristics) ---
    facets = {}

    # 1. IP Addresses (IPv4 and IPv6)
    ipv4_pattern = r"\b(?:\d{1,3}\.){3}\d{1,3}\b"
    ipv6_pattern = r"\b(?:(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|:(?::[0-9a-fA-F]{1,4}){1,7}|::)\b"

    candidates = re.findall(f"{ipv4_pattern}|{ipv6_pattern}", message)
    for cand in candidates:
        try:
            ip_obj = ipaddress.ip_address(cand)
            facets["ip"] = str(ip_obj)
            break
        except ValueError:
            continue

    # 2. UUIDs
    uuid_match = re.search(
        r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b", raw_line
    )
    if uuid_match:
        facets["uuid"] = uuid_match.group(0)

    # 3. Emails
    email_match = re.search(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", raw_line)
    if email_match:
        facets["email"] = email_match.group(0)

    # 4. Key=Value pairs
    kv_matches = re.finditer(r"\b(\w+)=([\w\-\.@]+)\b", raw_line)
    for m in kv_matches:
        key, val = m.groups()
        if key.lower() not in ["timestamp", "level", "id", "ip", "uuid", "email"]:
            facets[key.lower()] = val

    # 5. Specialized common fields
    if "user_id" not in facets:
        uid_match = re.search(r"user[:_]?id[:\s=]+(\w+)", raw_line, re.I)
        if uid_match:
            facets["user_id"] = uid_match.group(1)

    if "status" not in facets:
        status_match = re.search(r"status[:\s=]+(\d{3})", raw_line, re.I)
        if status_match:
            facets["status"] = status_match.group(1)

    # --- 6. Custom Facet Extraction (Regex) ---
    if custom_rules:
        for rule in custom_rules:
            if not rule.get("enabled", True):
                continue

            try:
                pattern = rule.get("regex")
                name = rule.get("name")
                group = rule.get("group", 1)

                if not pattern or not name:
                    continue

                match = re.search(pattern, raw_line)
                if match:
                    if match.groupdict() and name in match.groupdict():
                        facets[name] = match.group(name)
                    else:
                        facets[name] = match.group(group)
            except Exception as e:
                logging.getLogger("LogLensSidecar").debug(
                    "Custom extraction rule %s failed: %s", rule.get("name"), e
                )

    return {"timestamp": timestamp, "level": level, "message": message, "facets": facets}
