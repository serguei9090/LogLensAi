package clustering

import (
	"fmt"
	"log"
	"runtime"
	"sync"
	"time"

	"loglensai/backend-go/internal/db"
)

// TrainSampleSize is the number of rows per batch processed sequentially on
// the tree-mutating Train() path before the remainder is tagged in
// parallel, mirroring clustering.py's TRAIN_SAMPLE_SIZE = 200.
const TrainSampleSize = 200

// Mode is the worker's operating mode, folding clustering.py's `self.mode`
// ("auto"/"burst") together with its separate `self.paused` bool into one
// smaller Go API (Worker.SetPaused still exists separately, matching
// Python's independent set_paused control).
type Mode string

const (
	ModeAuto  Mode = "auto"
	ModeBurst Mode = "burst"
)

// Status is returned by Worker.GetStatus, mirroring
// ClusteringWorker.get_status (clustering.py:959-971).
type Status struct {
	Mode             Mode
	Running          bool
	Paused           bool
	Backlog          int
	ProcessedSession int64
}

// Worker is the Go port of clustering.py's ClusteringWorker. See the
// package doc comment for the overall pipeline shape.
//
// Simplification versus Python (explicitly called out per the migration
// task brief): Python's tag phase runs in a ProcessPoolExecutor because
// CPython processes can't share memory, so clustering.py has to serialize a
// snapshot of the cluster map to each worker process
// (parser.get_clusters()), reconstruct a temporary TemplateMiner from it in
// the child (_tag_log_batch), and run a whole cache-coherency protocol on
// top (StaleCacheError, per-workspace "cluster version" counters in
// self._cluster_versions/_last_submitted_versions, re-submitting
// stale-cache futures) just to keep tagger processes from working off
// outdated templates whenever the train phase updates the tree mid-cycle.
//
// None of that exists here. Go goroutines share the process's memory
// directly, so the tag phase is just a worker-pool of goroutines calling
// the read-only, RWMutex-protected drain3.Miner.Match against the SAME live
// tree the train phase just updated in this very cycle — always current, no
// snapshotting, no versioning, no stale-cache handling, no re-submission
// logic. This is a real behavioral simplification, not just an
// implementation detail: Go taggers can never tag against a stale template
// the way a slow-to-refresh Python child process theoretically could
// between the snapshot being taken and the batch being tagged.
type Worker struct {
	db       *db.DB
	hydrator LineHydrator
	metadata MetadataExtractor
	miners   MinerProvider
	poolSize int

	batchSize int
	interval  time.Duration

	mu               sync.Mutex
	mode             Mode
	paused           bool
	running          bool
	forceCycle       bool
	processedSession int64

	stopCh chan struct{}
	doneCh chan struct{}
}

// NewWorker constructs a Worker.
//
//   - database must be non-nil (an opened *db.DB, see internal/db.Open).
//   - hydrator may be nil if the caller guarantees logs.raw_text is always
//     already populated at ingest time; rows with a NULL raw_text and a nil
//     hydrator are marked MISSING immediately.
//   - metadata may be nil, defaulting to DefaultMetadataExtractor (see its
//     doc comment for why that's a placeholder, not a real port).
//   - batchSize<=0 defaults to 500 and interval<=0 defaults to 2s, matching
//     clustering.py's ClusteringWorker.__init__ defaults
//     (clustering.py:186).
//   - poolSize<=0 defaults to max(1, runtime.NumCPU()-1), mirroring
//     clustering.py's MAX_PARALLEL_WORKERS = max(1, (os.cpu_count() or 4) - 1)
//     (clustering.py:45).
func NewWorker(database *db.DB, hydrator LineHydrator, metadata MetadataExtractor, miners MinerProvider, batchSize int, interval time.Duration, poolSize int) *Worker {
	if batchSize <= 0 {
		batchSize = 500
	}
	if interval <= 0 {
		interval = 2 * time.Second
	}
	if poolSize <= 0 {
		poolSize = runtime.NumCPU() - 1
		if poolSize < 1 {
			poolSize = 1
		}
	}
	if metadata == nil {
		metadata = DefaultMetadataExtractor{}
	}

	return &Worker{
		db:        database,
		hydrator:  hydrator,
		metadata:  metadata,
		miners:    miners,
		poolSize:  poolSize,
		batchSize: batchSize,
		interval:  interval,
		mode:      ModeAuto,
	}
}

// Start launches the background processing loop as a goroutine. Idempotent:
// calling Start on an already-running Worker is a no-op. Mirrors
// ClusteringWorker.start (clustering.py:205-213) — Go's goroutine is the
// direct analogue of Python's daemon thread; there is no separate
// process-pool executor to stand up (see the Worker doc comment).
func (w *Worker) Start() {
	w.mu.Lock()
	if w.running {
		w.mu.Unlock()
		return
	}
	w.running = true
	w.stopCh = make(chan struct{})
	w.doneCh = make(chan struct{})
	w.mu.Unlock()

	go w.run()
}

// Stop signals the background loop to exit and blocks until it has,
// mirroring ClusteringWorker.stop (clustering.py:215-223), minus the
// executor teardown Python needs and Go doesn't (no process pool here).
func (w *Worker) Stop() {
	w.mu.Lock()
	if !w.running {
		w.mu.Unlock()
		return
	}
	w.running = false
	stopCh := w.stopCh
	doneCh := w.doneCh
	w.mu.Unlock()

	close(stopCh)
	<-doneCh
}

// run is the main loop, mirroring ClusteringWorker._run (clustering.py:229-260).
func (w *Worker) run() {
	defer close(w.doneCh)

	for {
		select {
		case <-w.stopCh:
			return
		default:
		}

		w.mu.Lock()
		paused := w.paused
		force := w.forceCycle
		mode := w.mode
		w.mu.Unlock()

		// Mirrors `if self.paused and not self._force_cycle.is_set():
		// self._force_cycle.wait(timeout=1.0); if not set: continue`
		// (clustering.py:232-235). Go has no direct analogue of
		// threading.Event.wait's immediate wake-on-set, so this polls
		// paused/forceCycle once a second instead — up to ~1s of extra
		// latency between a trigger/unpause and the next cycle starting
		// while paused, which is an acceptable, documented simplification
		// (a sync.Cond broadcast could remove it later without changing
		// behavior).
		if paused && !force {
			select {
			case <-w.stopCh:
				return
			case <-time.After(time.Second):
			}
			continue
		}

		batchSize, interval := w.batchSize, w.interval
		if mode == ModeBurst {
			batchSize *= 4
			interval = 100 * time.Millisecond
		}

		processed, err := w.processBatch(batchSize)
		if err != nil {
			log.Printf("[ClusteringWorker] cycle error: %v", err)
			select {
			case <-w.stopCh:
				return
			case <-time.After(w.interval * 2):
			}
			continue
		}

		w.mu.Lock()
		w.processedSession += int64(processed)
		w.mu.Unlock()

		var wait time.Duration
		switch {
		case processed == 0:
			w.mu.Lock()
			w.forceCycle = false
			w.mu.Unlock()
			wait = interval
		case mode == ModeBurst:
			wait = interval
		default:
			wait = 100 * time.Millisecond
		}

		select {
		case <-w.stopCh:
			return
		case <-time.After(wait):
		}
	}
}

// GetStatus reports the worker's current mode/running/paused state plus
// the live unprocessed-log backlog. Mirrors
// ClusteringWorker.get_status (clustering.py:959-971).
func (w *Worker) GetStatus() (Status, error) {
	backlog, err := w.db.CountUnprocessedLogs()
	if err != nil {
		return Status{}, fmt.Errorf("clustering: counting backlog: %w", err)
	}

	w.mu.Lock()
	defer w.mu.Unlock()
	return Status{
		Mode:             w.mode,
		Running:          w.running,
		Paused:           w.paused,
		Backlog:          backlog,
		ProcessedSession: w.processedSession,
	}, nil
}

// SetMode changes the operating mode. "manual" is accepted as a deprecated
// alias mapped to auto+paused, mirroring ClusteringWorker.set_mode
// (clustering.py:973-987, including its "'manual' is deprecated and now
// mapped to auto + paused" comment).
func (w *Worker) SetMode(mode Mode) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	switch mode {
	case "manual":
		w.mode = ModeAuto
		w.paused = true
	case ModeAuto, ModeBurst:
		w.mode = mode
		w.paused = false
		w.forceCycle = true
	default:
		return fmt.Errorf("clustering: invalid mode %q", mode)
	}
	return nil
}

// SetPaused explicitly pauses or resumes the worker, mirroring
// ClusteringWorker.set_paused (clustering.py:989-994).
func (w *Worker) SetPaused(paused bool) {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.paused = paused
	if !paused {
		w.forceCycle = true
	}
}

// TriggerCycle requests one processing cycle run as soon as possible, even
// if the worker is currently paused. Mirrors
// ClusteringWorker.trigger_cycle (clustering.py:996-998).
func (w *Worker) TriggerCycle() {
	w.mu.Lock()
	w.forceCycle = true
	w.mu.Unlock()
}
