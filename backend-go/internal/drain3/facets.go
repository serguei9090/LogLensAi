package drain3

import (
	"regexp"
	"strings"
)

// maskToken finds "<LABEL>" placeholders in a mined template — both mask
// labels (e.g. "<IP>") and Drain's own wildcard ("<*>") — assuming the
// default mask prefix/suffix "<"/">" (true for every Config this package
// ever constructs; DefaultConfig and every caller in this migration keep
// parser.py's own defaults, which never override them either).
var maskToken = regexp.MustCompile(`<[^<>]+>`)

// extractFacets ports TemplateMiner.extract_parameters(exact_matching=false)
// (template_miner.py:190-234, 236-314): given a mined template (containing
// "<LABEL>" placeholders) and the ORIGINAL, unmasked log line, it rebuilds
// a regex from the template — literal spans escaped (with whitespace runs
// relaxed to `\s+`, matching template_miner.py:311-312's
// `re.sub(r"\\ ", r"\\s+", ...)` applied to a `re.escape`d template, since
// Python's re.escape escapes spaces too) and each "<LABEL>" placeholder
// replaced with a non-greedy capture group — then matches it against the
// log line and returns one facet per captured group whose label isn't the
// bare wildcard "*". Facet keys are lowercased mask labels, matching
// parser.py:75 (`param.mask_name.strip("<>").lower()`).
//
// Simplification versus Python: this only implements the
// exact_matching=false code path (parser.py always calls
// extract_parameters with exact_matching=false — see parser.py:71), which
// uses a generic ".+?" capture for every placeholder regardless of label.
// Python's exact_matching=true path additionally plugs each mask's own
// regex pattern into its capture group (falling back to named-group
// renaming to avoid collisions); since parser.py never exercises that path,
// it isn't ported here, and this function doesn't need per-mask patterns
// at all — only where each label sits in the template.
//
// Because every position gets a distinct capture group in strict left-to-
// right order, this also doesn't need Python's synthetic p_0/p_1/...
// group-naming scheme (which exists there to give every occurrence of a
// possibly-repeated mask name its own regex group) — positional submatches
// already line up 1:1 with the labels slice built alongside the pattern.
func extractFacets(template, logLine string, cfg Config) map[string]string {
	facets := map[string]string{}
	if template == "" {
		return facets
	}

	for _, d := range cfg.ExtraDelimiters {
		if re, err := regexp.Compile(d); err == nil {
			logLine = re.ReplaceAllString(logLine, " ")
		}
	}

	var pattern strings.Builder
	pattern.WriteString("^")

	var labels []string
	lastEnd := 0
	for _, m := range maskToken.FindAllStringIndex(template, -1) {
		pattern.WriteString(escapeLiteral(template[lastEnd:m[0]]))

		label := strings.Trim(template[m[0]:m[1]], "<>")
		labels = append(labels, label)
		pattern.WriteString(`(.+?)`)

		lastEnd = m[1]
	}
	pattern.WriteString(escapeLiteral(template[lastEnd:]))
	pattern.WriteString("$")

	re, err := regexp.Compile(pattern.String())
	if err != nil {
		return facets
	}

	m := re.FindStringSubmatch(logLine)
	if m == nil {
		return facets
	}

	for i, label := range labels {
		if label == "*" {
			continue
		}
		facets[strings.ToLower(label)] = m[i+1]
	}
	return facets
}

// escapeLiteral escapes s for use as a literal regex fragment, then relaxes
// single spaces to "\s+" so the extraction regex tolerates irregular
// whitespace in the raw log line.
func escapeLiteral(s string) string {
	return strings.ReplaceAll(regexp.QuoteMeta(s), " ", `\s+`)
}
