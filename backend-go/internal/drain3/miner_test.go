package drain3

import (
	"fmt"
	"testing"
)

func mustMiner(t *testing.T, cfg Config) *Miner {
	t.Helper()
	m, err := NewMiner(cfg)
	if err != nil {
		t.Fatalf("NewMiner: %v", err)
	}
	return m
}

// TestTrain_SimilarLinesClusterTogetherWithWildcardTemplate feeds two log
// lines that differ only in a numeric user ID and an IP address, and
// asserts they land in the same cluster with a template that has wildcarded
// exactly those two positions — the textbook Drain behavior.
func TestTrain_SimilarLinesClusterTogetherWithWildcardTemplate(t *testing.T) {
	m := mustMiner(t, DefaultConfig())

	id1, tmpl1, _ := m.Train("User 123 logged in from 10.0.0.5")
	id2, tmpl2, _ := m.Train("User 456 logged in from 10.0.0.9")

	if id1 != id2 {
		t.Fatalf("expected both lines in the same cluster, got %d and %d", id1, id2)
	}

	want := "User <*> logged in from <*>"
	if tmpl2 != want {
		t.Fatalf("template = %q, want %q", tmpl2, want)
	}
	// tmpl1 (returned at the time of the FIRST line) is necessarily the raw,
	// unwildcarded line: it's the template of a brand new cluster, before
	// the second line ever arrived to widen it.
	if tmpl1 != "User 123 logged in from 10.0.0.5" {
		t.Fatalf("tmpl1 = %q, want the raw first line (no merge has happened yet)", tmpl1)
	}

	if m.ClusterCount() != 1 {
		t.Fatalf("ClusterCount() = %d, want 1", m.ClusterCount())
	}
}

// TestTrain_SimilarLinesWithMoreDrift still cluster together as long as the
// fraction of agreeing tokens stays above the similarity threshold, and the
// template accumulates wildcards for every position that has ever drifted.
func TestTrain_SimilarLinesWithMoreDrift(t *testing.T) {
	m := mustMiner(t, DefaultConfig())

	lines := []string{
		"User 123 logged in from 10.0.0.5",
		"User 456 logged in from 10.0.0.9",
		"User 789 logged in from 10.0.0.1",
	}
	var lastID int
	var lastTemplate string
	for _, l := range lines {
		id, tmpl, _ := m.Train(l)
		lastID, lastTemplate = id, tmpl
	}

	if lastID != 1 {
		t.Fatalf("expected all three lines to stay cluster 1, got %d", lastID)
	}
	want := "User <*> logged in from <*>"
	if lastTemplate != want {
		t.Fatalf("template = %q, want %q", lastTemplate, want)
	}
}

// TestTrain_DistinctLinesGetSeparateClusters feeds lines that share no
// structure and asserts each gets its own cluster ID and unmodified
// (fully-literal) template.
func TestTrain_DistinctLinesGetSeparateClusters(t *testing.T) {
	m := mustMiner(t, DefaultConfig())

	id1, tmpl1, _ := m.Train("Connection refused by peer")
	id2, tmpl2, _ := m.Train("Disk space low on volume var")
	id3, tmpl3, _ := m.Train("Cache warm-up completed successfully today")

	if id1 == id2 || id2 == id3 || id1 == id3 {
		t.Fatalf("expected three distinct cluster IDs, got %d, %d, %d", id1, id2, id3)
	}
	if tmpl1 != "Connection refused by peer" {
		t.Fatalf("tmpl1 = %q, want unchanged literal template", tmpl1)
	}
	if tmpl2 != "Disk space low on volume var" {
		t.Fatalf("tmpl2 = %q, want unchanged literal template", tmpl2)
	}
	if tmpl3 != "Cache warm-up completed successfully today" {
		t.Fatalf("tmpl3 = %q, want unchanged literal template", tmpl3)
	}
	if m.ClusterCount() != 3 {
		t.Fatalf("ClusterCount() = %d, want 3", m.ClusterCount())
	}
}

// TestTrain_BelowSimilarityThresholdStaysSeparate: two same-length,
// same-first-token lines that agree on far fewer than 40% of tokens must
// NOT merge, even though they'd land in the same tree leaf.
func TestTrain_BelowSimilarityThresholdStaysSeparate(t *testing.T) {
	m := mustMiner(t, DefaultConfig())

	id1, _, _ := m.Train("Server alpha bravo charlie delta echo")
	id2, _, _ := m.Train("Server zulu yankee xray whiskey victor")

	if id1 == id2 {
		t.Fatalf("expected lines below the similarity threshold to stay in separate clusters, both got %d", id1)
	}
}

// TestMatch_ReadOnlyDoesNotMutateTree trains one cluster, then calls Match
// repeatedly and asserts the cluster count and stored template never
// change, and that Match finds the trained line (and close variants) while
// correctly reporting no match for something structurally different.
func TestMatch_ReadOnlyDoesNotMutateTree(t *testing.T) {
	m := mustMiner(t, DefaultConfig())

	// Train twice so the template actually gets wildcarded — Match()
	// requires a perfect score (sim_th=1.0, counting wildcard positions as
	// agreeing), so a still-literal, single-example template would
	// correctly refuse to match a line differing in those positions.
	trainID, _, _ := m.Train("User 123 logged in from 10.0.0.5")
	_, trainTemplate, _ := m.Train("User 456 logged in from 10.0.0.9")
	before := m.ClusterCount()

	for i := 0; i < 5; i++ {
		id, tmpl, _, ok := m.Match("User 999 logged in from 10.0.0.1")
		if !ok {
			t.Fatalf("Match() iteration %d: expected a match", i)
		}
		if id != trainID {
			t.Fatalf("Match() cluster id = %d, want %d", id, trainID)
		}
		if tmpl != trainTemplate {
			t.Fatalf("Match() template = %q, want %q", tmpl, trainTemplate)
		}
	}

	if m.ClusterCount() != before {
		t.Fatalf("ClusterCount() changed after Match(): before=%d after=%d", before, m.ClusterCount())
	}

	if _, _, _, ok := m.Match("Completely unrelated shutdown sequence initiated now"); ok {
		t.Fatalf("expected no match for a structurally unrelated line")
	}
}

// TestMaxChildren_CapsBranchingAndOverflowsToWildcard drives many
// same-token-count, distinct-first-token lines through a tree configured
// with a tiny MaxChildren, and asserts the top-level node never grows more
// children than the cap allows (the excess routes into a shared wildcard
// branch instead of getting dedicated branches).
func TestMaxChildren_CapsBranchingAndOverflowsToWildcard(t *testing.T) {
	cfg := DefaultConfig()
	cfg.MaxChildren = 3
	tr := newTree(cfg)

	firstTokens := []string{"Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf"}
	for i, first := range firstTokens {
		tr.clustersCounter++
		cluster := &LogCluster{
			Tokens: []string{first, "message", fmt.Sprintf("number-%d", i)},
			ID:     tr.clustersCounter,
			Size:   1,
		}
		tr.clusters.Set(cluster.ID, cluster)
		tr.addSeqToPrefixTree(tr.root, cluster)
	}

	lengthNode, ok := tr.root.children["3"]
	if !ok {
		t.Fatalf("expected a token-count-3 branch to exist")
	}

	if got := len(lengthNode.children); got > cfg.MaxChildren {
		t.Fatalf("top-level node has %d children, want <= max_children (%d)", got, cfg.MaxChildren)
	}

	if _, hasWildcard := lengthNode.children[tr.paramStr]; !hasWildcard {
		t.Fatalf("expected overflow to have created a %q wildcard branch", tr.paramStr)
	}

	// The wildcard leaf must have absorbed more than one cluster: with 7
	// distinct first tokens and max_children=3 (2 literal branches + 1
	// wildcard), at least 5 clusters should have overflowed into it.
	wildcardLeaf := lengthNode.children[tr.paramStr]
	if len(wildcardLeaf.clusterIDs) < len(firstTokens)-2 {
		t.Fatalf("wildcard leaf holds %d cluster IDs, want at least %d", len(wildcardLeaf.clusterIDs), len(firstTokens)-2)
	}
}

// TestMaxClusters_EvictsLeastRecentlyUsed configures a tiny MaxClusters and
// trains more distinct clusters than that cap allows, asserting the tree
// never tracks more than MaxClusters clusters and that the very first
// (least-recently-touched) cluster is no longer retrievable once evicted.
func TestMaxClusters_EvictsLeastRecentlyUsed(t *testing.T) {
	cfg := DefaultConfig()
	cfg.MaxClusters = 3
	// Use a large MaxChildren so distinct clusters aren't forced to share a
	// leaf for unrelated (branching-cap) reasons — this test targets the
	// clusters-total cap, not the children-per-node cap.
	cfg.MaxChildren = 1000
	m := mustMiner(t, cfg)

	// Five structurally distinct lines (different token counts so each is
	// unambiguously its own cluster) — well over the cap of 3.
	lines := []string{
		"alpha",
		"bravo charlie",
		"delta echo foxtrot",
		"golf hotel india juliet",
		"kilo lima mike november oscar",
	}

	var ids []int
	for _, l := range lines {
		id, _, _ := m.Train(l)
		ids = append(ids, id)
	}

	if got := m.ClusterCount(); got > cfg.MaxClusters {
		t.Fatalf("ClusterCount() = %d, want <= MaxClusters (%d)", got, cfg.MaxClusters)
	}

	// The first cluster (id=1, "alpha") should have been evicted by the
	// time the fifth distinct cluster was created, since it was never
	// touched again in between.
	firstStillTracked := false
	for _, c := range m.Clusters() {
		if c.ID == ids[0] {
			firstStillTracked = true
		}
	}
	if firstStillTracked {
		t.Fatalf("expected the least-recently-used cluster (id=%d) to have been evicted", ids[0])
	}
}

// TestMasking_ExtractsFacetsFromLabeledPatterns configures IP and UUID
// masks and asserts that training/matching extracts the raw (unmasked)
// values into facets keyed by lowercased label, and that the mined
// template contains the mask placeholder rather than the raw value.
func TestMasking_ExtractsFacetsFromLabeledPatterns(t *testing.T) {
	cfg := DefaultConfig()
	cfg.MaskingInstructions = BuildMaskingInstructions([]MaskRule{
		{Pattern: `\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b`, Label: "IP", Enabled: true},
		{Pattern: `[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}`, Label: "UUID", Enabled: true},
		{Pattern: `(disabled)`, Label: "SHOULD_NOT_APPEAR", Enabled: false},
	})
	m := mustMiner(t, cfg)

	line := "Request abc12345-1234-5678-9abc-1234567890ab from 10.0.0.5 failed"
	_, template, facets := m.Train(line)

	if facets["ip"] != "10.0.0.5" {
		t.Fatalf("facets[ip] = %q, want %q (facets: %#v)", facets["ip"], "10.0.0.5", facets)
	}
	if facets["uuid"] != "abc12345-1234-5678-9abc-1234567890ab" {
		t.Fatalf("facets[uuid] = %q, want the raw UUID (facets: %#v)", facets["uuid"], facets)
	}
	if got := template; got != "Request <UUID> from <IP> failed" {
		t.Fatalf("template = %q, want mask placeholders substituted", got)
	}

	// A second, similar line with different IP/UUID values should land in
	// the same cluster (masking happens before tokenization/similarity
	// scoring) and yield its own distinct facet values.
	line2 := "Request def98765-4321-8765-cba9-0987654321fe from 10.0.0.9 failed"
	clusterID1, _, _ := m.Train(line)
	clusterID2, _, facets2 := m.Train(line2)
	if clusterID1 != clusterID2 {
		t.Fatalf("expected masked-identical lines to share a cluster, got %d and %d", clusterID1, clusterID2)
	}
	if facets2["ip"] != "10.0.0.9" {
		t.Fatalf("facets2[ip] = %q, want %q", facets2["ip"], "10.0.0.9")
	}

	// Match() (read-only) must extract the same facets for a fresh line.
	_, _, matchFacets, ok := m.Match("Request 11111111-2222-3333-4444-555555555555 from 10.0.0.42 failed")
	if !ok {
		t.Fatalf("expected Match() to find the trained cluster")
	}
	if matchFacets["ip"] != "10.0.0.42" {
		t.Fatalf("Match() facets[ip] = %q, want %q", matchFacets["ip"], "10.0.0.42")
	}
}

// TestBuildMaskingInstructions_SkipsInvalidAndDisabled asserts the
// filtering rules mirror parser.py:_apply_masking_instructions exactly:
// disabled, patternless, labelless, and non-compiling rules are all
// silently dropped rather than erroring.
func TestBuildMaskingInstructions_SkipsInvalidAndDisabled(t *testing.T) {
	rules := []MaskRule{
		{Pattern: `\d+`, Label: "NUM", Enabled: true},
		{Pattern: `\d+`, Label: "DISABLED", Enabled: false},
		{Pattern: "", Label: "NOPATTERN", Enabled: true},
		{Pattern: `\d+`, Label: "", Enabled: true},
		{Pattern: `(unterminated[`, Label: "BADREGEX", Enabled: true},
	}

	out := BuildMaskingInstructions(rules)
	if len(out) != 1 {
		t.Fatalf("BuildMaskingInstructions returned %d instructions, want 1: %#v", len(out), out)
	}
	if out[0].Label != "NUM" {
		t.Fatalf("surviving instruction label = %q, want NUM", out[0].Label)
	}
}

// TestPersistence_SaveAndLoadRoundTrip trains a Miner, saves it, loads the
// snapshot into a fresh Miner, and asserts both training continuity
// (matching still works) and that the cluster count / templates survive
// the round trip.
func TestPersistence_SaveAndLoadRoundTrip(t *testing.T) {
	dir := t.TempDir()
	path := dir + "/snapshot.json"

	m1 := mustMiner(t, DefaultConfig())
	m1.Train("User 123 logged in from 10.0.0.5")
	m1.Train("User 456 logged in from 10.0.0.9")
	m1.Train("Disk space low on volume var")

	if err := m1.SaveToFile(path); err != nil {
		t.Fatalf("SaveToFile: %v", err)
	}

	m2 := mustMiner(t, DefaultConfig())
	// Loading into a Miner with no prior state.
	if err := m2.LoadFromFile(path); err != nil {
		t.Fatalf("LoadFromFile: %v", err)
	}

	if m2.ClusterCount() != m1.ClusterCount() {
		t.Fatalf("ClusterCount() after load = %d, want %d", m2.ClusterCount(), m1.ClusterCount())
	}

	id, tmpl, _, ok := m2.Match("User 789 logged in from 10.0.0.1")
	if !ok {
		t.Fatalf("expected loaded miner to match a variant of a trained line")
	}
	if tmpl != "User <*> logged in from <*>" {
		t.Fatalf("template after load = %q, want %q", tmpl, "User <*> logged in from <*>")
	}
	_ = id

	// Loading a nonexistent file must be a no-op, not an error.
	m3 := mustMiner(t, DefaultConfig())
	if err := m3.LoadFromFile(dir + "/does-not-exist.json"); err != nil {
		t.Fatalf("LoadFromFile(missing) returned error: %v", err)
	}
	if m3.ClusterCount() != 0 {
		t.Fatalf("LoadFromFile(missing) should leave miner empty, got %d clusters", m3.ClusterCount())
	}
}

// TestDepthValidation asserts NewMiner rejects Depth < 3, mirroring
// upstream Drain's own constructor validation (drain.py:80-81).
func TestDepthValidation(t *testing.T) {
	cfg := DefaultConfig()
	cfg.Depth = 2
	if _, err := NewMiner(cfg); err == nil {
		t.Fatalf("expected NewMiner to reject Depth=2")
	}
}
