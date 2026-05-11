import contextlib
import datetime
import logging
import re

logger = logging.getLogger(__name__)

# --- Pre-compiled Patterns for Performance ---
RE_LEVEL = re.compile(r"\b(FATAL|ERROR|WARN|DEBUG|TRACE|INFO)\b", re.I)


def _get_timestamp_from_match(match: re.Match, tz_offset: float) -> str | None:
    groups = match.groupdict()
    extracted_ts = groups.get("timestamp") or (match.group(1) if match.groups() else match.group(0))

    if not extracted_ts:
        return None

    try:
        # Attempt to parse common formats: YYYY-MM-DD HH:MM:SS
        dt = datetime.datetime.strptime(extracted_ts[:19], "%Y-%m-%d %H:%M:%S")
        if tz_offset != 0:
            dt = dt + datetime.timedelta(hours=tz_offset)
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return extracted_ts


def _extract_base_metadata(
    raw_line: str, parser_config: dict = None, tz_offset: float = 0
) -> tuple[str, str, str]:
    """Extracts timestamp, level, and message using provided configuration."""
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    level = "INFO"
    message = raw_line

    # Generic heuristic for level
    match = RE_LEVEL.search(raw_line)
    if match:
        level = match.group(1).upper()

    if parser_config and (pattern := parser_config.get("regex")):
        with contextlib.suppress(Exception):
            match = re.search(pattern, raw_line)
            if match:
                groups = match.groupdict()
                timestamp = _get_timestamp_from_match(match, tz_offset) or timestamp
                level = groups.get("level", level).upper()
                message = groups.get("message", message)

    return timestamp, level, message


def _apply_custom_extractions(raw_line: str, custom_rules: list, facets: dict):
    """Applies user-defined regex extraction rules."""
    if not custom_rules:
        return

    for rule in custom_rules:
        if not rule.get("enabled", True):
            continue
        _apply_single_custom_rule(raw_line, rule, facets)


def _apply_single_custom_rule(raw_line: str, rule: dict, facets: dict):
    try:
        pattern = rule.get("regex")
        name = rule.get("name")
        group = rule.get("group", 1)
        if not pattern or not name:
            return

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
    raw_line: str, custom_rules: list = None, parser_config: dict = None, tz_offset: float = 0
) -> dict:
    """
    Applies source-specific regex patterns and timezone normalization to a raw log line.
    """
    # 1. Base Metadata
    timestamp, level, message = _extract_base_metadata(raw_line, parser_config, tz_offset)

    facets = {}

    # 2. Custom Rules
    _apply_custom_extractions(raw_line, custom_rules, facets)

    return {"timestamp": timestamp, "level": level, "message": message, "facets": facets}
