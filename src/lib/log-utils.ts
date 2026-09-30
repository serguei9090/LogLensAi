/**
 * ManualLogEntry represents a log line parsed from a raw text buffer.
 */
export interface ManualLogEntry {
  raw_text: string;
  timestamp: string;
  level: string;
  source_id: string;
}

/**
 * Parse raw pasted text into structured ManualLogEntry objects.
 * Attempts to extract ISO-like timestamps and common log levels.
 *
 * @param raw - The raw text string to parse.
 * @returns An array of parsed ManualLogEntry objects.
 */
export function parseManualLogs(raw: string): ManualLogEntry[] {
  const TS_RE = /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})\s*/;
  const LEVEL_RE = /\b(ERROR|WARN|WARNING|INFO|DEBUG|TRACE|FATAL|CRITICAL)\b/i;

  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const tsMatch = TS_RE.exec(line);
      const remainder = tsMatch ? line.slice(tsMatch[0].length) : line;
      const levelMatch = LEVEL_RE.exec(remainder);
      return {
        raw_text: line,
        timestamp: tsMatch ? tsMatch[1] : new Date().toISOString(),
        level: levelMatch ? levelMatch[1].toUpperCase() : "INFO",
        source_id: "manual",
      };
    });
}
