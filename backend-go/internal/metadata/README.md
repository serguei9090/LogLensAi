# metadata

## Overview
Log line metadata extractor. Derives structured timestamps, severity levels, normalized messages, and custom/HTTP facets from raw (single-line or multiline) log entries using CLF HTTP status heuristics, priority-ordered timestamp parsing with `strptime` translation, and fault-isolated user regex rules.

## Interface
- `[metadata.go:ParserConfig]`: Struct configuring per-source `TimestampRegex`, `TimestampFormat`, `Regex` (named groups `timestamp`, `level`, `message`), and `TimestampAutoDetect`.
- `[metadata.go:Rule]`: Struct defining a custom facet-extraction rule (`Name`, `Regex`, `Group`, `Enabled`).
- `[metadata.go:Metadata]`: Output struct holding `Timestamp`, `IngestTimestamp`, `Level`, `Message`, and `Facets`.
- `[metadata.go:IsNewLogHeader]`: Reports whether a line is non-empty and does not start with Unicode whitespace (distinguishing new entries from stack-trace continuations).
- `[metadata.go:ExtractLogMetadata]`: Extracts `Metadata` from a raw log block using custom rules, optional `*ParserConfig`, and `tzOffsetHours`.

## Invariants
- `[metadata.go:extractBaseMetadata]`: Parses timestamp, level, and CLF facets strictly from the first line of a multiline block while reattaching remaining lines verbatim to `Message`; falls back to `time.Now().Format("2006-01-02 15:04:05")` when no timestamp is resolved.
- `[metadata.go:extractCLFAndLevel]`: Defaults `Level` to `"INFO"`, derives `http_method`/`http_status` facets and status-based severity (`>=500` `ERROR`, `>=400` `WARN`, `>=300` `DEBUG`) for Apache/Nginx CLF lines, and overrides `Level` if `reLevel` matches (normalizing `"WARNING"` to `"WARN"`).
- `[metadata.go:extractTimestampAndMessage]`: Resolves timestamps in strict precedence: `ParserConfig.TimestampRegex`, then `ParserConfig.Regex` (also extracting optional `level`/`message` groups), then `autoDetectTimestamp` (when auto-detect is nil or true, selecting the earliest match in the line).
- `[metadata.go:parseTimestamp]`, `[strptime.go:strptimeToGoLayout]`, `[strptime.go:formatLength]`: Collapses whitespace, strips trailing `[+-]HHMM` suffixes, fills missing years with `time.Now().Year()`, applies fractional seconds and `tzOffsetHours`, and formats parsed timestamps as `"2006-01-02 15:04:05.000"`.
- `[metadata.go:applyCustomExtractions]`, `[metadata.go:applySingleCustomRule]`: Applies enabled custom rules after CLF extraction (allowing custom facets to overwrite CLF facets) and recovers from invalid regexes or panics so broken rules never abort ingestion.

## Side Effects
- `[metadata.go:applySingleCustomRule]`: Logs compilation errors and recovered panics for custom regex rules via `log.Printf`.
- `[metadata.go:parseTimestamp]`, `[metadata.go:extractBaseMetadata]`, `[metadata.go:ExtractLogMetadata]`: Calls `time.Now()` for missing syslog years, fallback log timestamps, and `IngestTimestamp`.

## Verification
- Run: `go test ./...`
