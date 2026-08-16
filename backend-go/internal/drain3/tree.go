package drain3

import (
	"strconv"
	"strings"
	"unicode"
)

// ChangeType mirrors the change_type string drain3.drain.Drain.add_log_message
// returns, describing what training on one log line did.
type ChangeType string

const (
	// ChangeNone: the line matched an existing cluster and its template
	// did not need to change (every non-wildcard template token already
	// matched).
	ChangeNone ChangeType = "none"
	// ChangeClusterCreated: no existing cluster matched closely enough
	// (or none had the same token count/first-token path); a new cluster
	// was created.
	ChangeClusterCreated ChangeType = "cluster_created"
	// ChangeTemplateChanged: the line matched an existing cluster but
	// widened its template with one or more new <*> wildcards.
	ChangeTemplateChanged ChangeType = "cluster_template_changed"
)

// tree is a faithful port of drain3.drain.Drain: a fixed-depth prefix tree
// keyed first by token count, then by up to (depth-2) literal tokens, with
// each leaf holding candidate cluster IDs scored by fraction-of-matching-
// tokens against a similarity threshold (the Drain algorithm from
// "Drain: An Online Log Parsing Approach with Fixed Depth Tree", He et al.)
type tree struct {
	maxNodeDepth             int // depth - 2, per upstream: "max depth of a prefix tree node, starting from zero"
	simTh                    float64
	maxChildren              int
	paramStr                 string
	parametrizeNumericTokens bool
	extraDelimiters          []string

	root            *node
	clusters        *clusterCache
	clustersCounter int
}

func newTree(cfg Config) *tree {
	return &tree{
		maxNodeDepth:             cfg.Depth - 2,
		simTh:                    cfg.SimTh,
		maxChildren:              cfg.MaxChildren,
		paramStr:                 cfg.ParamStr,
		parametrizeNumericTokens: cfg.ParametrizeNumericTokens,
		extraDelimiters:          cfg.ExtraDelimiters,
		root:                     newNode(),
		clusters:                 newClusterCache(cfg.MaxClusters),
	}
}

// tokenize splits content into whitespace-separated tokens after applying
// extraDelimiters as literal substring replacements, mirroring
// Drain.get_content_as_tokens: `content.strip()`, then
// `content.replace(delimiter, " ")` per extra delimiter, then
// `content.split()` (which — like strings.Fields — splits on runs of
// whitespace and drops empty tokens).
func (t *tree) tokenize(content string) []string {
	content = strings.TrimSpace(content)
	for _, d := range t.extraDelimiters {
		content = strings.ReplaceAll(content, d, " ")
	}
	return strings.Fields(content)
}

func hasNumbers(s string) bool {
	for _, r := range s {
		if unicode.IsDigit(r) {
			return true
		}
	}
	return false
}

// treeSearch descends the prefix tree to find the leaf node whose path
// matches tokens' first min(maxNodeDepth-1, tokenCount-1) tokens (falling
// back to a wildcard child at each level when no exact-token child
// exists), then scores that leaf's candidate clusters with fastMatch.
// Ports Drain.tree_search verbatim (drain.py:106-142).
func (t *tree) treeSearch(root *node, tokens []string, simTh float64, includeParams bool) *LogCluster {
	tokenCount := len(tokens)
	cur, ok := root.children[strconv.Itoa(tokenCount)]
	if !ok {
		return nil
	}

	if tokenCount == 0 {
		if len(cur.clusterIDs) == 0 {
			return nil
		}
		return t.clusters.Get(cur.clusterIDs[0])
	}

	depth := 1
	for _, tok := range tokens {
		if depth >= t.maxNodeDepth {
			break
		}
		if depth == tokenCount {
			break
		}

		next, ok := cur.children[tok]
		if !ok {
			next, ok = cur.children[t.paramStr]
			if !ok {
				return nil
			}
		}
		cur = next
		depth++
	}

	return t.fastMatch(cur.clusterIDs, tokens, simTh, includeParams)
}

// addSeqToPrefixTree inserts cluster into the tree along a path derived
// from its (possibly already-wildcarded) template tokens, applying the
// max_children cap: once an internal node has max_children distinct
// children, any further distinct token routes into a shared "<*>" child
// instead of getting its own branch. Ports Drain.add_seq_to_prefix_tree
// verbatim (drain.py:144-208), including its exact max_children boundary
// arithmetic (`< max_children` vs `== max_children` vs neither).
func (t *tree) addSeqToPrefixTree(root *node, cluster *LogCluster) {
	tokenCount := len(cluster.Tokens)
	key := strconv.Itoa(tokenCount)
	first, ok := root.children[key]
	if !ok {
		first = newNode()
		root.children[key] = first
	}
	cur := first

	if tokenCount == 0 {
		cur.clusterIDs = []int{cluster.ID}
		return
	}

	depth := 1
	for _, tok := range cluster.Tokens {
		if depth >= t.maxNodeDepth || depth >= tokenCount {
			// Leaf: clean up any cluster IDs this leaf still references
			// that have since been evicted from the LRU cache, then add
			// this cluster. Mirrors the "clean up stale clusters before
			// adding a new one" comment in drain.py:165.
			newIDs := make([]int, 0, len(cur.clusterIDs)+1)
			for _, id := range cur.clusterIDs {
				if t.clusters.Get(id) != nil {
					newIDs = append(newIDs, id)
				}
			}
			newIDs = append(newIDs, cluster.ID)
			cur.clusterIDs = newIDs
			return
		}

		child, exists := cur.children[tok]
		if !exists {
			switch {
			case t.parametrizeNumericTokens && hasNumbers(tok):
				// Tokens containing a digit always route to the shared
				// wildcard branch (creating it if needed), regardless of
				// max_children.
				if w, ok := cur.children[t.paramStr]; ok {
					cur = w
				} else {
					w := newNode()
					cur.children[t.paramStr] = w
					cur = w
				}
			default:
				if _, hasWildcard := cur.children[t.paramStr]; hasWildcard {
					if len(cur.children) < t.maxChildren {
						nw := newNode()
						cur.children[tok] = nw
						cur = nw
					} else {
						cur = cur.children[t.paramStr]
					}
				} else if len(cur.children)+1 < t.maxChildren {
					nw := newNode()
					cur.children[tok] = nw
					cur = nw
				} else if len(cur.children)+1 == t.maxChildren {
					nw := newNode()
					cur.children[t.paramStr] = nw
					cur = nw
				} else {
					cur = cur.children[t.paramStr]
				}
			}
		} else {
			cur = child
		}
		depth++
	}
}

// seqDistance scores template (a cluster's token sequence) against tokens
// (an incoming log line's tokens, same length) as the fraction of tokens
// that agree, optionally counting wildcard positions as agreeing too.
// Ports Drain.get_seq_distance verbatim (drain.py:211-233).
func (t *tree) seqDistance(template, tokens []string, includeParams bool) (float64, int) {
	if len(template) == 0 {
		return 1.0, 0
	}

	simTokens := 0
	paramCount := 0
	for i, tk := range template {
		tok2 := tokens[i]
		if tk == t.paramStr {
			paramCount++
			continue
		}
		if tk == tok2 {
			simTokens++
		}
	}
	if includeParams {
		simTokens += paramCount
	}
	return float64(simTokens) / float64(len(template)), paramCount
}

// fastMatch picks the best-scoring cluster among clusterIDs (by seqDistance,
// tie-broken toward more wildcard matches), returning nil if the best score
// is below simTh. Ports Drain.fast_match verbatim (drain.py:235-265).
func (t *tree) fastMatch(clusterIDs []int, tokens []string, simTh float64, includeParams bool) *LogCluster {
	var best *LogCluster
	maxSim := -1.0
	maxParam := -1

	for _, id := range clusterIDs {
		c := t.clusters.Get(id)
		if c == nil {
			continue
		}
		sim, paramCount := t.seqDistance(c.Tokens, tokens, includeParams)
		if sim > maxSim || (sim == maxSim && paramCount > maxParam) {
			maxSim = sim
			maxParam = paramCount
			best = c
		}
	}

	if maxSim >= simTh {
		return best
	}
	return nil
}

// createTemplate merges newTokens (an incoming log line's tokens) into
// oldTemplate (the matched cluster's current template), wildcarding any
// position where they disagree. Because oldTemplate may already contain
// wildcards from earlier merges, and a wildcard position always disagrees
// with any concrete new token, this is monotonic: once a position is
// wildcarded it stays wildcarded. Ports Drain.create_template verbatim
// (drain.py:267-275).
func createTemplate(newTokens, oldTemplate []string, paramStr string) []string {
	result := make([]string, len(oldTemplate))
	copy(result, oldTemplate)
	for i := range result {
		if newTokens[i] != oldTemplate[i] {
			result[i] = paramStr
		}
	}
	return result
}

func equalTokens(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

// addLogMessage is the tree-mutating training entry point: masked content
// is tokenized, matched against the tree (sim_th, without counting
// wildcards toward similarity — matching upstream's
// `include_params=False` at drain.py:315), and either merged into the
// matched cluster's template or used to create a brand new cluster. Ports
// Drain.add_log_message verbatim (drain.py:310-348).
func (t *tree) addLogMessage(content string) (*LogCluster, ChangeType) {
	tokens := t.tokenize(content)
	match := t.treeSearch(t.root, tokens, t.simTh, false)

	if match == nil {
		t.clustersCounter++
		id := t.clustersCounter
		cluster := &LogCluster{Tokens: append([]string(nil), tokens...), ID: id, Size: 1}
		t.clusters.Set(id, cluster)
		t.addSeqToPrefixTree(t.root, cluster)
		return cluster, ChangeClusterCreated
	}

	newTemplate := createTemplate(tokens, match.Tokens, t.paramStr)
	changeType := ChangeNone
	if !equalTokens(newTemplate, match.Tokens) {
		match.Tokens = newTemplate
		changeType = ChangeTemplateChanged
	}
	match.Size++
	t.clusters.Touch(match.ID)

	return match, changeType
}

// match is the read-only lookup entry point: masked content is tokenized
// and matched against the tree requiring a perfect score (sim_th=1.0,
// counting wildcard positions as agreeing — `include_params=True`), and no
// cluster is created or modified. Only implements upstream's
// full_search_strategy="never" (tree search only, no linear fallback across
// same-token-count clusters) — the only strategy TemplateMiner.match ever
// uses by default, and the only one sidecar/src/parser.py relies on. Ports
// the "never" branch of Drain.match (drain.py:370-415).
func (t *tree) match(content string) *LogCluster {
	tokens := t.tokenize(content)
	return t.treeSearch(t.root, tokens, 1.0, true)
}
