# Assume Role: Backend Engineer (@backend)
import contextlib
import datetime
import logging
import re

logger = logging.getLogger(__name__)

# --- Pre-compiled Patterns for Performance ---
RE_LEVEL = re.compile(r"\b(FATAL|ERROR|WARN(?:ING)?|DEBUG|TRACE|INFO)\b", re.I)

# Apache/Nginx Combined Log Format — captures method AND status in one pass.
# Format: IP - - [date] "METHOD /path HTTP/x" STATUS bytes ...
RE_HTTP_CLF = re.compile(
    r'"(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE)\s[^"]*"\s+(\d{3})\s'
)

# Date / Time string format constants
FMT_ISO = "%Y-%m-%d %H:%M:%S"
FMT_ISO_T = "%Y-%m-%dT%H:%M:%S"
FMT_APACHE = "%d/%b/%Y:%H:%M:%S"
FMT_SYSLOG = "%b %d %H:%M:%S"
FMT_EUROPE = "%d/%m/%Y %H:%M:%S"
FMT_US = "%m/%d/%Y %H:%M:%S"
FMT_ALT_ISO = "%Y/%m/%d %H:%M:%S"

# Pre-calculate expected length of each format string using a dummy date
_DUMMY_DATE = datetime.datetime(2000, 10, 10, 12, 12, 12)
FORMAT_LENGTHS = {
    fmt: len(_DUMMY_DATE.strftime(fmt))
    for fmt in [
        FMT_ISO,
        FMT_ISO_T,
        FMT_APACHE,
        FMT_SYSLOG,
        FMT_EUROPE,
        FMT_US,
        FMT_ALT_ISO,
    ]
}

# Auto-detection patterns mapped to their format strings
AUTO_TIMESTAMP_PATTERNS = [
    # 1. ISO 8601 (e.g. 2026-06-02T13:59:46.123Z, 2026-06-02 13:59:46)
    (
        re.compile(r"\b(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:[+-][\d:]+|Z)?)\b"),
        FMT_ISO,
    ),
    # 2. Apache/Nginx CLF (e.g. 26/May/2015:21:05:15 +0000)
    (
        re.compile(r"(\d{2}/[A-Za-z]{3}/\d{4}:\d{2}:\d{2}:\d{2}(?:\s+[+-]\d{4})?)"),
        FMT_APACHE,
    ),
    # 3. Syslog (e.g. Jun  1 12:34:56)
    (re.compile(r"\b([A-Za-z]{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\b"), FMT_SYSLOG),
    # 4. European/Slashed (e.g. 26/05/2015 21:05:15)
    (re.compile(r"\b(\d{2}[/\-]\d{2}[/\-]\d{4}\s+\d{2}:\d{2}:\d{2})\b"), FMT_EUROPE),
    # 5. US/Slashed (e.g. 05/26/2015 21:05:15)
    (re.compile(r"\b(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2})\b"), FMT_US),
    # 6. Slashed ISO (e.g. 2015/05/26 21:05:15)
    (re.compile(r"\b(\d{4}/\d{2}/\d{2}\s+\d{2}:\d{2}:\d{2})\b"), FMT_ALT_ISO),
]


def _parse_timestamp(extracted_ts: str, fmt: str, tz_offset: float) -> str | None:
    # Strip trailing timezone offsets like " +0000" or " -0500" before parsing
    ts_clean = re.sub(r"\s[+-]\d{4}$", "", extracted_ts.strip())
    # Clean T separator if parsing standard spaces
    if fmt == FMT_ISO and "T" in ts_clean:
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
    match: re.Match, tz_offset: float, format_override: str | None = None
) -> str | None:
    groups = match.groupdict()
    extracted_ts = groups.get("timestamp") or (match.group(1) if match.groups() else match.group(0))

    if not extracted_ts:
        return None

    if format_override:
        return _parse_timestamp(extracted_ts, format_override, tz_offset)

    formats = [
        FMT_ISO,
        FMT_ISO_T,
        FMT_APACHE,
        FMT_SYSLOG,
        FMT_EUROPE,
        FMT_US,
        FMT_ALT_ISO,
    ]

    for fmt in formats:
        parsed = _parse_timestamp(extracted_ts, fmt, tz_offset)
        if parsed:
            return parsed

    # Last resort: return as-is
    return extracted_ts


def _auto_detect_timestamp(raw_line: str, tz_offset: float) -> str | None:
    best_start = len(raw_line)
    best_parsed = None

    for regex, fmt in AUTO_TIMESTAMP_PATTERNS:
        match = regex.search(raw_line)
        if match and match.start() < best_start:
            extracted_ts = match.group(1)
            parsed = _parse_timestamp(extracted_ts, fmt, tz_offset)
            if parsed:
                best_start = match.start()
                best_parsed = parsed

    return best_parsed


def _extract_clf_and_level(raw_line: str) -> tuple[str, dict]:
    """Derive initial level from HTTP status codes or pre-defined level keywords."""
    level = "INFO"
    clf_facets: dict = {}

    # Derive level from HTTP status codes AND extract method/status facets (CLF logs)
    http_match = RE_HTTP_CLF.search(raw_line)
    if http_match:
        clf_facets["http_method"] = http_match.group(1)
        clf_facets["http_status"] = http_match.group(2)
        status = int(http_match.group(2))
        if status >= 500:
            level = "ERROR"
        elif status >= 400:
            level = "WARN"
        elif status >= 300:
            level = "DEBUG"
        else:
            level = "INFO"  # 2xx — keep default

    # Generic heuristic for level (overrides HTTP status if explicit keyword found)
    match = RE_LEVEL.search(raw_line)
    if match:
        level = match.group(1).upper()
        # Normalize WARNING → WARN
        if level == "WARNING":
            level = "WARN"

    return level, clf_facets


def _extract_timestamp_and_message(
    raw_line: str, parser_config: dict, tz_offset: float, current_level: str
) -> tuple[str | None, str, str]:
    """Resolves custom or automatic timestamps and user-defined pattern fields."""
    timestamp = None
    level = current_level
    message = raw_line

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

    return timestamp, level, message


def _extract_base_metadata(
    raw_line: str, parser_config: dict | None = None, tz_offset: float = 0
) -> tuple[str, str, str, dict]:
    """Extracts timestamp, level, message, and auto-detected facets."""
    # To support multiline logs, extract base metadata from the first line of the block
    first_line = raw_line.split("\n", 1)[0]
    level, clf_facets = _extract_clf_and_level(first_line)
    parser_config = parser_config or {}

    timestamp, level, message = _extract_timestamp_and_message(
        first_line, parser_config, tz_offset, level
    )

    # If no log timestamp was parsed, fall back to current time
    if not timestamp:
        timestamp = datetime.datetime.now().strftime(FMT_ISO)

    if "\n" in raw_line:
        rest = raw_line.split("\n", 1)[1]
        message = f"{message}\n{rest}"

    return timestamp, level, message, clf_facets


def _apply_custom_extractions(raw_line: str, custom_rules: list | None, facets: dict):
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


def is_new_log_header(line: str) -> bool:
    """Helper to detect if a line starts a new log entry.

    Returns False if the line starts with a whitespace character (tabs/spaces),
    indicating it is a stack trace continuation or multiline body.
    Otherwise, returns True (it's a header line).
    """
    if not line:
        return False
    return not line[0].isspace()


def extract_log_metadata(
    raw_line: str,
    custom_rules: list | None = None,
    parser_config: dict | None = None,
    tz_offset: float = 0,
) -> dict:
    """
    Applies source-specific regex patterns and timezone normalization to a raw log line.
    Returns timestamp, ingest_timestamp, level, message, and facets dict.
    Auto-extracted facets (http_method, http_status for CLF logs) are always included.
    """
    # 1. Base Metadata + auto-detected CLF facets (http_method, http_status)
    timestamp, level, message, clf_facets = _extract_base_metadata(
        raw_line, parser_config, tz_offset
    )
    ingest_timestamp = datetime.datetime.now().strftime(FMT_ISO)

    # Start with auto-extracted facets; custom rules can override them
    facets: dict = dict(clf_facets)

    # 2. User-defined custom extraction rules
    _apply_custom_extractions(raw_line, custom_rules, facets)

    return {
        "timestamp": timestamp,
        "ingest_timestamp": ingest_timestamp,
        "level": level,
        "message": message,
        "facets": facets,
    }
