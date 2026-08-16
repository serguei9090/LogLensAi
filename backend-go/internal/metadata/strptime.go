package metadata

import (
	"strings"
	"time"
)

// strptimeToGoLayout translates a (small, best-effort) subset of C
// strptime/Python-datetime `%`-directives into a Go reference-time layout
// string. Only the directives actually used by this package's built-in
// formats and reasonably expected in user-supplied timestamp_format config
// are supported: %Y %y %m %d %H %M %S %f %b %B %a %A %p %z %%.
//
// %d is deliberately mapped to Go's "_2" (space- or non-padded day) rather
// than the strictly zero-padded "02", because the syslog auto-detect
// pattern's day capture is 1-2 digits (matching Python's lenient strptime
// %d, which accepts a single digit) and normalizeWhitespace above already
// collapses the "Jun  1"-style double space that can precede it.
func strptimeToGoLayout(fmtStr string) string {
	var b strings.Builder
	for i := 0; i < len(fmtStr); i++ {
		c := fmtStr[i]
		if c != '%' || i+1 >= len(fmtStr) {
			b.WriteByte(c)
			continue
		}
		spec := fmtStr[i+1]
		switch spec {
		case 'Y':
			b.WriteString("2006")
		case 'y':
			b.WriteString("06")
		case 'm':
			b.WriteString("01")
		case 'd':
			b.WriteString("_2")
		case 'H':
			b.WriteString("15")
		case 'M':
			b.WriteString("04")
		case 'S':
			b.WriteString("05")
		case 'f':
			b.WriteString("000000")
		case 'b':
			b.WriteString("Jan")
		case 'B':
			b.WriteString("January")
		case 'a':
			b.WriteString("Mon")
		case 'A':
			b.WriteString("Monday")
		case 'p':
			b.WriteString("PM")
		case 'z':
			b.WriteString("-0700")
		case '%':
			b.WriteByte('%')
		default:
			// Unknown directive: pass through literally, best-effort.
			b.WriteByte('%')
			b.WriteByte(spec)
		}
		i++
	}
	return b.String()
}

// dummyFormatDate mirrors metadata_extractor.py's _DUMMY_DATE
// (2000-10-10 12:12:12), used only to precompute each format's expected
// rendered length for the truncate-before-parse step in parseTimestamp.
var dummyFormatDate = time.Date(2000, 10, 10, 12, 12, 12, 0, time.UTC)

// formatLength returns len(dummyFormatDate.Format(goLayout)), i.e. the
// expected character length of a timestamp rendered in this format —
// ported from FORMAT_LENGTHS in metadata_extractor.py, used to slice a
// fixed-width prefix off ts_clean before calling time.Parse so trailing
// unrelated text in the line doesn't break the parse.
func formatLength(goLayout string) int {
	return len(dummyFormatDate.Format(goLayout))
}
