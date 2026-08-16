// Package metadata ports sidecar/src/metadata_extractor.py: deriving a
// structured Timestamp/Level/Message/Facets record from one raw log line
// (optionally the first line of a multiline block), using HTTP-status /
// level-keyword heuristics, a priority chain of timestamp sources, and
// user-defined regex facet-extraction rules.
package metadata

import (
	"log"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

// --- Pre-compiled patterns (metadata_extractor.py:9-16) ---

var reLevel = regexp.MustCompile(`(?i)\b(FATAL|ERROR|WARN(?:ING)?|DEBUG|TRACE|INFO)\b`)

// reHTTPCLF matches Apache/Nginx Combined Log Format request+status in one
// pass: `"METHOD /path HTTP/x" STATUS bytes ...`.
var reHTTPCLF = regexp.MustCompile(`"(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE)\s[^"]*"\s+(\d{3})\s`)

// --- Date/time format constants (strptime-style, metadata_extractor.py:19-25) ---

const (
	fmtISO    = "%Y-%m-%d %H:%M:%S"
	fmtISOT   = "%Y-%m-%dT%H:%M:%S"
	fmtApache = "%d/%b/%Y:%H:%M:%S"
	fmtSyslog = "%b %d %H:%M:%S"
	fmtEurope = "%d/%m/%Y %H:%M:%S"
	fmtUS     = "%m/%d/%Y %H:%M:%S"
	fmtAltISO = "%Y/%m/%d %H:%M:%S"
)

// builtinFormats is tried in this order both when resolving a match with no
// explicit format override, and when auto-detecting (per pattern below).
var builtinFormats = []string{fmtISO, fmtISOT, fmtApache, fmtSyslog, fmtEurope, fmtUS, fmtAltISO}

type autoPattern struct {
	re  *regexp.Regexp
	fmt string
}

// autoTimestampPatterns mirrors AUTO_TIMESTAMP_PATTERNS (metadata_extractor.py:43-62).
var autoTimestampPatterns = []autoPattern{
	{regexp.MustCompile(`\b(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:[+-][\d:]+|Z)?)\b`), fmtISO},
	{regexp.MustCompile(`(\d{2}/[A-Za-z]{3}/\d{4}:\d{2}:\d{2}:\d{2}(?:\s+[+-]\d{4})?)`), fmtApache},
	{regexp.MustCompile(`\b([A-Za-z]{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\b`), fmtSyslog},
	{regexp.MustCompile(`\b(\d{2}[/\-]\d{2}[/\-]\d{4}\s+\d{2}:\d{2}:\d{2})\b`), fmtEurope},
	{regexp.MustCompile(`\b(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2})\b`), fmtUS},
	{regexp.MustCompile(`\b(\d{4}/\d{2}/\d{2}\s+\d{2}:\d{2}:\d{2})\b`), fmtAltISO},
}

var (
	trailingTZRe = regexp.MustCompile(`\s[+-]\d{4}$`)
	msFractionRe = regexp.MustCompile(`[:\d]([.,]\d{1,6})\b`)
	wsRunRe      = regexp.MustCompile(`\s+`)
)

// normalizeWhitespace collapses runs of whitespace to a single space. Go's
// time.Parse matches literal layout spaces exactly (unlike Python's
// strptime, which is lenient about repeated whitespace) — this keeps
// irregularly-spaced captures like syslog's "Jun  1" (double space before a
// single-digit day) parseable against a single-space format string.
func normalizeWhitespace(s string) string {
	return wsRunRe.ReplaceAllString(s, " ")
}

// parseTimestamp ports _parse_timestamp (metadata_extractor.py:65-100).
func parseTimestamp(extractedTS, fmtStr string, tzOffsetHours float64) (string, bool) {
	tsClean := trailingTZRe.ReplaceAllString(strings.TrimSpace(extractedTS), "")
	if fmtStr == fmtISO && strings.Contains(tsClean, "T") {
		tsClean = strings.Replace(tsClean, "T", " ", 1)
	}

	var fractionSec float64
	if !strings.Contains(fmtStr, "%f") {
		if loc := msFractionRe.FindStringSubmatchIndex(tsClean); loc != nil {
			fracRaw := tsClean[loc[2]:loc[3]]
			fracStr := strings.Replace(fracRaw, ",", ".", 1)
			if f, err := strconv.ParseFloat(fracStr, 64); err == nil {
				fractionSec = f
			}
			tsClean = tsClean[:loc[2]] + tsClean[loc[3]:]
		}
	}
	tsClean = normalizeWhitespace(tsClean)

	hasYear := strings.Contains(fmtStr, "%Y") || strings.Contains(fmtStr, "%y")
	goLayout := strptimeToGoLayout(fmtStr)

	var t time.Time
	var err error
	if !hasYear {
		// Syslog-style: no year in the format, default to the current year.
		currentYear := time.Now().Year()
		t, err = time.Parse("2006 "+goLayout, strconv.Itoa(currentYear)+" "+tsClean)
	} else {
		sliceLen := formatLength(goLayout)
		s := tsClean
		if sliceLen < len(s) {
			s = s[:sliceLen]
		}
		t, err = time.Parse(goLayout, s)
	}
	if err != nil {
		return "", false
	}

	if fractionSec > 0 {
		t = t.Add(time.Duration(fractionSec * float64(time.Second)))
	}
	if tzOffsetHours != 0 {
		t = t.Add(time.Duration(tzOffsetHours * float64(time.Hour)))
	}
	return t.Format("2006-01-02 15:04:05.000"), true
}

func indexOfName(names []string, name string) int {
	for i, n := range names {
		if n == name {
			return i
		}
	}
	return -1
}

// timestampFromMatch ports _get_timestamp_from_match
// (metadata_extractor.py:103-131). loc is the FindStringSubmatchIndex
// result for m against src; formatOverride, if non-empty, forces a single
// format instead of trying builtinFormats in order.
func timestampFromMatch(src string, names []string, loc []int, tzOffsetHours float64, formatOverride string) (string, bool) {
	var extracted string
	if idx := indexOfName(names, "timestamp"); idx != -1 && loc[2*idx] != -1 {
		extracted = src[loc[2*idx]:loc[2*idx+1]]
	} else if len(names) > 1 && loc[2] != -1 {
		extracted = src[loc[2]:loc[3]]
	} else {
		extracted = src[loc[0]:loc[1]]
	}
	if extracted == "" {
		return "", false
	}

	if formatOverride != "" {
		return parseTimestamp(extracted, formatOverride, tzOffsetHours)
	}
	for _, fmtStr := range builtinFormats {
		if ts, ok := parseTimestamp(extracted, fmtStr, tzOffsetHours); ok {
			return ts, true
		}
	}
	// Last resort: return the raw extracted text, matching Python.
	return extracted, true
}

// autoDetectTimestamp ports _auto_detect_timestamp (metadata_extractor.py:134-147):
// try every pattern, keep the parse that matched earliest in the line.
func autoDetectTimestamp(rawLine string, tzOffsetHours float64) (string, bool) {
	bestStart := len(rawLine)
	var bestParsed string
	found := false

	for _, p := range autoTimestampPatterns {
		loc := p.re.FindStringSubmatchIndex(rawLine)
		if loc == nil || loc[0] >= bestStart {
			continue
		}
		extracted := rawLine[loc[2]:loc[3]]
		if ts, ok := parseTimestamp(extracted, p.fmt, tzOffsetHours); ok {
			bestStart = loc[0]
			bestParsed = ts
			found = true
		}
	}
	return bestParsed, found
}

// extractCLFAndLevel ports _extract_clf_and_level (metadata_extractor.py:150-178).
func extractCLFAndLevel(rawLine string) (level string, facets map[string]string) {
	level = "INFO"
	facets = map[string]string{}

	if m := reHTTPCLF.FindStringSubmatch(rawLine); m != nil {
		facets["http_method"] = m[1]
		facets["http_status"] = m[2]
		if status, err := strconv.Atoi(m[2]); err == nil {
			switch {
			case status >= 500:
				level = "ERROR"
			case status >= 400:
				level = "WARN"
			case status >= 300:
				level = "DEBUG"
			default:
				level = "INFO"
			}
		}
	}

	if m := reLevel.FindStringSubmatch(rawLine); m != nil {
		lvl := strings.ToUpper(m[1])
		if lvl == "WARNING" {
			lvl = "WARN"
		}
		level = lvl
	}

	return level, facets
}

// ParserConfig holds source-wide parsing overrides, mirroring the
// parser_config dict consumed by metadata_extractor.py's extract functions.
type ParserConfig struct {
	// TimestampRegex + TimestampFormat: a user-defined regex (optionally
	// with a "timestamp" named group) and strptime-style format string.
	// Highest priority timestamp source.
	TimestampRegex  string
	TimestampFormat string

	// Regex: a source-wide regex whose named groups ("timestamp", "level",
	// "message") can additionally override level/message. Tried only if
	// TimestampRegex didn't resolve a timestamp.
	Regex string

	// TimestampAutoDetect defaults to true (nil behaves as true), matching
	// parser_config.get("timestamp_auto_detect", True).
	TimestampAutoDetect *bool
}

func (c *ParserConfig) autoDetectEnabled() bool {
	if c == nil || c.TimestampAutoDetect == nil {
		return true
	}
	return *c.TimestampAutoDetect
}

// extractTimestampAndMessage ports _extract_timestamp_and_message
// (metadata_extractor.py:181-212).
func extractTimestampAndMessage(rawLine string, cfg *ParserConfig, tzOffsetHours float64, currentLevel string) (timestamp, level, message string) {
	level = currentLevel
	message = rawLine

	if cfg != nil && cfg.TimestampRegex != "" {
		if re, err := regexp.Compile(cfg.TimestampRegex); err == nil {
			if loc := re.FindStringSubmatchIndex(rawLine); loc != nil {
				if ts, ok := timestampFromMatch(rawLine, re.SubexpNames(), loc, tzOffsetHours, cfg.TimestampFormat); ok {
					timestamp = ts
				}
			}
		}
	}

	if timestamp == "" && cfg != nil && cfg.Regex != "" {
		if re, err := regexp.Compile(cfg.Regex); err == nil {
			if loc := re.FindStringSubmatchIndex(rawLine); loc != nil {
				names := re.SubexpNames()

				if ts, ok := timestampFromMatch(rawLine, names, loc, tzOffsetHours, ""); ok {
					timestamp = ts
				}
				if idx := indexOfName(names, "level"); idx != -1 && loc[2*idx] != -1 {
					level = strings.ToUpper(rawLine[loc[2*idx]:loc[2*idx+1]])
				}
				if idx := indexOfName(names, "message"); idx != -1 && loc[2*idx] != -1 {
					message = rawLine[loc[2*idx]:loc[2*idx+1]]
				}
			}
		}
	}

	if timestamp == "" && cfg.autoDetectEnabled() {
		if ts, ok := autoDetectTimestamp(rawLine, tzOffsetHours); ok {
			timestamp = ts
		}
	}

	return timestamp, level, message
}

// extractBaseMetadata ports _extract_base_metadata (metadata_extractor.py:215-236).
// Only the first line of a multiline block is parsed for timestamp/level;
// the remainder is reattached to Message.
func extractBaseMetadata(rawLine string, cfg *ParserConfig, tzOffsetHours float64) (timestamp, level, message string, clfFacets map[string]string) {
	firstLine := rawLine
	rest := ""
	hasRest := false
	if idx := strings.IndexByte(rawLine, '\n'); idx != -1 {
		firstLine = rawLine[:idx]
		rest = rawLine[idx+1:]
		hasRest = true
	}

	level, clfFacets = extractCLFAndLevel(firstLine)
	timestamp, level, message = extractTimestampAndMessage(firstLine, cfg, tzOffsetHours, level)

	if timestamp == "" {
		timestamp = time.Now().Format("2006-01-02 15:04:05")
	}
	if hasRest {
		message = message + "\n" + rest
	}
	return timestamp, level, message, clfFacets
}

// Rule is a user-defined facet-extraction rule: a regex whose named group
// (matching Name) or positional Group captures a facet value.
type Rule struct {
	Name  string
	Regex string
	Group int // 1-based; 0 defaults to 1, matching rule.get("group", 1)

	// Enabled defaults to true (nil behaves as true), matching
	// rule.get("enabled", True). Set to a pointer to false to disable.
	Enabled *bool
}

// applyCustomExtractions ports _apply_custom_extractions (metadata_extractor.py:239-247).
func applyCustomExtractions(rawLine string, rules []Rule, facets map[string]string) {
	for _, rule := range rules {
		if rule.Enabled != nil && !*rule.Enabled {
			continue
		}
		applySingleCustomRule(rawLine, rule, facets)
	}
}

// applySingleCustomRule ports _apply_single_custom_rule (metadata_extractor.py:250-267).
// Any failure (bad regex, panic) is caught and skipped, never propagated —
// a broken custom rule must not break ingestion of the line.
func applySingleCustomRule(rawLine string, rule Rule, facets map[string]string) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("metadata: custom extraction rule %q panicked: %v", rule.Name, r)
		}
	}()

	if rule.Regex == "" || rule.Name == "" {
		return
	}
	re, err := regexp.Compile(rule.Regex)
	if err != nil {
		log.Printf("metadata: custom extraction rule %q failed to compile: %v", rule.Name, err)
		return
	}
	m := re.FindStringSubmatch(rawLine)
	if m == nil {
		return
	}

	names := re.SubexpNames()
	if idx := indexOfName(names, rule.Name); idx != -1 && idx < len(m) {
		facets[rule.Name] = m[idx]
		return
	}

	group := rule.Group
	if group == 0 {
		group = 1
	}
	if group < len(m) {
		facets[rule.Name] = m[group]
	}
}

// IsNewLogHeader ports is_new_log_header (metadata_extractor.py:270-279): a
// line starting with whitespace is a continuation (stack trace / multiline
// body), not a new log entry.
func IsNewLogHeader(line string) bool {
	if line == "" {
		return false
	}
	r, _ := utf8.DecodeRuneInString(line)
	return !unicode.IsSpace(r)
}

// Metadata is the structured result of ExtractLogMetadata, mirroring the
// dict returned by extract_log_metadata (metadata_extractor.py:282-311).
type Metadata struct {
	Timestamp       string
	IngestTimestamp string
	Level           string
	Message         string
	Facets          map[string]string
}

// ExtractLogMetadata ports extract_log_metadata (metadata_extractor.py:282-311).
// Auto-extracted CLF facets (http_method, http_status) are always included;
// custom rules run afterward and may override them.
func ExtractLogMetadata(rawLine string, customRules []Rule, parserConfig *ParserConfig, tzOffsetHours float64) Metadata {
	timestamp, level, message, clfFacets := extractBaseMetadata(rawLine, parserConfig, tzOffsetHours)
	ingestTimestamp := time.Now().Format("2006-01-02 15:04:05")

	facets := make(map[string]string, len(clfFacets))
	for k, v := range clfFacets {
		facets[k] = v
	}
	applyCustomExtractions(rawLine, customRules, facets)

	return Metadata{
		Timestamp:       timestamp,
		IngestTimestamp: ingestTimestamp,
		Level:           level,
		Message:         message,
		Facets:          facets,
	}
}
