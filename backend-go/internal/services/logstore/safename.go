package logstore

import "regexp"

// unsafeChars matches anything outside [A-Za-z0-9_-], ported from
// log_file_store.py's `_UNSAFE = re.compile(r"[^A-Za-z0-9_\-]")`.
var unsafeChars = regexp.MustCompile(`[^A-Za-z0-9_\-]`)

// safeName converts an arbitrary source_id into a filesystem-safe stem:
// every character outside [A-Za-z0-9_-] becomes '_', and the result is
// truncated to 64 characters to stay well clear of MAX_PATH on Windows.
// Ports log_file_store.py:_safe_name.
func safeName(sourceID string) string {
	sanitized := unsafeChars.ReplaceAllString(sourceID, "_")
	if len(sanitized) > 64 {
		sanitized = sanitized[:64]
	}
	return sanitized
}
