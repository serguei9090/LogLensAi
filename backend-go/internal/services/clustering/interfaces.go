// Package clustering is the Go port of sidecar/src/workers/clustering.py's
// ClusteringWorker: a background "train-then-tag" batch pipeline that pulls
// unprocessed `logs` rows, trains the shared drain3.Miner tree sequentially
// on a sample, tags the remainder in parallel against that (now-updated)
// tree, and applies the results back to the database in one batched update
// per cycle.
package clustering

import "loglensai/backend-go/internal/drain3"

// LineHydrator resolves raw log text that wasn't inlined into the `logs`
// table at ingest time (logs.raw_text IS NULL, only line_id is known).
// Mirrors clustering.py's `self.app.fast_path.get_lines(source_id,
// line_ids)` call (clustering.py:292).
//
// Interface assumption for the fast-path/log-storage author (this is the
// seam mentioned in the task brief — fast_path storage is a parallel,
// not-yet-built workstream): GetLines is keyed by (sourceID, lineIDs) and
// returns a map from lineID to raw text. A lineID absent from the returned
// map, or present with an empty string, is treated the same as Python's
// `raw is None` — the row is marked "MISSING" (level="MISSING", no
// cluster) rather than retried. Unlike Python's per-(source,line)
// quarantine-with-exponential-backoff retry loop
// (clustering.py:_hydrate_log_text, 892-921 — up to 8 retries before giving
// up), this port does NOT retry a hydration miss across cycles: it commits
// to MISSING on the first miss. That's a deliberate scope trim (retry
// bookkeeping across cycles is stateful, cross-cutting complexity that
// depends on how the real fast-path implementation actually fails/recovers
// — better decided once that dependency is real than guessed at here); flag
// to the fast-path author if retry-before-MISSING semantics are wanted, and
// this hydration call can be revisited then.
type LineHydrator interface {
	GetLines(sourceID string, lineIDs []int64) (map[int64]string, error)
}

// ExtractedMetadata is what a MetadataExtractor pulls out of one raw log
// line before it reaches Drain: the message portion to actually cluster on
// (raw text minus any timestamp/level prefix), plus timestamp, level, and
// any custom facets extracted by workspace-configured regex rules. Mirrors
// the dict returned by sidecar/src/metadata_extractor.py's
// extract_log_metadata.
type ExtractedMetadata struct {
	Message   string
	Timestamp string
	Level     string
	Facets    map[string]string
}

// MetadataExtractor turns one raw log line into the message text Drain
// should cluster on, plus timestamp/level/custom-facet metadata. This is a
// stand-in for sidecar/src/metadata_extractor.py (311 lines: timestamp
// format auto-detection across 7+ formats, level detection, Apache/Nginx
// combined-log parsing, custom regex facet rules) — a distinct subsystem
// from Drain clustering that this task was explicitly scoped to NOT port
// (the task brief's focus is "Drain3 + the batch worker"; metadata
// extraction is timestamp/level/facet-rule parsing, unrelated to the
// clustering algorithm itself).
//
// Interface assumption for whoever ports metadata_extractor.py: Extract
// receives the RAW, unmodified log text and existing facets already
// attached to the row (decoded from logs.facets), and must return the
// isolated message portion for Drain to tokenize as ExtractedMetadata.Message
// — the worker never calls drain3 on raw text directly, only on
// ExtractedMetadata.Message, exactly like Python's `meta["message"]`
// (clustering.py:328, :96-97 via _match_and_extract_parameters). Facets in
// the returned ExtractedMetadata should already merge the caller-supplied
// existingFacets, matching Python's
// `meta["facets"].update(existing_facets)` (clustering.py:325, :94).
type MetadataExtractor interface {
	Extract(workspaceID, sourceID, rawText string, existingFacets map[string]string) (ExtractedMetadata, error)
}

// DefaultMetadataExtractor is a placeholder MetadataExtractor: it passes
// raw text through unchanged as the message and detects no
// timestamp/level. It exists purely so this package builds, is testable in
// isolation, and is usable end-to-end before a real metadata_extractor.py
// port lands — production wiring should inject a real implementation via
// NewWorker.
type DefaultMetadataExtractor struct{}

// Extract implements MetadataExtractor.
func (DefaultMetadataExtractor) Extract(_, _, rawText string, existingFacets map[string]string) (ExtractedMetadata, error) {
	facets := make(map[string]string, len(existingFacets))
	for k, v := range existingFacets {
		facets[k] = v
	}
	return ExtractedMetadata{Message: rawText, Facets: facets}, nil
}

// MinerProvider resolves the drain3.Miner to use for a given workspace.
// Ports the recurring `self.app.get_drain_parser(ws_id)` calls throughout
// clustering.py (e.g. clustering.py:327, :366, :538). A single shared Miner
// for every workspace is a valid implementation:
//
//	func(_ string) (*drain3.Miner, error) { return sharedMiner, nil }
type MinerProvider func(workspaceID string) (*drain3.Miner, error)
