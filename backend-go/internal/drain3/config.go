package drain3

// Config mirrors the subset of drain3's TemplateMinerConfig
// (template_miner_config.py) that sidecar/src/parser.py's DrainParser
// actually exposes/overrides (SimTh, MaxChildren, MaxClusters,
// MaskingInstructions — parser.py:15-29), plus the Drain-internal defaults
// parser.py never touches (Depth=4, ParamStr="<*>",
// ParametrizeNumericTokens=true, MaskPrefix/Suffix="<"/">").
//
// Note on SimTh's default: drain3's TemplateMinerConfig defaults
// drain_sim_th to 0.4, and that is also parser.py's own DrainParser(...)
// constructor default (parser.py:15). The LogLens app's *runtime* default,
// as seeded into the `drain_similarity_threshold` setting
// (backend-go/internal/db/settings.go), is 0.5 — but that's an
// application-layer choice about what value to pass in, not a difference
// in this library's own default. DefaultConfig() intentionally mirrors the
// library default (0.4), matching parser.py's constructor signature; the
// caller (the clustering service, reading from `settings`) is responsible
// for overriding SimTh with whatever the app has configured.
type Config struct {
	// SimTh is the similarity threshold: a log line joins an existing
	// cluster only if the fraction of its tokens agreeing with that
	// cluster's template is >= SimTh.
	SimTh float64
	// Depth is Drain's max tree depth (root=1, token-count=2, then up to
	// Depth-2 literal-token levels before every deeper log line collapses
	// into the same leaf). Must be >= 3.
	Depth int
	// MaxChildren caps how many distinct children an internal tree node
	// may have before further distinct tokens are routed into a shared
	// wildcard branch.
	MaxChildren int
	// MaxClusters caps how many clusters are tracked at once; 0 means
	// unlimited. Once the cap is hit, the least-recently-touched cluster
	// is evicted to make room for a new one (LRU).
	MaxClusters int
	// ExtraDelimiters are extra literal substrings treated as token
	// separators in addition to whitespace, applied before tokenization.
	ExtraDelimiters []string
	// ParamStr is the wildcard token Drain inserts for a differing
	// position, e.g. "<*>".
	ParamStr string
	// ParametrizeNumericTokens: when true, any token containing a digit is
	// always routed to the tree's wildcard branch during insertion,
	// instead of getting its own dedicated branch.
	ParametrizeNumericTokens bool
	// MaskPrefix / MaskSuffix wrap a masking instruction's label to form
	// the placeholder inserted into content, e.g. "<" + "IP" + ">".
	MaskPrefix string
	MaskSuffix string
	// MaskingInstructions are applied, in order, to raw content before
	// tokenization (see masker.mask).
	MaskingInstructions []MaskingInstruction
}

// DefaultConfig returns the drain3 library defaults, equivalent to
// TemplateMinerConfig()'s zero-value construction plus
// sidecar/src/parser.py's DrainParser(...) constructor defaults.
func DefaultConfig() Config {
	return Config{
		SimTh:                    0.4,
		Depth:                    4,
		MaxChildren:              100,
		MaxClusters:              1000,
		ParamStr:                 "<*>",
		ParametrizeNumericTokens: true,
		MaskPrefix:               "<",
		MaskSuffix:               ">",
	}
}
