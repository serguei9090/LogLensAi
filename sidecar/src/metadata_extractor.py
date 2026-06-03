# Assume Role: Backend Engineer (@backend)
import contextlib
import datetime
import logging
import re

logger = logging.getLogger(__name__)

# --- Pre-compiled Patterns for Performance ---
RE_LEVEL = re.compile(r"\b(FATAL|ERROR|WARN|DEBUG|TRACE|INFO)\b", re.I)

# Pre-calculate expected length of each format string using a dummy date
_DUMMY_DATE = datetime.datetime(2000, 10, 10, 12, 12, 12)
FORMAT_LENGTHS = {
    fmt: len(_DUMMY_DATE.strftime(fmt))
    for fmt in [
        "%Y-%m-%d %H:%M:%S",  # ISO 8601 (DB canonical)
        "%Y-%m-%dT%H:%M:%S",  # ISO 8601 with T separator
        "%d/%b/%Y:%H:%M:%S",  # Apache CLF: 17/May/2015:10:05:03
        "%b %d %H:%M:%S",  # Syslog: Jun  1 12:34:56
        "%d/%m/%Y %H:%M:%S",  # European format
        "%m/%d/%Y %H:%M:%S",  # US format
        "%Y/%m/%d %H:%M:%S",  # Alternative ISO
    ]
}

# Auto-detection patterns mapped to their format strings
AUTO_TIMESTAMP_PATTERNS = [
    # 1. ISO 8601 (e.g. 2026-06-02T13:59:46.123Z, 2026-06-02 13:59:46)
    (
        re.compile(
            r"\b(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:?\d{2}|Z)?)\b"
        ),
        "%Y-%m-%d %H:%M:%S",
    ),
    # 2. Apache/Nginx CLF (e.g. 26/May/2015:21:05:15 +0000)
    (
        re.compile(r"(\d{2}/[A-Za-z]{3}/\d{4}:\d{2}:\d{2}:\d{2}(?:\s+[+-]\d{4})?)"),
        "%d/%b/%Y:%H:%M:%S",
    ),
    # 3. Syslog (e.g. Jun  1 12:34:56)
    (re.compile(r"\b([A-Za-z]{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\b"), "%b %d %H:%M:%S"),
    # 4. European/Slashed (e.g. 26/05/2015 21:05:15)
    (re.compile(r"\b(\d{2}[/\-]\d{2}[/\-]\d{4}\s+\d{2}:\d{2}:\d{2})\b"), "%d/%m/%Y %H:%M:%S"),
    # 5. US/Slashed (e.g. 05/26/2015 21:05:15)
    (re.compile(r"\b(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2})\b"), "%m/%d/%Y %H:%M:%S"),
    # 6. Slashed ISO (e.g. 2015/05/26 21:05:15)
    (re.compile(r"\b(\d{4}/\d{2}/\d{2}\s+\d{2}:\d{2}:\d{2})\b"), "%Y/%m/%d %H:%M:%S"),
]


def _parse_timestamp(extracted_ts: str, fmt: str, tz_offset: float) -> str | None:
    # Strip trailing timezone offsets like " +0000" or " -0500" before parsing
    ts_clean = re.sub(r"\s[+-]\d{4}$", "", extracted_ts.strip())
    # Clean T separator if parsing standard spaces
    if fmt == "%Y-%m-%d %H:%M:%S" and "T" in ts_clean:
        ts_clean = ts_clean.replace("T", " ")

    # Check for milliseconds or fraction of a second if %f is not in format
    fraction_sec = 0.0
    if "%f" not in fmt:
        ms_match = re.search(r"[:\d]([.,]\d{1,6})\b", ts_clean)
        if ms_match:
            fraction_str = ms_match.group(1).replace(",", ".")
            with contextlib.suppress(ValueError):
                fraction_sec = float(fraction_str)
            ts_clean = ts_clean.replace(ms_match.group(1), "")

    has_year = "%Y" in fmt or "%y" in fmt
    try:
        if not has_year:
            # Handle syslog style where year is missing (default to current year)
            current_year = datetime.datetime.now().year
            dt = datetime.datetime.strptime(f"{current_year} {ts_clean}", f"%Y {fmt}")
        else:
            slice_len = FORMAT_LENGTHS.get(fmt, len(fmt) + 2)
            dt = datetime.datetime.strptime(ts_clean[:slice_len], fmt)

        if fraction_sec > 0:
            dt = dt + datetime.timedelta(seconds=fraction_sec)

        if tz_offset != 0:
            dt = dt + datetime.timedelta(hours=tz_offset)

        return dt.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    except Exception:
        return None


def _get_timestamp_from_match(
    match: re.Match, tz_offset: float, format_override: str = None
) -> str | None:
    groups = match.groupdict()
    extracted_ts = groups.get("timestamp") or (match.group(1) if match.groups() else match.group(0))

    if not extracted_ts:
        return None

    if format_override:
        return _parse_timestamp(extracted_ts, format_override, tz_offset)

    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%d/%b/%Y:%H:%M:%S",
        "%b %d %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
        "%m/%d/%Y %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
    ]

    for fmt in formats:
        parsed = _parse_timestamp(extracted_ts, fmt, tz_offset)
        if parsed:
            return parsed

    # Last resort: return as-is
    return extracted_ts


def _auto_detect_timestamp(raw_line: str, tz_offset: float) -> str | None:
    for regex, fmt in AUTO_TIMESTAMP_PATTERNS:
        match = regex.search(raw_line)
        if match:
            extracted_ts = match.group(1)
            parsed = _parse_timestamp(extracted_ts, fmt, tz_offset)
            if parsed:
                return parsed
    return None


def _extract_base_metadata(
    raw_line: str, parser_config: dict = None, tz_offset: float = 0
) -> tuple[str, str, str]:
    """Extracts timestamp, level, and message using configuration."""
    timestamp = None
    level = "INFO"
    message = raw_line

    # Generic heuristic for level
    match = RE_LEVEL.search(raw_line)
    if match:
        level = match.group(1).upper()

    parser_config = parser_config or {}

    # Check for custom user-defined timestamp pattern
    custom_regex = parser_config.get("timestamp_regex")
    custom_format = parser_config.get("timestamp_format")
    if custom_regex:
        with contextlib.suppress(Exception):
            match = re.search(custom_regex, raw_line)
            if match:
                timestamp = _get_timestamp_from_match(match, tz_offset, custom_format)

    # Fallback to source-wide regex matching if configured
    if not timestamp and (pattern := parser_config.get("regex")):
        with contextlib.suppress(Exception):
            match = re.search(pattern, raw_line)
            if match:
                groups = match.groupdict()
                timestamp = _get_timestamp_from_match(match, tz_offset)
                level = groups.get("level", level).upper()
                message = groups.get("message", message)

    # Automatic detection fallback if enabled (default is True)
    if not timestamp and parser_config.get("timestamp_auto_detect", True):
        timestamp = _auto_detect_timestamp(raw_line, tz_offset)

    # If no log timestamp was parsed, fall back to current time
    if not timestamp:
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

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
    timestamp, level, message = _extract_base_metadata(
        raw_line, parser_config, tz_offset
    )
    ingest_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    facets = {}

    # 2. Custom Rules
    _apply_custom_extractions(raw_line, custom_rules, facets)

    return {
        "timestamp": timestamp,
        "ingest_timestamp": ingest_timestamp,
        "level": level,
        "message": message,
        "facets": facets,
    }
