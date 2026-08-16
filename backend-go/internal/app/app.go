// Package app is the composition root for the Go sidecar: it constructs
// every subsystem (DB, disk-first log storage + mmap fast-path, per-workspace
// Drain3 miners, the async clustering worker, the multi-tenant tailer fan-out
// manager) exactly once and wires them together, mirroring sidecar/src/api.py's
// App.__init__.
//
// Scope note (see docs/migration/STATUS.md, Phase 2 "wiring" step): this
// package wires a CORE SUBSET of the ~67 JSON-RPC methods — enough to prove
// an end-to-end pipeline (ingest -> tail/parse/store -> cluster -> query).
// The remaining methods (settings CRUD, folders/sources CRUD, AI, dashboard,
// anomalies, templates, fusion config, export) stay registered as stubs in
// internal/rpc until later phases wire them against this same *App.
package app

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"loglensai/backend-go/internal/db"
	"loglensai/backend-go/internal/drain3"
	"loglensai/backend-go/internal/ingestion"
	"loglensai/backend-go/internal/metadata"
	"loglensai/backend-go/internal/services/clustering"
	"loglensai/backend-go/internal/services/logstore"
)

// errInternal mirrors rpc.CodeInternalError (-32603). Duplicated as a local
// constant rather than imported: internal/rpc imports internal/app (to wire
// real handlers against stub registrations), so the reverse import would be
// a cycle. Keeping the numeric JSON-RPC error codes as small duplicated
// constants in each direction is simpler than introducing a third shared
// package just for four integers.
const (
	errInternal      = -32603
	errInvalidParams = -32602
)

// clusterWorkerBatchSize is the number of unprocessed `logs` rows the
// clustering.Worker pulls per cycle (see NewApp).
//
// # Known parity gap this only partially narrows (see golden-file report)
//
// internal/services/clustering.Worker always Trains (tree-mutating, can
// create new clusters) on only the first clustering.TrainSampleSize (a
// package-level constant, 200) rows of *each cycle's* batch and Matches
// (read-only, tag-only) the rest -- mirroring clustering.py's identical
// train-first-200-then-tag split, but clustering.py applies that split once
// per adaptively-sized ingest CHUNK (api.py's _read_file_chunks: 5000 rows
// initially, doubling toward a 10000 cap), while the Go worker applies it
// once per fixed-size CYCLE it pulls from the backlog. A larger batchSize
// here means fewer, larger cycles -- fewer independent 200-row "training
// windows" over a given ingest, which is the actual lever that controls how
// many chances Drain3 gets to mint a brand new cluster instead of matching
// an existing one.
//
// 5000 (Python's initial/most-common chunk size) was chosen empirically: a
// real 3-way run of this constant (500 default, 2000, 5000) against
// apache_logs.log showed the cluster-count delta against Python shrinking
// monotonically as batchSize grew, without fully closing (Python's chunking
// also grows adaptively up to 10000 and only ever uses ONE training window
// per ingest_local_file call regardless of file size, whereas Go still
// starts a fresh training window every clusterWorkerBatchSize rows no
// matter how large the file is) -- see docs/migration/STATUS.md's golden
// file results for the actual measured numbers. Closing the gap completely
// would mean either matching Python's adaptive chunk growth here or
// changing clustering.TrainSampleSize's semantics to be ingest-call-scoped
// rather than cycle-scoped -- both out of scope for this wiring pass (the
// former belongs in this composition root; the latter would mean modifying
// internal/services/clustering itself, which this task was scoped not to
// touch).
const clusterWorkerBatchSize = 5000

// App is the Go analogue of sidecar/src/api.py's App class: the single
// composition root holding every long-lived subsystem instance, and the
// receiver for RPC handler methods (see handlers_*.go in this package).
type App struct {
	DB       *db.DB
	LogStore *logstore.DiskLogStore
	FastPath *logstore.FastPathService
	Shared   *ingestion.SharedSourceManager
	Cluster  *clustering.Worker

	startTime time.Time
	dataDir   string
	drainDir  string

	metaResolver *metadataConfigResolver

	minersMu sync.Mutex
	miners   map[string]*drain3.Miner

	tailersMu sync.Mutex
	tailers   map[string]*ingestion.FileTailer
}

// NewApp opens/creates the DuckDB database at dbPath, constructs the
// disk-first log store, fast-path mmap reader, shared tailer-fanout manager,
// and the async clustering worker, and starts the worker running — mirroring
// api.py's App.__init__ (db.py -> DiskLogStore -> FastPathService ->
// SharedSourceManager -> get_drain_parser() -> ClusteringWorker.start()),
// minus the AI/anomaly/MCP/ingestion-server/ingestion-queue subsystems that
// are out of scope for this phase (see the package doc comment).
func NewApp(dbPath string) (*App, error) {
	database, err := db.Open(dbPath)
	if err != nil {
		return nil, fmt.Errorf("app: opening database: %w", err)
	}

	dataDir := resolveDataDir(database.Path, dbPath)
	storageDir := filepath.Join(dataDir, "storage")

	logStore, err := logstore.NewDiskLogStore(storageDir)
	if err != nil {
		_ = database.Close()
		return nil, fmt.Errorf("app: creating log store: %w", err)
	}
	fastPath := logstore.NewFastPathService(storageDir)
	shared := ingestion.NewSharedSourceManager(logStore)

	a := &App{
		DB:        database,
		LogStore:  logStore,
		FastPath:  fastPath,
		Shared:    shared,
		startTime: time.Now(),
		dataDir:   dataDir,
		drainDir:  filepath.Join(dataDir, "drain"),
		miners:    make(map[string]*drain3.Miner),
		tailers:   make(map[string]*ingestion.FileTailer),
	}
	a.metaResolver = &metadataConfigResolver{app: a}

	// Clustering worker: shares this same process's memory with the tag-phase
	// goroutines (see internal/services/clustering.Worker's doc comment for
	// why that eliminates the ProcessPoolExecutor cache-coherency machinery
	// clustering.py needs).
	//
	// batchSize is deliberately raised to clusterWorkerBatchSize (well above
	// the package's own 500-row default) rather than left at 0 -- see that
	// constant's doc comment for why: it measurably narrows (though, per a
	// real golden-file run, does not eliminate) a cluster-count divergence
	// against Python caused by how often each side's fixed 200-row Drain3
	// "training window" (clustering.TrainSampleSize) recurs across a large
	// ingest.
	extractor := clustering.NewMetadataAdapter(a.metaResolver)
	worker := clustering.NewWorker(database, fastPath, extractor, a.GetDrainParser, clusterWorkerBatchSize, 0, 0)
	a.Cluster = worker
	worker.Start()

	return a, nil
}

// resolveDataDir picks the directory NewApp uses for disk-first log storage
// (storage/) and per-workspace Drain3 persistence (drain/), mirroring
// api.py's PROJECT_ROOT/data convention: siblings of the resolved DB file,
// or "./data" for an in-memory database (no file to sit next to).
func resolveDataDir(resolvedDBPath, requestedDBPath string) string {
	if resolvedDBPath == db.MemoryDB || requestedDBPath == db.MemoryDB {
		return "data"
	}
	return filepath.Dir(resolvedDBPath)
}

// Close gracefully shuts down every background subsystem and persists
// per-workspace Drain3 cluster state to disk, mirroring api.py's App.stop():
// tailers, then the clustering worker, then Drain3 snapshot saves, then the
// shared-source manager, fast-path mappings, disk log store, and finally the
// database connection pool.
func (a *App) Close() error {
	a.tailersMu.Lock()
	tailers := make([]*ingestion.FileTailer, 0, len(a.tailers))
	for _, t := range a.tailers {
		tailers = append(tailers, t)
	}
	a.tailers = make(map[string]*ingestion.FileTailer)
	a.tailersMu.Unlock()
	for _, t := range tailers {
		t.Stop()
	}

	if a.Cluster != nil {
		a.Cluster.Stop()
	}

	a.minersMu.Lock()
	for key, m := range a.miners {
		if err := m.SaveToFile(a.drainStatePath(key)); err != nil {
			log.Printf("[App] Failed to save drain state for %s: %v", key, err)
		}
	}
	a.minersMu.Unlock()

	a.Shared.Cleanup()
	a.FastPath.CloseAll()
	if err := a.LogStore.CloseAll(); err != nil {
		log.Printf("[App] Error closing log store: %v", err)
	}

	return a.DB.Close()
}

// --- Drain3 miner resolution (mirrors api.py's App.get_drain_parser) ---

// drainGlobalKey is the miner-cache key used when drain_template_scope is
// "global" (the default) or no workspace_id is supplied, matching api.py's
// "__global__" sentinel.
const drainGlobalKey = "__global__"

// GetDrainParser resolves (creating and lazily loading from disk if needed)
// the shared drain3.Miner for workspaceID, honoring the `drain_template_scope`
// setting ("global", the default, shares one miner across every workspace;
// anything else gives each workspace its own). Matches the
// clustering.MinerProvider signature so it can be passed directly to
// clustering.NewWorker. Mirrors api.py's App.get_drain_parser.
func (a *App) GetDrainParser(workspaceID string) (*drain3.Miner, error) {
	settings := a.getSettings(workspaceID)
	scope := settings["drain_template_scope"]
	if scope == "" {
		scope = "global"
	}

	key := drainGlobalKey
	if scope != "global" && workspaceID != "" {
		key = workspaceID
	}

	a.minersMu.Lock()
	defer a.minersMu.Unlock()

	if m, ok := a.miners[key]; ok {
		return m, nil
	}

	cfg := drain3.DefaultConfig()
	if v, err := strconv.ParseFloat(settings["drain_similarity_threshold"], 64); err == nil && v > 0 {
		cfg.SimTh = v
	}
	if v, err := strconv.Atoi(settings["drain_max_children"]); err == nil && v > 0 {
		cfg.MaxChildren = v
	}
	if v, err := strconv.Atoi(settings["drain_max_clusters"]); err == nil {
		cfg.MaxClusters = v
	}
	cfg.MaskingInstructions = parseMaskingInstructions(settings["drain_masks"])

	m, err := drain3.NewMiner(cfg)
	if err != nil {
		return nil, fmt.Errorf("app: constructing drain miner for %q: %w", key, err)
	}

	if err := m.LoadFromFile(a.drainStatePath(key)); err != nil {
		log.Printf("[App] Failed to load drain state for %s: %v", key, err)
	}

	a.miners[key] = m
	return m, nil
}

func (a *App) drainStatePath(key string) string {
	if key == drainGlobalKey {
		return filepath.Join(a.drainDir, "global.state")
	}
	return filepath.Join(a.drainDir, "workspace_"+key+".state")
}

// maskRuleJSON mirrors the `drain_masks` setting's on-disk JSON shape
// ({"pattern","label","enabled"} objects), matching db.maskRule
// (internal/db/migrations.go, unexported there).
type maskRuleJSON struct {
	Pattern string `json:"pattern"`
	Label   string `json:"label"`
	Enabled bool   `json:"enabled"`
}

// parseMaskingInstructions decodes the drain_masks setting value (tolerating
// double-encoded JSON, matching api.py's get_drain_parser) into compiled
// drain3.MaskingInstructions.
func parseMaskingInstructions(raw string) []drain3.MaskingInstruction {
	if raw == "" {
		return nil
	}
	var parsed []maskRuleJSON
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		// Tolerate a double-encoded JSON string, matching api.py's fallback.
		var inner string
		if json.Unmarshal([]byte(raw), &inner) == nil {
			_ = json.Unmarshal([]byte(inner), &parsed)
		}
	}
	if len(parsed) == 0 {
		return nil
	}
	rules := make([]drain3.MaskRule, len(parsed))
	for i, p := range parsed {
		rules[i] = drain3.MaskRule{Pattern: p.Pattern, Label: p.Label, Enabled: p.Enabled}
	}
	return drain3.BuildMaskingInstructions(rules)
}

// DataDir exposes the per-process app data directory (siblings of the
// DuckDB file: storage/, drain/, and — per the AI wiring pass — rag_model/
// for the ONNX embedder's downloaded-model cache) to callers outside this
// package that need a stable place to cache their own on-disk state, such as
// internal/ai's embedder construction. Mirrors api.py's App.data_dir, which
// rag_service.py's constructor also takes directly.
func (a *App) DataDir() string {
	return a.dataDir
}

// Settings is the exported form of getSettings, for callers outside this
// package (e.g. internal/ai's provider-from-settings construction) that need
// the same merged global + workspace-override settings view RPC handlers use
// internally. workspaceID may be "" for the global-only view.
func (a *App) Settings(workspaceID string) map[string]string {
	return a.getSettings(workspaceID)
}

// getSettings returns the merged global + (if workspaceID != "") workspace
// override settings map, mirroring api.py's method_get_settings. Query
// failures degrade to an empty/partial map rather than erroring — settings
// always have code-level fallbacks throughout this package, matching
// Python's dict.get(key, default) usage pattern at every call site.
func (a *App) getSettings(workspaceID string) map[string]string {
	out := make(map[string]string)

	if rows, err := a.DB.Conn.Query(`SELECT key, value FROM settings`); err == nil {
		for rows.Next() {
			var k, v string
			if rows.Scan(&k, &v) == nil {
				out[k] = v
			}
		}
		rows.Close()
	}

	if workspaceID != "" {
		if rows, err := a.DB.Conn.Query(
			`SELECT key, value FROM workspace_settings WHERE workspace_id = ?`, workspaceID,
		); err == nil {
			for rows.Next() {
				var k, v string
				if rows.Scan(&k, &v) == nil {
					out[k] = v
				}
			}
			rows.Close()
		}
	}

	return out
}

// --- Facet rules / parser config resolution, shared by clustering and
// ingest handlers (mirrors api.py's _get_facet_rules_for_workspace /
// _get_parser_config). ---

// metadataConfigResolver implements clustering.MetadataConfigResolver
// against the real database, resolving per-(workspace, source) facet rules
// and parser config the way api.py's _ingest_source_logs_batch /
// _bg_ingest_local_file do.
type metadataConfigResolver struct {
	app *App
}

// RulesFor implements clustering.MetadataConfigResolver.
func (r *metadataConfigResolver) RulesFor(workspaceID string) []metadata.Rule {
	global, ws, err := r.app.DB.FacetExtractionRulesJSON(workspaceID)
	if err != nil {
		log.Printf("[App] Failed to load facet rules for %s: %v", workspaceID, err)
		return nil
	}
	var rules []metadata.Rule
	rules = append(rules, parseFacetRulesJSON(global)...)
	rules = append(rules, parseFacetRulesJSON(ws)...)
	return rules
}

// ParserConfigFor implements clustering.MetadataConfigResolver.
func (r *metadataConfigResolver) ParserConfigFor(workspaceID, sourceID string) (*metadata.ParserConfig, float64) {
	raw, tz, err := r.app.DB.FusionParserConfig(workspaceID, sourceID)
	if err != nil {
		log.Printf("[App] Failed to load parser config for %s/%s: %v", workspaceID, sourceID, err)
		return &metadata.ParserConfig{}, 0
	}
	if raw == "" {
		return &metadata.ParserConfig{}, tz
	}
	var parsed parserConfigJSON
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return &metadata.ParserConfig{}, tz
	}
	return parsed.toParserConfig(), tz
}

// parserConfigJSON mirrors the parser_config dict keys metadata_extractor.py
// reads (timestamp_regex, timestamp_format, regex, timestamp_auto_detect).
// Duplicated from internal/ingestion's unexported equivalent (tailer.go)
// rather than exported from there, to keep that package's public surface
// unchanged.
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

// facetRuleJSON mirrors one entry of the facet_extractions setting.
type facetRuleJSON struct {
	Name    string `json:"name"`
	Regex   string `json:"regex"`
	Group   int    `json:"group"`
	Enabled *bool  `json:"enabled"`
}

func parseFacetRulesJSON(raw string) []metadata.Rule {
	if raw == "" {
		return nil
	}
	var parsed []facetRuleJSON
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return nil
	}
	out := make([]metadata.Rule, len(parsed))
	for i, p := range parsed {
		out[i] = metadata.Rule{Name: p.Name, Regex: p.Regex, Group: p.Group, Enabled: p.Enabled}
	}
	return out
}

// getFacetRules/getParserConfig are thin App-level wrappers around
// metaResolver, used directly by the ingest handlers (handlers_ingest.go)
// which need the same per-(workspace,source) config the clustering worker
// resolves via the MetadataConfigResolver interface.
func (a *App) getFacetRules(workspaceID string) []metadata.Rule {
	return a.metaResolver.RulesFor(workspaceID)
}

func (a *App) getParserConfig(workspaceID, sourceID string) (*metadata.ParserConfig, float64) {
	return a.metaResolver.ParserConfigFor(workspaceID, sourceID)
}

// deleteLogs removes logs rows for a workspace (optionally scoped to one
// source), mirroring db.py's LogDatabase.delete_logs minus its cluster-cache
// rebuild step (out of scope for the core subset this phase wires — see the
// package doc comment; a full delete_logs/delete_workspace RPC port,
// including cluster-cache reconciliation, is left to the phase that wires
// those methods for real).
func (a *App) deleteLogs(workspaceID, sourceID string) error {
	var err error
	if sourceID != "" {
		_, err = a.DB.Conn.Exec(`DELETE FROM logs WHERE workspace_id = ? AND source_id = ?`, workspaceID, sourceID)
	} else {
		_, err = a.DB.Conn.Exec(`DELETE FROM logs WHERE workspace_id = ?`, workspaceID)
	}
	return err
}

// sourceIsUploaded checks log_sources.is_uploaded for sourceID, mirroring
// api.py's method_ingest_local_file "already uploaded, skip" guard. Returns
// false (proceed with ingestion) if no such source row exists yet, matching
// Python's `if row and row[0]`.
func (a *App) sourceIsUploaded(sourceID string) bool {
	var uploaded sql.NullBool
	row := a.DB.Conn.QueryRow(`SELECT is_uploaded FROM log_sources WHERE id = ?`, sourceID)
	if err := row.Scan(&uploaded); err != nil {
		return false
	}
	return uploaded.Valid && uploaded.Bool
}

// normalizeAbsPath mirrors the repeated
// `os.path.abspath(filepath).replace("\\", "/")` normalization used
// throughout api.py's tailer methods, so tailer registry keys are stable
// across OSes.
func normalizeAbsPath(p string) string {
	abs, err := filepath.Abs(p)
	if err != nil {
		abs = p
	}
	return strings.ReplaceAll(abs, `\`, "/")
}
