package ingestion

import (
	"encoding/json"
	"log"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"loglensai/backend-go/internal/db"
	"loglensai/backend-go/internal/metadata"
)

// tailerBatchSize/tailerFlushInterval mirror tailer.py's `_flush_loop`:
// flush whenever the batch reaches 500 rows, or 100ms have passed since the
// last flush, whichever comes first.
const (
	tailerBatchSize     = 500
	tailerFlushInterval = 100 * time.Millisecond
)

// parserConfigCacheTTL/rulesCacheTTL mirror FileTailer's per-instance caches
// (tailer.py:158-221): parser config for 30s, facet rules for 10s.
const (
	parserConfigCacheTTL = 30 * time.Second
	rulesCacheTTL        = 10 * time.Second
)

// pendingLogRow is one metadata-extracted line waiting to be flushed to the
// `logs` table, matching the tuple tailer.py's `_process_line` puts on its
// queue.
type pendingLogRow struct {
	lineID          int64
	raw             string
	timestamp       string
	ingestTimestamp string
	level           string
	facetsJSON      *string
}

// FileTailer is a workspace-specific subscriber to a SharedSource: it
// receives every new line the shared source observes, extracts metadata,
// and micro-batches inserts into `logs` (always with cluster_id=NULL,
// processed=FALSE, left for the clustering worker). Ports tailer.py's
// FileTailer.
type FileTailer struct {
	Filepath    string // absolute, forward-slash-normalized
	WorkspaceID string
	SourceID    string

	db      *db.DB
	manager *SharedSourceManager
	queue   *microBatchQueue[pendingLogRow]

	mu     sync.Mutex
	shared *SharedSource
	subID  int
	stopCh chan struct{}
	doneCh chan struct{}

	cfgMu     sync.Mutex
	cfg       *metadata.ParserConfig
	cfgTZ     float64
	cfgExpiry time.Time

	rulesMu     sync.Mutex
	rules       []metadata.Rule
	rulesExpiry time.Time
}

// NewFileTailer builds a tailer for filepath under workspaceID. sourceID
// selects the physical SharedSource to subscribe to; if empty, filepath
// itself is used (legacy fallback, matching
// `self.source_id = source_id or self.filepath`).
func NewFileTailer(sourcePath, workspaceID string, database *db.DB, manager *SharedSourceManager, sourceID string) *FileTailer {
	abs := normalizeFilepath(sourcePath)
	if sourceID == "" {
		sourceID = abs
	}
	return &FileTailer{
		Filepath:    abs,
		WorkspaceID: workspaceID,
		SourceID:    sourceID,
		db:          database,
		manager:     manager,
		queue:       newMicroBatchQueue[pendingLogRow](tailerBatchSize),
	}
}

// normalizeFilepath mirrors tailer.py's
// `os.path.abspath(filepath).replace("\\", "/")` — normalize to forward
// slashes so source_id is consistent across OSes.
func normalizeFilepath(path string) string {
	abs, err := filepath.Abs(path)
	if err != nil {
		abs = path
	}
	return strings.ReplaceAll(abs, `\`, "/")
}

// Running reports whether the tailer is currently subscribed to its shared
// source. Ports FileTailer.running.
func (t *FileTailer) Running() bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.shared != nil
}

// Start subscribes to the shared source and begins the flush loop. Ports
// FileTailer.start.
func (t *FileTailer) Start() {
	t.mu.Lock()
	if t.shared != nil {
		t.mu.Unlock()
		return
	}
	t.stopCh = make(chan struct{})
	t.doneCh = make(chan struct{})
	t.mu.Unlock()

	go t.flushLoop(t.stopCh, t.doneCh)

	shared := t.manager.GetSource(t.SourceID, t.Filepath)
	subID := shared.Subscribe(t.processLine)

	t.mu.Lock()
	t.shared = shared
	t.subID = subID
	t.mu.Unlock()
}

// Stop unsubscribes from the shared source, stops the flush loop, and
// flushes any remaining queued rows. Ports FileTailer.stop.
func (t *FileTailer) Stop() {
	t.mu.Lock()
	shared := t.shared
	subID := t.subID
	stopCh := t.stopCh
	doneCh := t.doneCh
	t.shared = nil
	t.mu.Unlock()

	if shared != nil {
		shared.Unsubscribe(subID)
	}
	if stopCh != nil {
		close(stopCh)
	}
	if doneCh != nil {
		select {
		case <-doneCh:
		case <-time.After(1 * time.Second):
		}
	}

	// Flush anything left in the queue after the loop has stopped, matching
	// FileTailer.stop's `self._flush_remaining()`.
	t.flushBatch(t.queue.drain())
}

// processLine is the SharedSource subscriber callback: extract metadata and
// enqueue for batched insertion. Ports FileTailer._process_line_callback /
// _process_line.
func (t *FileTailer) processLine(line string, lineID int64) {
	if line == "" {
		return
	}

	rules := t.getRules()
	cfg, tz := t.getParserConfig()

	md := metadata.ExtractLogMetadata(line, rules, cfg, tz)

	var facetsJSON *string
	if len(md.Facets) > 0 {
		if b, err := json.Marshal(md.Facets); err == nil {
			s := string(b)
			facetsJSON = &s
		}
	}

	t.queue.push(pendingLogRow{
		lineID:          lineID,
		raw:             line,
		timestamp:       md.Timestamp,
		ingestTimestamp: md.IngestTimestamp,
		level:           md.Level,
		facetsJSON:      facetsJSON,
	})
}

// flushLoop wakes on either the queue reaching tailerBatchSize or every
// tailerFlushInterval, flushing whatever has accumulated. Ports
// FileTailer._flush_loop.
func (t *FileTailer) flushLoop(stopCh, doneCh chan struct{}) {
	defer close(doneCh)

	ticker := time.NewTicker(tailerFlushInterval)
	defer ticker.Stop()

	for {
		select {
		case <-stopCh:
			return
		case <-t.queue.wake:
			t.flushBatch(t.queue.drain())
		case <-ticker.C:
			t.flushBatch(t.queue.drain())
		}
	}
}

// flushBatch inserts batch into `logs`, logging (not panicking) on failure —
// matching _flush_batch's try/except that logs and rolls back rather than
// propagating. A nil/empty batch is a no-op.
func (t *FileTailer) flushBatch(batch []pendingLogRow) {
	if len(batch) == 0 {
		return
	}

	rows := make([]db.LogInsertRow, len(batch))
	for i, r := range batch {
		rows[i] = db.LogInsertRow{
			WorkspaceID:     t.WorkspaceID,
			SourceID:        t.SourceID,
			LineID:          r.lineID,
			RawText:         r.raw,
			Timestamp:       r.timestamp,
			IngestTimestamp: r.ingestTimestamp,
			Level:           r.level,
			FacetsJSON:      r.facetsJSON,
		}
	}

	if err := t.db.InsertLogBatch(rows); err != nil {
		log.Printf("[FileTailer] Failed to insert log batch for %s/%s: %v", t.WorkspaceID, t.SourceID, err)
	}
}

// getParserConfig returns the cached (30s TTL) parser config + tz offset for
// this (workspace, source), refetching from `fusion_configs` on expiry.
// Ports FileTailer._get_parser_config.
func (t *FileTailer) getParserConfig() (*metadata.ParserConfig, float64) {
	t.cfgMu.Lock()
	defer t.cfgMu.Unlock()

	now := time.Now()
	if t.cfg != nil && now.Before(t.cfgExpiry) {
		return t.cfg, t.cfgTZ
	}

	cfg := &metadata.ParserConfig{}
	var tz float64
	if raw, tzOffset, err := t.db.FusionParserConfig(t.WorkspaceID, t.SourceID); err == nil {
		tz = tzOffset
		if raw != "" {
			var parsed parserConfigJSON
			if jsonErr := json.Unmarshal([]byte(raw), &parsed); jsonErr == nil {
				cfg = parsed.toParserConfig()
			}
		}
	} else {
		log.Printf("[FileTailer] Failed to load parser config for %s/%s: %v", t.WorkspaceID, t.SourceID, err)
	}

	t.cfg = cfg
	t.cfgTZ = tz
	t.cfgExpiry = now.Add(parserConfigCacheTTL)
	return t.cfg, t.cfgTZ
}

// getRules returns the cached (10s TTL) combined global + workspace facet
// extraction rules, refetching on expiry. Ports FileTailer._get_rules.
func (t *FileTailer) getRules() []metadata.Rule {
	t.rulesMu.Lock()
	defer t.rulesMu.Unlock()

	now := time.Now()
	if t.rules != nil && now.Before(t.rulesExpiry) {
		return t.rules
	}

	var rules []metadata.Rule
	globalJSON, wsJSON, err := t.db.FacetExtractionRulesJSON(t.WorkspaceID)
	if err != nil {
		log.Printf("[FileTailer] Failed to load facet rules for %s: %v", t.WorkspaceID, err)
	} else {
		rules = append(rules, parseFacetRules(globalJSON)...)
		rules = append(rules, parseFacetRules(wsJSON)...)
	}

	if rules == nil {
		rules = []metadata.Rule{}
	}
	t.rules = rules
	t.rulesExpiry = now.Add(rulesCacheTTL)
	return t.rules
}

// --- JSON shapes for parser_config / facet_extractions columns ---

// parserConfigJSON mirrors the parser_config dict keys metadata_extractor.py
// reads (timestamp_regex, timestamp_format, regex, timestamp_auto_detect).
type parserConfigJSON struct {
	TimestampRegex      string `json:"timestamp_regex"`
	TimestampFormat     string `json:"timestamp_format"`
	Regex               string `json:"regex"`
	TimestampAutoDetect *bool  `json:"timestamp_auto_detect"`
}

func (p parserConfigJSON) toParserConfig() *metadata.ParserConfig {
	return &metadata.ParserConfig{
		TimestampRegex:      p.TimestampRegex,
		TimestampFormat:     p.TimestampFormat,
		Regex:               p.Regex,
		TimestampAutoDetect: p.TimestampAutoDetect,
	}
}

// facetRuleJSON mirrors one entry of the facet_extractions setting (a list
// of {name, regex, group, enabled} dicts, metadata_extractor.py:245-254).
type facetRuleJSON struct {
	Name    string `json:"name"`
	Regex   string `json:"regex"`
	Group   int    `json:"group"`
	Enabled *bool  `json:"enabled"`
}

// parseFacetRules unmarshals raw (a JSON array, or "" for none) into
// metadata.Rule values, matching FileTailer._get_rules's tolerant
// `rules if isinstance(rules, list) else []` — malformed JSON is logged and
// skipped rather than propagated, since a broken setting must not stop
// ingestion.
func parseFacetRules(raw string) []metadata.Rule {
	if raw == "" {
		return nil
	}
	var parsed []facetRuleJSON
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		log.Printf("[FileTailer] Failed to parse facet_extractions JSON: %v", err)
		return nil
	}
	out := make([]metadata.Rule, len(parsed))
	for i, p := range parsed {
		out[i] = metadata.Rule{
			Name:    p.Name,
			Regex:   p.Regex,
			Group:   p.Group,
			Enabled: p.Enabled,
		}
	}
	return out
}
