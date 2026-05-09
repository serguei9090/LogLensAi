import datetime
import ipaddress
import json
import logging
import re
import typing

from db import Database

logger = logging.getLogger(__name__)

# --- Pre-compiled Patterns for Performance ---
RE_LEVEL = re.compile(r"\b(FATAL|ERROR|WARN|DEBUG|TRACE|INFO)\b", re.I)
RE_IPV4 = r"(?:\d{1,3}\.){3}\d{1,3}"
RE_IPV6 = r"(?:(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|:(?::[0-9a-fA-F]{1,4}){1,7}|::)"
RE_IP = re.compile(f"\\b({RE_IPV4}|{RE_IPV6})\\b")
RE_UUID = re.compile(r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b")
RE_EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
RE_HTTP_METHOD = re.compile(r"\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b")
RE_HTTP_STATUS = re.compile(r"status[:\s=]+(\d{3})", re.I)
RE_HOST = re.compile(r"\bhost[:=]([a-zA-Z0-9\.\-]+)\b", re.I)
RE_THREAD = re.compile(r"\[([^\]]{3,20})\]|thread[:=]([\w\-]+)", re.I)
RE_LOGGER = re.compile(r"\b([\w\.]{5,40})[:\s]+(?=[A-Z])|logger[:=]([\w\.]+)")
RE_KV_PAIRS = re.compile(r"\b(\w+)=([\w\-\.@]+)\b")
RE_USER_ID = re.compile(r"user[:_]?id[:\s=]+(\w+)", re.I)

RESERVED_FACETS = {
    "timestamp", "level", "id", "ip", "uuid", "email", "host", 
    "thread", "logger", "method", "status", "user_id"
}


def _extract_base_metadata(
    raw_line: str, 
    parser_config: dict = None, 
    tz_offset: float = 0
) -> tuple[str, str, str]:
    """Extracts timestamp, level, and message using provided configuration."""
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    level = "INFO"
    message = raw_line

    # Generic heuristic for level
    match = RE_LEVEL.search(raw_line)
    if match:
        level = match.group(1).upper()

    if parser_config:
        pattern = parser_config.get("regex")
        if pattern:
            try:
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
                        timestamp = extracted_ts
                        try:
                            # Attempt to parse common formats: YYYY-MM-DD HH:MM:SS
                            dt = datetime.datetime.strptime(timestamp[:19], "%Y-%m-%d %H:%M:%S")
                            if tz_offset != 0:
                                dt = dt + datetime.timedelta(hours=tz_offset)
                                timestamp = dt.strftime("%Y-%m-%d %H:%M:%S")
                        except Exception:
                            pass

                    if "level" in groups:
                        level = groups["level"].upper()
                    if "message" in groups:
                        message = groups["message"]
            except Exception:
                # Fallback to defaults on regex failure
                pass

    return timestamp, level, message


def _extract_heuristic_facets(raw_line: str) -> dict:
    """Extracts common facets using generic heuristics (IPs, UUIDs, methods, etc)."""
    facets = {}

    # 1. IPs
    ip_match = RE_IP.search(raw_line)
    if ip_match:
        try:
            facets["ip"] = str(ipaddress.ip_address(ip_match.group(1)))
        except ValueError:
            pass

    # 2. UUIDs
    uuid_match = RE_UUID.search(raw_line)
    if uuid_match:
        facets["uuid"] = uuid_match.group(0)

    # 3. Emails
    email_match = RE_EMAIL.search(raw_line)
    if email_match:
        facets["email"] = email_match.group(0)

    # 4. HTTP Methods & Status
    method_match = RE_HTTP_METHOD.search(raw_line)
    if method_match:
        facets["method"] = method_match.group(1)

    status_match = RE_HTTP_STATUS.search(raw_line)
    if status_match:
        facets["status"] = status_match.group(1)

    return facets


def _extract_context_facets(raw_line: str, facets: dict):
    """Extracts host, thread, logger information."""
    if "host" not in facets:
        host_match = RE_HOST.search(raw_line)
        if host_match:
            facets["host"] = host_match.group(1)

    if "thread" not in facets:
        thread_match = RE_THREAD.search(raw_line)
        if thread_match:
            val = thread_match.group(1) or thread_match.group(2)
            if val and val.upper() not in ["INFO", "ERROR", "WARN", "DEBUG", "TRACE", "FATAL"]:
                facets["thread"] = val

    if "logger" not in facets:
        logger_match = RE_LOGGER.search(raw_line)
        if logger_match:
            facets["logger"] = logger_match.group(1) or logger_match.group(2)


def _extract_kv_facets(raw_line: str, facets: dict):
    """Extracts general key=value pairs."""
    kv_matches = RE_KV_PAIRS.finditer(raw_line)
    for m in kv_matches:
        key, val = m.groups()
        if key.lower() not in RESERVED_FACETS:
            facets[key.lower()] = val


def _apply_custom_extractions(raw_line: str, custom_rules: list, facets: dict):
    """Applies user-defined regex extraction rules."""
    if not custom_rules:
        return

    for rule in custom_rules:
        if not rule.get("enabled", True):
            continue
        try:
            pattern, name = rule.get("regex"), rule.get("name")
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


def extract_log_metadata(
    raw_line: str, 
    custom_rules: list = None,
    parser_config: dict = None,
    tz_offset: float = 0
) -> dict:
    """
    Applies source-specific regex patterns and timezone normalization to a raw log line.
    Shared by both one-time ingestion and live tailing.
    """
    # 1. Base Metadata
    timestamp, level, message = _extract_base_metadata(raw_line, parser_config, tz_offset)

    # 2. Heuristic Facets
    facets = _extract_heuristic_facets(raw_line)

    # 3. Context Facets
    _extract_context_facets(raw_line, facets)

    # 4. Key-Value Facets
    _extract_kv_facets(raw_line, facets)

    # 5. Specialized (User ID)
    if "user_id" not in facets:
        uid_match = RE_USER_ID.search(raw_line)
        if uid_match:
            facets["user_id"] = uid_match.group(1)

    # 6. Custom Rules
    _apply_custom_extractions(raw_line, custom_rules, facets)

    return {"timestamp": timestamp, "level": level, "message": message, "facets": facets}
