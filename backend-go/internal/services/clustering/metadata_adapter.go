package clustering

import "loglensai/backend-go/internal/metadata"

// This file is the reconciliation point promised by MetadataExtractor's and
// LineHydrator's doc comments in interfaces.go: internal/metadata and
// internal/services/logstore (built in a separate, parallel workstream from
// this package, per the migration plan) turned out to line up closely with
// the interfaces this package stubbed while that work was in flight.
//
//   - logstore.FastPathService.GetLines(sourceID string, lineIDs []int64)
//     (map[int64]string, error) has the exact same signature as this
//     package's LineHydrator.GetLines — so *logstore.FastPathService can be
//     passed directly as a Worker's LineHydrator with zero adapter code
//     (Go's structural interface satisfaction just works here). No file
//     needed for that half of the reconciliation.
//   - metadata.ExtractLogMetadata (the real port of
//     sidecar/src/metadata_extractor.py) is a pure function of
//     (rawLine, rules, parserConfig, tzOffset), not a per-row method with
//     workspace/source identity baked in — matching Python's
//     extract_log_metadata(raw_text, custom_rules=rules,
//     parser_config=p_config, tz_offset=p_tz) call shape in
//     clustering.py:320-321/:88-90, where the rules/parser_config/tz_offset
//     inputs are resolved separately (via
//     self.app._get_facet_rules_for_workspace /
//     self._get_parser_config, clustering.py:316-319, :923-953) before
//     being passed in. metadataAdapter below is that small amount of glue.

// MetadataConfigResolver resolves the per-(workspace, source) inputs
// metadata.ExtractLogMetadata needs. Mirrors clustering.py's
// _get_facet_rules_for_workspace / _get_parser_config, which read
// `settings.facet_extractions` and `fusion_configs.parser_config` /
// `fusion_configs.tz_offset` respectively (clustering.py:923-953), each
// with their own per-batch cache (rules_cache/parser_configs dicts) to
// avoid a DB round trip per row.
//
// This package deliberately does not implement MetadataConfigResolver
// itself: doing so needs internal/db helpers this task's scope didn't
// include (fusion_configs / settings reads for clustering specifically),
// and duplicating query logic against another workstream's DB access
// patterns without coordinating on caching strategy seemed more likely to
// cause a second reconciliation than to save one. Whoever wires the
// production dependency injection root (constructing the real Worker) is
// expected to implement this against internal/db, most likely with its own
// per-batch cache — the same shape Python's rules_cache/parser_configs
// dicts already establish as the right pattern.
type MetadataConfigResolver interface {
	RulesFor(workspaceID string) []metadata.Rule
	ParserConfigFor(workspaceID, sourceID string) (*metadata.ParserConfig, float64)
}

// metadataAdapter adapts metadata.ExtractLogMetadata to this package's
// MetadataExtractor interface.
type metadataAdapter struct {
	resolver MetadataConfigResolver
}

// NewMetadataAdapter builds a MetadataExtractor backed by the real
// internal/metadata.ExtractLogMetadata port, given a resolver for the
// per-workspace/source rules/parser-config/tz-offset it needs. Pass the
// result to NewWorker in place of DefaultMetadataExtractor to use real
// timestamp/level/facet extraction instead of the raw-text passthrough
// placeholder.
func NewMetadataAdapter(resolver MetadataConfigResolver) MetadataExtractor {
	return &metadataAdapter{resolver: resolver}
}

// Extract implements MetadataExtractor.
func (a *metadataAdapter) Extract(workspaceID, sourceID, rawText string, existingFacets map[string]string) (ExtractedMetadata, error) {
	rules := a.resolver.RulesFor(workspaceID)
	parserConfig, tzOffset := a.resolver.ParserConfigFor(workspaceID, sourceID)

	m := metadata.ExtractLogMetadata(rawText, rules, parserConfig, tzOffset)

	// Newly-extracted facets first, then existing (already-persisted)
	// facets layered on top so they win on key collisions — matching
	// Python's `meta["facets"].update(existing_facets)`
	// (clustering.py:325, :94), where existing_facets is the update
	// SOURCE and therefore takes precedence over meta["facets"].
	facets := make(map[string]string, len(existingFacets)+len(m.Facets))
	for k, v := range m.Facets {
		facets[k] = v
	}
	for k, v := range existingFacets {
		facets[k] = v
	}

	return ExtractedMetadata{
		Message:   m.Message,
		Timestamp: m.Timestamp,
		Level:     m.Level,
		Facets:    facets,
	}, nil
}
