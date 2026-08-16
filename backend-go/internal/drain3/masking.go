package drain3

import (
	"regexp"
	"strings"
)

// MaskRule is the input shape for building masking instructions: a regex
// pattern + label with an enabled flag, mirroring the dicts
// sidecar/src/parser.py's DrainParser constructor accepts as
// masking_instructions (parser.py:40-60) — themselves sourced from the
// `drain_masks` JSON setting (see backend-go/internal/db/migrations.go's
// maskRule / defaultDrainMasks).
type MaskRule struct {
	Pattern string
	Label   string
	Enabled bool
}

// MaskingInstruction is a compiled masking rule: content matching Regex is
// replaced with "<Label>" (using the configured mask prefix/suffix) before
// tokenization. Mirrors drain3.masking.MaskingInstruction.
type MaskingInstruction struct {
	Pattern string
	Label   string
	Regex   *regexp.Regexp
}

// BuildMaskingInstructions compiles rules into MaskingInstructions,
// silently skipping disabled rules, rules missing a pattern or label, and
// rules whose pattern fails to compile — mirroring
// DrainParser._apply_masking_instructions (parser.py:40-60), which
// validates with `re.compile` and skips on `re.error`.
//
// One behavioral difference from Python: Go's regexp package is RE2-based
// and does not support lookahead/lookbehind assertions, which Python's `re`
// does. A mask pattern relying on those compiles fine under Python and
// would be silently skipped here instead. The shipped defaults
// (db.defaultDrainMasks — IP/UUID/HTTP_STATUS/HTTP_METHOD) are already
// lookaround-free (the IP pattern was in fact migrated in Go's Phase 1 db
// package specifically to drop a lookbehind, see migrateDrainMasks), but
// user-supplied masks in the `drain_masks` setting could still hit this
// if they use PCRE-only features — worth flagging to whoever wires up the
// settings-backed masking config in the clustering service.
func BuildMaskingInstructions(rules []MaskRule) []MaskingInstruction {
	var out []MaskingInstruction
	for _, r := range rules {
		if !r.Enabled || r.Pattern == "" || r.Label == "" {
			continue
		}
		re, err := regexp.Compile(r.Pattern)
		if err != nil {
			continue
		}
		out = append(out, MaskingInstruction{Pattern: r.Pattern, Label: r.Label, Regex: re})
	}
	return out
}

// masker applies a sequence of MaskingInstructions to raw log content prior
// to tokenization. Mirrors drain3.masking.LogMasker.mask (masking.py:56-59):
// each instruction is applied in order, sequentially mutating the content,
// so a later pattern can match text an earlier mask inserted.
type masker struct {
	instructions   []MaskingInstruction
	prefix, suffix string
}

func newMasker(instructions []MaskingInstruction, prefix, suffix string) *masker {
	return &masker{instructions: instructions, prefix: prefix, suffix: suffix}
}

func (m *masker) mask(content string) string {
	for _, mi := range m.instructions {
		// Escape any literal "$" in the replacement so Go's
		// regexp.ReplaceAllString doesn't interpret it as a submatch
		// reference (Python's re.sub has no equivalent gotcha here).
		replacement := strings.ReplaceAll(m.prefix+mi.Label+m.suffix, "$", "$$")
		content = mi.Regex.ReplaceAllString(content, replacement)
	}
	return content
}
