package drain3

import (
	"fmt"
	"sync"
)

// Miner is the Go port of sidecar/src/parser.py's DrainParser (itself a
// thin wrapper over drain3's TemplateMiner): masking, the Drain prefix
// tree, and facet extraction behind a lock-guarded API split into a
// tree-mutating Train() and a read-only Match(), matching parser.py's
// parse()/match() split exactly (parser.py's match() docstring: "Identify
// cluster for a log line without updating the tree. Thread-safe and
// suitable for parallel tagging.").
//
// Concurrency: Python protects the whole miner with a single
// threading.RLock (parser.py:38, self.lock) — parse() acquires it, and
// match() is documented as thread-safe on its own without a matching
// explicit lock() call in parser.py's match() body (it relies on
// drain3.Drain.match's read-only-ness plus the GIL). Go can express the
// intended distinction directly with a sync.RWMutex: Train takes the write
// lock (exclusive, since it mutates the tree), Match takes the read lock
// (many goroutines may Match concurrently; they only block out — and are
// blocked by — a Train). That's the same net effect Python's design goes
// for, and it's what lets the clustering worker's tag phase (see
// internal/services/clustering) run many goroutines calling Match()
// concurrently against the very tree Train() is also updating, safely.
type Miner struct {
	mu     sync.RWMutex
	cfg    Config
	masker *masker
	tree   *tree
}

// NewMiner constructs a Miner from cfg, validating Depth (must be >= 3,
// same as upstream Drain's constructor: "depth argument must be at least
// 3", drain.py:80-81) and filling in the same zero-value defaults
// DefaultConfig uses for any field left unset.
func NewMiner(cfg Config) (*Miner, error) {
	if cfg.Depth == 0 {
		cfg.Depth = 4
	}
	if cfg.Depth < 3 {
		return nil, fmt.Errorf("drain3: depth must be at least 3, got %d", cfg.Depth)
	}
	if cfg.ParamStr == "" {
		cfg.ParamStr = "<*>"
	}
	if cfg.MaskPrefix == "" {
		cfg.MaskPrefix = "<"
	}
	if cfg.MaskSuffix == "" {
		cfg.MaskSuffix = ">"
	}

	return &Miner{
		cfg:    cfg,
		masker: newMasker(cfg.MaskingInstructions, cfg.MaskPrefix, cfg.MaskSuffix),
		tree:   newTree(cfg),
	}, nil
}

// Train masks logLine, feeds it through the Drain tree (creating a new
// cluster or widening an existing one's template), and extracts facets for
// any masking labels present in the resulting template. Mutates the tree —
// callers must serialize calls to Train the way parser.py's parse() does
// under its lock (Miner does this internally via the write half of its
// RWMutex, so external synchronization isn't required, but concurrent
// Train calls will still serialize against each other and against any
// in-flight Match).
//
// Ports DrainParser.parse (parser.py:62-86) plus TemplateMiner.add_log_message
// (template_miner.py:119-147, minus its persistence/profiling/snapshot
// bookkeeping, which lives in this package's persistence.go instead of
// being triggered automatically per line).
func (m *Miner) Train(logLine string) (clusterID int, template string, facets map[string]string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	masked := m.masker.mask(logLine)
	cluster, _ := m.tree.addLogMessage(masked)
	template = cluster.Template()
	facets = extractFacets(template, logLine, m.cfg)

	return cluster.ID, template, facets
}

// Match masks logLine and looks it up against the existing tree without
// creating or modifying any cluster. Read-only — safe to call from many
// goroutines concurrently (see the Miner doc comment above), which is
// exactly what the clustering worker's parallel tag phase does.
//
// Ports DrainParser.match (parser.py:88-100) plus TemplateMiner.match
// (template_miner.py:149-171, "never" search-strategy only — see tree.match's
// doc comment for why the "fallback"/"always" strategies aren't ported).
func (m *Miner) Match(logLine string) (clusterID int, template string, facets map[string]string, ok bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	masked := m.masker.mask(logLine)
	cluster := m.tree.match(masked)
	if cluster == nil {
		return 0, "", nil, false
	}
	template = cluster.Template()
	facets = extractFacets(template, logLine, m.cfg)

	return cluster.ID, template, facets, true
}

// Clusters returns a snapshot slice of every currently-tracked cluster
// (deep copies, safe to read without further locking). Ports
// DrainParser.get_clusters (parser.py:102-105).
func (m *Miner) Clusters() []LogCluster {
	m.mu.RLock()
	defer m.mu.RUnlock()

	src := m.tree.clusters.Values()
	out := make([]LogCluster, len(src))
	for i, c := range src {
		out[i] = *c.clone()
	}
	return out
}

// ClusterCount returns the number of clusters currently tracked (bounded
// by cfg.MaxClusters once training has produced at least that many).
func (m *Miner) ClusterCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.tree.clusters.Len()
}

// Config returns a copy of the Miner's configuration.
func (m *Miner) Config() Config {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.cfg
}
