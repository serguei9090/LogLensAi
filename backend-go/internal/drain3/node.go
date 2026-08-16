// Package drain3 is a Go port of the drain3 Python library's core
// algorithm (https://github.com/logpai/Drain3, vendored at
// .venv/Lib/site-packages/drain3 in this repo), as wrapped by
// sidecar/src/parser.py's DrainParser. It implements Drain: a fixed-depth
// prefix-tree log parser that mines a token-sequence template (with <*>
// wildcards) per cluster of similar log lines, online and unsupervised.
//
// This package was ported by reading drain3's actual installed source
// (drain.py, template_miner.py, masking.py, template_miner_config.py)
// rather than reimplementing from a paper description, so the tree-search,
// tree-insertion, similarity-scoring, and template-merging logic below
// mirror the upstream implementation function-for-function. See the doc
// comments on tree.treeSearch, tree.addSeqToPrefixTree, tree.fastMatch, and
// createTemplate for the specific upstream functions each ports.
//
// Deliberate differences from upstream drain3, all called out where they
// occur:
//   - Persistence (persistence.go) snapshots the flat cluster list as JSON
//     and rebuilds the tree on load, instead of upstream's
//     jsonpickle+zlib+base64 serialization of the entire Node tree. Not
//     byte-compatible with old Python snapshots, and doesn't need to be
//     (see persistence.go).
//   - Miner.Match only implements upstream's full_search_strategy="never"
//     (tree-search only, no linear fallback), since that's the only
//     strategy sidecar/src/parser.py and clustering.py ever use.
//   - Facet extraction (facets.go) only implements upstream's
//     extract_parameters(exact_matching=false) code path, since
//     parser.py always calls it that way; exact_matching=true (which uses
//     each mask's own regex pattern per capture group, not a generic
//     ".+?") is not implemented.
package drain3

// node is one prefix-tree node: either an internal branching node keyed by
// token, or (once a leaf is reached) a holder of candidate cluster IDs to
// be scored by fastMatch. Mirrors drain3.drain.Node.
type node struct {
	children   map[string]*node
	clusterIDs []int
}

func newNode() *node {
	return &node{children: make(map[string]*node)}
}
