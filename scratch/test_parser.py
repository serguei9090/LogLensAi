import sys
sys.path.insert(0, 'sidecar/src')
import re
from metadata_extractor import _auto_detect_timestamp, AUTO_TIMESTAMP_PATTERNS, _parse_timestamp

line = '138.245.115.126 - - [05/Jun/2026:11:20:05 -0400] "GET /settings HTTP/1.1" 302 0 "http://ballard.info/" "Mozilla/5.0 (Macintosh; PPC Mac OS X 10_11_3; rv:1.9.4.20) Gecko/9983-02-05 15:08:50 Firefox/8.0"'

print("Old parse:", _auto_detect_timestamp(line, 0))

def new_auto_detect_timestamp(raw_line: str, tz_offset: float) -> str | None:
    best_match = None
    best_start = len(raw_line)
    best_parsed = None

    for regex, fmt in AUTO_TIMESTAMP_PATTERNS:
        match = regex.search(raw_line)
        if match:
            # Check if this match starts earlier than the current best match
            if match.start() < best_start:
                extracted_ts = match.group(1)
                parsed = _parse_timestamp(extracted_ts, fmt, tz_offset)
                if parsed:
                    best_match = match
                    best_start = match.start()
                    best_parsed = parsed

    return best_parsed

print("New parse:", new_auto_detect_timestamp(line, 0))
