// Package app is the composition root for the Go sidecar: it constructs
// every subsystem (DB, disk-first log storage + mmap fast-path, per-workspace
// Drain3 miners, the async clustering worker, the multi-tenant tailer fan-out
// manager) exactly once and wires them together, mirroring sidecar/src/api.py's
// App.__init__.
package app

import (
	"fmt"
	"log"
	"path/filepath"
	"sync"
	"time"

	"loglensai/backend-go/internal/ai/laya"
	"loglensai/backend-go/internal/db"
	"loglensai/backend-go/internal/drain3"
	"loglensai/backend-go/internal/ingestion"
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

	engineMu    sync.Mutex
	LayaManager *laya.RuleManager
	LayaEngine  laya.Engine
	LayaModels  *laya.ModelManager
}

// NewApp opens/creates the DuckDB database at dbPath, constructs the
// disk-first log store, fast-path mmap reader, shared tailer-fanout manager,
// and the async clustering worker, and starts the worker running — mirroring
// api.py's App.__init__.
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

	layaRulesPath := filepath.Join(dataDir, "laya_rules.json")
	layaManager, err := laya.NewRuleManager(layaRulesPath)
	if err != nil {
		_ = logStore.CloseAll()
		_ = database.Close()
		return nil, fmt.Errorf("app: initializing laya rule manager: %w", err)
	}

	layaModelDir := filepath.Join(dataDir, "models", "laya")
	layaModels := laya.NewModelManager(layaModelDir)

	var layaEngine laya.Engine = laya.NewMockEngine()
	encPath, headPath, tokPath := layaModels.GetPaths()
	onnxCfg := laya.ONNXEngineConfig{
		EncoderPath:    encPath,
		HeadPath:       headPath,
		TokenizerPath:  tokPath,
		FallbackToMock: true,
	}
	if onnxEng, err := laya.NewONNXEngine(onnxCfg); err == nil {
		layaEngine = onnxEng
	}
	if layaManager != nil {
		settings := layaManager.GetSettings()
		if settings.Device != "" {
			_ = layaEngine.SetDevice(settings.Device)
		}
	}

	_ = database.InitClusterTriageTable()

	a := &App{
		DB:          database,
		LogStore:    logStore,
		FastPath:    fastPath,
		Shared:      shared,
		startTime:   time.Now(),
		dataDir:     dataDir,
		drainDir:    filepath.Join(dataDir, "drain"),
		miners:      make(map[string]*drain3.Miner),
		tailers:     make(map[string]*ingestion.FileTailer),
		LayaManager: layaManager,
		LayaEngine:  layaEngine,
		LayaModels:  layaModels,
	}
	a.metaResolver = &metadataConfigResolver{app: a}

	extractor := clustering.NewMetadataAdapter(a.metaResolver)
	worker := clustering.NewWorker(database, fastPath, extractor, a.GetDrainParser, clusterWorkerBatchSize, 0, 0)
	worker.SetTriageHandler(NewLayaClusterTriager(a))
	a.Cluster = worker
	worker.Start()

	return a, nil
}

// ReloadLayaEngine reinitializes the Laya engine with newly available ONNX weights.
func (a *App) ReloadLayaEngine() error {
	a.engineMu.Lock()
	defer a.engineMu.Unlock()

	if a.LayaModels == nil || a.LayaManager == nil {
		return nil
	}

	encPath, headPath, tokPath := a.LayaModels.GetPaths()
	cfg := laya.ONNXEngineConfig{
		EncoderPath:    encPath,
		HeadPath:       headPath,
		TokenizerPath:  tokPath,
		FallbackToMock: true,
		Device:         a.LayaManager.GetSettings().Device,
	}

	eng, err := laya.NewONNXEngine(cfg)
	if err != nil {
		return fmt.Errorf("app: reloading laya engine: %w", err)
	}

	if a.LayaEngine != nil {
		_ = a.LayaEngine.Close()
	}
	a.LayaEngine = eng
	return nil
}

// resolveDataDir picks the directory NewApp uses for disk-first log storage
// (storage/) and per-workspace Drain3 persistence (drain/).
func resolveDataDir(resolvedDBPath, requestedDBPath string) string {
	if resolvedDBPath == db.MemoryDB || requestedDBPath == db.MemoryDB {
		return "data"
	}
	return filepath.Dir(resolvedDBPath)
}

// Close gracefully shuts down every background subsystem and persists
// per-workspace Drain3 cluster state to disk.
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

	if a.LayaEngine != nil {
		if err := a.LayaEngine.Close(); err != nil {
			log.Printf("[App] Error closing laya engine: %v", err)
		}
	}

	return a.DB.Close()
}

// DataDir exposes the per-process app data directory.
func (a *App) DataDir() string {
	return a.dataDir
}
