package metadata

import (
	"strings"
	"testing"
)

// Sample lines pulled directly from apache_logs.log (Apache/NCSA Combined
// Log Format) covering the 2xx/3xx/4xx/5xx level-classification boundaries.
const (
	apacheLine200 = `83.149.9.216 - - [17/May/2015:10:05:03 +0000] "GET /presentations/logstash-monitorama-2013/images/kibana-search.png HTTP/1.1" 200 203023 "http://semicomplete.com/presentations/logstash-monitorama-2013/" "Mozilla/5.0"`
	apacheLine304 = `218.30.103.62 - - [17/May/2015:11:05:17 +0000] "GET /projects/xdotool/xdotool.xhtml HTTP/1.1" 304 - "-" "Sogou web spider/4.0"`
	apacheLine404 = `66.249.73.185 - - [17/May/2015:10:05:22 +0000] "GET /doc/index.html HTTP/1.1" 404 294 "-" "Mozilla/5.0 (compatible; Googlebot/2.1)"`
	apacheLine500 = `66.249.73.135 - - [18/May/2015:03:05:34 +0000] "GET /misc/Title.php.txt HTTP/1.1" 500 - "-" "Mozilla/5.0 (compatible; Googlebot/2.1)"`
)

func TestExtractLogMetadata_ApacheStatusLevels(t *testing.T) {
	cases := []struct {
		name      string
		line      string
		wantLevel string
		wantTS    string // YYYY-MM-DD HH:MM:SS prefix, ignoring .mmm
	}{
		{"2xx->INFO", apacheLine200, "INFO", "2015-05-17 10:05:03"},
		{"3xx->DEBUG", apacheLine304, "DEBUG", "2015-05-17 11:05:17"},
		{"4xx->WARN", apacheLine404, "WARN", "2015-05-17 10:05:22"},
		{"5xx->ERROR", apacheLine500, "ERROR", "2015-05-18 03:05:34"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			md := ExtractLogMetadata(tc.line, nil, nil, 0)
			if md.Level != tc.wantLevel {
				t.Errorf("Level = %q, want %q", md.Level, tc.wantLevel)
			}
			if !strings.HasPrefix(md.Timestamp, tc.wantTS) {
				t.Errorf("Timestamp = %q, want prefix %q", md.Timestamp, tc.wantTS)
			}
			if md.Facets["http_status"] == "" {
				t.Errorf("expected http_status facet to be set, got facets=%v", md.Facets)
			}
			if md.Facets["http_method"] != "GET" {
				t.Errorf("expected http_method=GET, got %q", md.Facets["http_method"])
			}
			if md.Message == "" {
				t.Errorf("expected non-empty message")
			}
			if md.IngestTimestamp == "" {
				t.Errorf("expected non-empty ingest timestamp")
			}
		})
	}
}

func TestExtractLogMetadata_LevelKeywordOverridesHTTPStatus(t *testing.T) {
	// Explicit level keyword should win over the HTTP-status-derived level.
	line := `1.2.3.4 - - [17/May/2015:10:05:03 +0000] "GET /x HTTP/1.1" 200 100 FATAL "-" "-"`
	md := ExtractLogMetadata(line, nil, nil, 0)
	if md.Level != "FATAL" {
		t.Fatalf("Level = %q, want FATAL", md.Level)
	}
}

func TestExtractLogMetadata_WarningNormalizedToWarn(t *testing.T) {
	md := ExtractLogMetadata("2024-01-02 03:04:05 WARNING disk almost full", nil, nil, 0)
	if md.Level != "WARN" {
		t.Fatalf("Level = %q, want WARN (normalized from WARNING)", md.Level)
	}
	if !strings.HasPrefix(md.Timestamp, "2024-01-02 03:04:05") {
		t.Fatalf("Timestamp = %q, want prefix 2024-01-02 03:04:05", md.Timestamp)
	}
}

func TestExtractLogMetadata_ISOWithMillis(t *testing.T) {
	// Note: the millisecond-fraction regex ported from
	// metadata_extractor.py (`[:\d]([.,]\d{1,6})\b`) requires a
	// non-word-character boundary right after the fraction. A trailing "Z"
	// (as in strict ISO-8601 UTC) is itself a word character, so no
	// boundary exists there and the fraction is silently dropped by both
	// the Python original and this port — this is a faithfully-reproduced
	// upstream quirk, not a Go-specific bug. See the "Z" case below.
	md := ExtractLogMetadata("2026-06-02T13:59:46.123 INFO service started", nil, nil, 0)
	if md.Level != "INFO" {
		t.Fatalf("Level = %q, want INFO", md.Level)
	}
	if !strings.HasPrefix(md.Timestamp, "2026-06-02 13:59:46.123") {
		t.Fatalf("Timestamp = %q, want prefix 2026-06-02 13:59:46.123", md.Timestamp)
	}
}

func TestExtractLogMetadata_ISOWithMillisAndZSuffixDropsFraction(t *testing.T) {
	// Ports the same upstream regex-boundary quirk documented above: a
	// trailing "Z" prevents the fraction-second regex from matching, so
	// milliseconds are lost even though the timestamp itself still parses.
	md := ExtractLogMetadata("2026-06-02T13:59:46.123Z INFO service started", nil, nil, 0)
	if !strings.HasPrefix(md.Timestamp, "2026-06-02 13:59:46.000") {
		t.Fatalf("Timestamp = %q, want prefix 2026-06-02 13:59:46.000 (fraction dropped)", md.Timestamp)
	}
}

func TestExtractLogMetadata_SyslogNoYearDefaultsCurrentYear(t *testing.T) {
	md := ExtractLogMetadata("Jun  1 12:34:56 myhost sshd[123]: ERROR auth failure", nil, nil, 0)
	if md.Level != "ERROR" {
		t.Fatalf("Level = %q, want ERROR", md.Level)
	}
	if !strings.Contains(md.Timestamp, "-06-01 12:34:56") {
		t.Fatalf("Timestamp = %q, want to contain -06-01 12:34:56", md.Timestamp)
	}
}

func TestExtractLogMetadata_TZOffsetApplied(t *testing.T) {
	mdNoOffset := ExtractLogMetadata("2024-01-02 03:04:05 INFO x", nil, nil, 0)
	mdOffset := ExtractLogMetadata("2024-01-02 03:04:05 INFO x", nil, nil, 2)
	if !strings.HasPrefix(mdNoOffset.Timestamp, "2024-01-02 03:04:05") {
		t.Fatalf("baseline timestamp wrong: %q", mdNoOffset.Timestamp)
	}
	if !strings.HasPrefix(mdOffset.Timestamp, "2024-01-02 05:04:05") {
		t.Fatalf("tz-shifted timestamp wrong: %q, want 2024-01-02 05:04:05 prefix", mdOffset.Timestamp)
	}
}

func TestExtractLogMetadata_NoTimestampFallsBackToNow(t *testing.T) {
	md := ExtractLogMetadata("just a plain line with no timestamp at all", nil, nil, 0)
	if md.Timestamp == "" {
		t.Fatalf("expected fallback timestamp, got empty string")
	}
}

func TestExtractLogMetadata_CustomRuleExtractsNamedGroup(t *testing.T) {
	rules := []Rule{
		{Name: "user_id", Regex: `user=(?P<user_id>\d+)`},
	}
	md := ExtractLogMetadata("2024-01-02 03:04:05 INFO login user=42 ok", rules, nil, 0)
	if md.Facets["user_id"] != "42" {
		t.Fatalf("facets = %v, want user_id=42", md.Facets)
	}
}

func TestExtractLogMetadata_CustomRulePositionalGroup(t *testing.T) {
	rules := []Rule{
		{Name: "req_id", Regex: `req=(\S+)`, Group: 1},
	}
	md := ExtractLogMetadata("2024-01-02 03:04:05 INFO req=abc-123 done", rules, nil, 0)
	if md.Facets["req_id"] != "abc-123" {
		t.Fatalf("facets = %v, want req_id=abc-123", md.Facets)
	}
}

func TestExtractLogMetadata_CustomRuleDisabledSkipped(t *testing.T) {
	disabled := false
	rules := []Rule{
		{Name: "user_id", Regex: `user=(?P<user_id>\d+)`, Enabled: &disabled},
	}
	md := ExtractLogMetadata("2024-01-02 03:04:05 INFO user=42", rules, nil, 0)
	if _, ok := md.Facets["user_id"]; ok {
		t.Fatalf("expected disabled rule to be skipped, got facets=%v", md.Facets)
	}
}

func TestExtractLogMetadata_CustomRuleBadRegexDoesNotPanic(t *testing.T) {
	rules := []Rule{
		{Name: "bad", Regex: `(unclosed`},
	}
	md := ExtractLogMetadata("2024-01-02 03:04:05 INFO whatever", rules, nil, 0)
	if _, ok := md.Facets["bad"]; ok {
		t.Fatalf("expected no facet from invalid regex, got %v", md.Facets)
	}
}

func TestExtractLogMetadata_CustomTimestampRegexAndFormat(t *testing.T) {
	cfg := &ParserConfig{
		TimestampRegex:  `ts=(?P<timestamp>[\d/]+ [\d:]+)`,
		TimestampFormat: "%d/%m/%Y %H:%M:%S",
	}
	md := ExtractLogMetadata("event ts=25/12/2024 08:30:00 payload", nil, cfg, 0)
	if !strings.HasPrefix(md.Timestamp, "2024-12-25 08:30:00") {
		t.Fatalf("Timestamp = %q, want prefix 2024-12-25 08:30:00", md.Timestamp)
	}
}

func TestExtractLogMetadata_SourceRegexOverridesLevelAndMessage(t *testing.T) {
	cfg := &ParserConfig{
		Regex: `^(?P<timestamp>\S+ \S+) \[(?P<level>\w+)\] (?P<message>.*)$`,
	}
	md := ExtractLogMetadata("2024-01-02 03:04:05 [warn] disk getting full", nil, cfg, 0)
	if md.Level != "WARN" {
		t.Fatalf("Level = %q, want WARN", md.Level)
	}
	if md.Message != "disk getting full" {
		t.Fatalf("Message = %q, want 'disk getting full'", md.Message)
	}
	if !strings.HasPrefix(md.Timestamp, "2024-01-02 03:04:05") {
		t.Fatalf("Timestamp = %q, want prefix 2024-01-02 03:04:05", md.Timestamp)
	}
}

func TestExtractLogMetadata_AutoDetectDisabled(t *testing.T) {
	autoDetect := false
	cfg := &ParserConfig{TimestampAutoDetect: &autoDetect}
	line := "2024-01-02 03:04:05 INFO would-be-detected"
	md := ExtractLogMetadata(line, nil, cfg, 0)
	// With auto-detect off and no other timestamp source, we fall back to "now".
	if strings.HasPrefix(md.Timestamp, "2024-01-02 03:04:05") {
		t.Fatalf("expected auto-detect to be disabled, but timestamp was parsed from the line: %q", md.Timestamp)
	}
}

func TestExtractLogMetadata_MultilineOnlyFirstLineParsed(t *testing.T) {
	raw := "2024-01-02 03:04:05 ERROR boom\n  at foo.bar()\n  at baz.qux()"
	md := ExtractLogMetadata(raw, nil, nil, 0)
	if md.Level != "ERROR" {
		t.Fatalf("Level = %q, want ERROR", md.Level)
	}
	if !strings.Contains(md.Message, "at foo.bar()") || !strings.Contains(md.Message, "at baz.qux()") {
		t.Fatalf("Message = %q, want continuation lines reattached", md.Message)
	}
}

func TestIsNewLogHeader(t *testing.T) {
	cases := []struct {
		line string
		want bool
	}{
		{"2024-01-02 ERROR boom", true},
		{"  at foo.bar()", false},
		{"\tat foo.bar()", false},
		{"", false},
		{"x", true},
	}
	for _, tc := range cases {
		if got := IsNewLogHeader(tc.line); got != tc.want {
			t.Errorf("IsNewLogHeader(%q) = %v, want %v", tc.line, got, tc.want)
		}
	}
}
