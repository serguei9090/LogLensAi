// Command goldentest is the Phase 2 golden-file parity harness described in
// docs/migration/STATUS.md: it drives the real Python sidecar
// (sidecar/main.py, via `uv run`) and the compiled Go sidecar
// (cmd/sidecar) side by side over stdio JSON-RPC, feeds both the same log
// file through ingest_local_file, waits for clustering to settle on each,
// then diffs get_logs / get_clusters output and reports concrete parity
// numbers (not a pass/fail bit) — same log count, same per-line
// level/timestamp extraction, cluster count, and template overlap.
//
// # How to run
//
//	cd backend-go
//	"C:\Program Files\Go\bin\go.exe" build -o goldentest_sidecar.exe ./cmd/sidecar
//	"C:\Program Files\Go\bin\go.exe" run ./cmd/goldentest -go-binary goldentest_sidecar.exe -lines 500
//
// Flags (see below for defaults): -repo points at the repository root
// (defaults to ".." from backend-go); -lines truncates
// <repo>/apache_logs.log to that many lines for speed (0 = whole file);
// -timeout bounds how long to wait for each side's clustering backlog to
// drain.
//
// # Isolation caveat this harness works around
//
// Unlike the Go port (whose Drain3 persistence and disk-first log storage
// both live next to the --db file it's given), the Python sidecar's
// equivalents are NOT scoped by --db at all: DrainParser persistence
// (data/drain/global.state, api.py's get_drain_parser) and DiskLogStore
// (data/storage/) both resolve against a fixed PROJECT_ROOT/data path
// regardless of which database file is open. Left alone, that means a
// freshly-invoked Python sidecar in this repo starts every run with
// whatever Drain3 cluster state previous manual dev/testing already
// accumulated there (observed: 116 clusters / 67069 messages on the copy
// this harness was developed against) -- which would silently invalidate
// any cluster-count comparison against the Go side's always-fresh
// (tmp-dir-scoped) state. This harness backs up <repo>/data/drain before
// starting the Python process and restores it afterward (see
// isolatePythonDrainState), and always ingests under a fresh,
// timestamp-unique source_id so it never touches pre-existing
// <repo>/data/storage files for another source.
package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

func main() {
	var (
		repoRoot   = flag.String("repo", "..", "Path to the LogLensAi repository root")
		lines      = flag.Int("lines", 500, "Truncate apache_logs.log to this many lines (0 = whole file)")
		logFile    = flag.String("logfile", "", "Log file to ingest (default: <repo>/apache_logs.log)")
		goBinary   = flag.String("go-binary", "", "Path to a prebuilt Go sidecar binary (default: builds one via `go build`, requires go on PATH)")
		timeout    = flag.Duration("timeout", 90*time.Second, "Max time to wait for each side's clustering backlog to reach 0")
		rpcTimeout = flag.Duration("rpc-timeout", 30*time.Second, "Max time to wait for a single RPC response")
	)
	flag.Parse()

	if err := run(*repoRoot, *lines, *logFile, *goBinary, *timeout, *rpcTimeout); err != nil {
		fmt.Fprintf(os.Stderr, "goldentest: FAILED: %v\n", err)
		os.Exit(1)
	}
}

func run(repoRootArg string, lines int, logFileArg, goBinaryArg string, waitTimeout, rpcTimeout time.Duration) error {
	repoRoot, err := filepath.Abs(repoRootArg)
	if err != nil {
		return fmt.Errorf("resolving repo root: %w", err)
	}
	backendGoDir := filepath.Join(repoRoot, "backend-go")

	logFile := logFileArg
	if logFile == "" {
		logFile = filepath.Join(repoRoot, "apache_logs.log")
	}
	logFile, err = filepath.Abs(logFile)
	if err != nil {
		return fmt.Errorf("resolving log file: %w", err)
	}

	workDir, err := os.MkdirTemp("", "loglensai-goldentest-*")
	if err != nil {
		return fmt.Errorf("creating temp work dir: %w", err)
	}
	defer os.RemoveAll(workDir)
	fmt.Printf("goldentest: work dir: %s\n", workDir)

	testLogPath, totalInputLines, err := prepareTestLog(logFile, lines, workDir)
	if err != nil {
		return fmt.Errorf("preparing test log: %w", err)
	}
	fmt.Printf("goldentest: test log: %s (%d lines)\n", testLogPath, totalInputLines)

	sourceID := fmt.Sprintf("goldentest-%d", time.Now().UnixNano())
	workspaceID := "goldentest"
	fmt.Printf("goldentest: source_id=%s workspace_id=%s\n", sourceID, workspaceID)

	// Registered early so it runs LAST (defers are LIFO): by the time this
	// fires, the pyClient.Shutdown defers registered below have already run
	// and Python has released its file handles, so the cleanup's os.Remove
	// calls won't race a still-open file (see cleanupPythonStorageFiles'
	// doc comment). pySourceIDForCleanup is set once create_log_source
	// resolves it, further down.
	var pySourceIDForCleanup string
	defer func() { cleanupPythonStorageFiles(repoRoot, pySourceIDForCleanup) }()

	// --- Isolate the Python sidecar's global Drain3 state (see package doc). ---
	restoreDrain, err := isolatePythonDrainState(repoRoot)
	if err != nil {
		return fmt.Errorf("isolating python drain state: %w", err)
	}
	defer restoreDrain()

	// --- Resolve/build the Go sidecar binary. ---
	goBinaryPath := goBinaryArg
	if goBinaryPath == "" {
		built, cleanup, err := buildGoSidecar(backendGoDir, workDir)
		if err != nil {
			return fmt.Errorf("building go sidecar (pass -go-binary to skip this step): %w", err)
		}
		defer cleanup()
		goBinaryPath = built
	} else if !filepath.IsAbs(goBinaryPath) {
		goBinaryPath, _ = filepath.Abs(goBinaryPath)
	}

	pyDBPath := filepath.Join(workDir, "python.duckdb")
	goDBPath := filepath.Join(workDir, "go.duckdb")

	pyStderr := filepath.Join(workDir, "python_stderr.log")
	goStderr := filepath.Join(workDir, "go_stderr.log")

	fmt.Println("goldentest: starting Python sidecar (uv run)...")
	pyClient, pyDone, err := startPython(repoRoot, pyDBPath, pyStderr)
	if err != nil {
		return fmt.Errorf("starting python sidecar: %w", err)
	}
	defer func() { _ = pyClient.Shutdown(5 * time.Second); <-pyDone }()

	fmt.Println("goldentest: starting Go sidecar...")
	goClient, goDone, err := startGo(goBinaryPath, goDBPath, workDir, goStderr)
	if err != nil {
		return fmt.Errorf("starting go sidecar: %w", err)
	}
	defer func() { _ = goClient.Shutdown(5 * time.Second); <-goDone }()

	// Give both processes a moment to finish App construction before the
	// first RPC call (both do real work at startup: schema init, default
	// settings seed, Drain3 state load).
	time.Sleep(500 * time.Millisecond)

	// Python's method_ingest_local_file hard-requires a pre-existing
	// log_sources row for the given source_id (its background worker
	// aborts the job with "Source ... was deleted" if none exists yet --
	// discovered empirically running this harness, api.py:1914-1927). Real
	// UI usage always calls create_log_source before ever ingesting, so
	// satisfy that precondition here via Python's own (already fully
	// implemented, not a stub) create_log_source RPC -- it doesn't accept a
	// caller-chosen source_id, so use whatever it generates for the Python
	// side specifically. The Go side has no such precondition (see
	// handlers_ingest.go's IngestLocalFile) and keeps using the
	// harness-generated sourceID directly; the two sides' source_ids never
	// need to match since nothing in the comparison is source_id-keyed.
	pySourceID, err := createLogSource(pyClient, workspaceID, sourceID, testLogPath, rpcTimeout)
	if err != nil {
		dumpStderr("python", pyStderr)
		return fmt.Errorf("python create_log_source: %w", err)
	}
	fmt.Printf("goldentest: created Python log_sources row, source_id=%s\n", pySourceID)
	// Python's DiskLogStore (services/log_file_store.py) writes to a fixed
	// PROJECT_ROOT/data/storage path regardless of --db, same as the Drain3
	// state isolatePythonDrainState works around above -- so this run's
	// ingested raw-text files land in the real repo's data/storage
	// directory under pySourceID, not anywhere workDir-scoped. Record it for
	// the cleanup defer registered at the top of run() to remove once
	// Python has exited and released its file handles.
	pySourceIDForCleanup = pySourceID

	fmt.Println("goldentest: ingesting into Python sidecar...")
	pyIngest, err := ingestAndSettle(pyClient, "python", workspaceID, pySourceID, testLogPath, waitTimeout, rpcTimeout)
	if err != nil {
		dumpStderr("python", pyStderr)
		return fmt.Errorf("python ingest/settle: %w", err)
	}

	fmt.Println("goldentest: ingesting into Go sidecar...")
	goIngest, err := ingestAndSettle(goClient, "go", workspaceID, sourceID, testLogPath, waitTimeout, rpcTimeout)
	if err != nil {
		dumpStderr("go", goStderr)
		return fmt.Errorf("go ingest/settle: %w", err)
	}

	fmt.Println("goldentest: fetching results from both sides...")
	pyLogs, pyClusters, err := fetchResults(pyClient, workspaceID, totalInputLines, rpcTimeout)
	if err != nil {
		dumpStderr("python", pyStderr)
		return fmt.Errorf("fetching python results: %w", err)
	}
	goLogs, goClusters, err := fetchResults(goClient, workspaceID, totalInputLines, rpcTimeout)
	if err != nil {
		dumpStderr("go", goStderr)
		return fmt.Errorf("fetching go results: %w", err)
	}

	report := compare(totalInputLines, pyIngest, goIngest, pyLogs, goLogs, pyClusters, goClusters)
	fmt.Println()
	fmt.Println(report)

	return nil
}

// --- Test log preparation ---

func prepareTestLog(srcPath string, maxLines int, workDir string) (path string, lineCount int, err error) {
	src, err := os.Open(srcPath)
	if err != nil {
		return "", 0, err
	}
	defer src.Close()

	dstPath := filepath.Join(workDir, "test_input.log")
	dst, err := os.Create(dstPath)
	if err != nil {
		return "", 0, err
	}
	defer dst.Close()

	scanner := bufio.NewScanner(src)
	scanner.Buffer(make([]byte, 0, 64*1024), 16*1024*1024)
	w := bufio.NewWriter(dst)
	count := 0
	for scanner.Scan() {
		if maxLines > 0 && count >= maxLines {
			break
		}
		if _, err := w.WriteString(scanner.Text()); err != nil {
			return "", 0, err
		}
		if err := w.WriteByte('\n'); err != nil {
			return "", 0, err
		}
		count++
	}
	if err := scanner.Err(); err != nil {
		return "", 0, err
	}
	if err := w.Flush(); err != nil {
		return "", 0, err
	}
	return dstPath, count, nil
}

// --- Python Drain3 state isolation ---

func isolatePythonDrainState(repoRoot string) (restore func(), err error) {
	drainDir := filepath.Join(repoRoot, "data", "drain")
	backupDir := drainDir + ".goldentest-backup"

	if _, statErr := os.Stat(backupDir); statErr == nil {
		return nil, fmt.Errorf(
			"stray backup %s already exists (a previous goldentest run may have been interrupted); "+
				"resolve manually before re-running (restore it to %s or delete it)", backupDir, drainDir,
		)
	}

	existed := false
	if _, statErr := os.Stat(drainDir); statErr == nil {
		existed = true
		if err := os.Rename(drainDir, backupDir); err != nil {
			return nil, fmt.Errorf("backing up %s: %w", drainDir, err)
		}
	}

	return func() {
		// Remove whatever this run's Python process wrote, then restore the
		// original directory (if any) so the repo's real dev state is
		// untouched by having run this harness.
		_ = os.RemoveAll(drainDir)
		if existed {
			if err := os.Rename(backupDir, drainDir); err != nil {
				fmt.Fprintf(os.Stderr, "goldentest: WARNING: failed to restore %s from %s: %v\n", drainDir, backupDir, err)
			}
		}
	}, nil
}

// --- Go sidecar build ---

func buildGoSidecar(backendGoDir, workDir string) (binPath string, cleanup func(), err error) {
	goTool, lookErr := exec.LookPath("go")
	if lookErr != nil {
		return "", nil, fmt.Errorf("`go` not found on PATH (pass -go-binary with a prebuilt sidecar.exe instead): %w", lookErr)
	}
	out := filepath.Join(workDir, "sidecar_test.exe")
	cmd := exec.Command(goTool, "build", "-o", out, "./cmd/sidecar")
	cmd.Dir = backendGoDir
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return "", nil, fmt.Errorf("go build failed: %w\n%s", err, stderr.String())
	}
	return out, func() {}, nil
}

// --- JSON-RPC stdio client (shared shape for both sidecars) ---

type rpcErrorObj struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data"`
}

type rpcResult struct {
	result json.RawMessage
	rpcErr *rpcErrorObj
}

type client struct {
	name  string
	cmd   *exec.Cmd
	stdin io.WriteCloser

	mu     sync.Mutex
	nextID int

	pendMu  sync.Mutex
	pending map[int]chan rpcResult

	shutdownOnce sync.Once
	exited       chan struct{}
}

func newClient(name string, cmd *exec.Cmd, stdin io.WriteCloser, stdout io.Reader) *client {
	c := &client{name: name, cmd: cmd, stdin: stdin, pending: make(map[int]chan rpcResult), exited: make(chan struct{})}
	go c.readLoop(stdout)
	return c
}

func (c *client) readLoop(stdout io.Reader) {
	scanner := bufio.NewScanner(stdout)
	scanner.Buffer(make([]byte, 0, 64*1024), 64*1024*1024)
	for scanner.Scan() {
		line := bytes.TrimSpace(scanner.Bytes())
		if len(line) == 0 {
			continue
		}
		var resp struct {
			ID     any             `json:"id"`
			Result json.RawMessage `json:"result"`
			Error  *rpcErrorObj    `json:"error"`
		}
		if err := json.Unmarshal(line, &resp); err != nil {
			continue
		}
		idFloat, ok := resp.ID.(float64)
		if !ok {
			continue
		}
		id := int(idFloat)

		c.pendMu.Lock()
		ch, ok := c.pending[id]
		if ok {
			delete(c.pending, id)
		}
		c.pendMu.Unlock()

		if ok {
			ch <- rpcResult{result: resp.Result, rpcErr: resp.Error}
		}
	}
}

func (c *client) Call(method string, params any, timeout time.Duration) (json.RawMessage, error) {
	c.mu.Lock()
	c.nextID++
	id := c.nextID
	c.mu.Unlock()

	req := map[string]any{"jsonrpc": "2.0", "id": id, "method": method, "params": params}
	b, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}
	b = append(b, '\n')

	ch := make(chan rpcResult, 1)
	c.pendMu.Lock()
	c.pending[id] = ch
	c.pendMu.Unlock()

	if _, err := c.stdin.Write(b); err != nil {
		return nil, fmt.Errorf("%s: writing request: %w", c.name, err)
	}

	select {
	case r := <-ch:
		if r.rpcErr != nil {
			return nil, fmt.Errorf("%s: rpc error %d: %s (%v)", c.name, r.rpcErr.Code, r.rpcErr.Message, r.rpcErr.Data)
		}
		return r.result, nil
	case <-time.After(timeout):
		c.pendMu.Lock()
		delete(c.pending, id)
		c.pendMu.Unlock()
		return nil, fmt.Errorf("%s: timeout waiting for %s response (id=%d)", c.name, method, id)
	}
}

// Shutdown closes stdin (EOF triggers a clean shutdown on both sidecars,
// including Python's Drain3 state save and Go's App.Close save) and waits
// (bounded) for the process to exit, killing it if it doesn't. Safe to call
// more than once (only the first call's cmd.Wait() actually runs); closes
// c.exited when the process has exited.
func (c *client) Shutdown(wait time.Duration) error {
	c.shutdownOnce.Do(func() {
		_ = c.stdin.Close()

		done := make(chan error, 1)
		go func() { done <- c.cmd.Wait() }()

		select {
		case <-done:
		case <-time.After(wait):
			_ = c.cmd.Process.Kill()
			<-done
		}
		close(c.exited)
	})
	return nil
}

func startPython(repoRoot, dbPath, stderrPath string) (*client, chan struct{}, error) {
	mainPy := filepath.Join(repoRoot, "sidecar", "main.py")
	cmd := exec.Command("uv", "run", "python", mainPy, "--stdio", "--db", dbPath)
	cmd.Dir = repoRoot
	return startClient("python", cmd, stderrPath)
}

func startGo(binPath, dbPath, dir, stderrPath string) (*client, chan struct{}, error) {
	cmd := exec.Command(binPath, "--stdio", "--db", dbPath)
	cmd.Dir = dir
	return startClient("go", cmd, stderrPath)
}

// startClient launches cmd with piped stdin/stdout (stderr redirected to
// stderrPath for post-mortem inspection on failure) and returns a ready
// *client plus a channel that's closed once the process has exited. The
// returned channel exists purely so callers (see run()'s deferred Shutdown
// calls) can observe process exit without a second, racing call to
// cmd.Wait() -- exec.Cmd only tolerates one Wait() call per process, so
// this package always routes through client.Shutdown, which owns the single
// cmd.Wait() call and closes this channel itself.
func startClient(name string, cmd *exec.Cmd, stderrPath string) (*client, chan struct{}, error) {
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, nil, err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, nil, err
	}
	stderrFile, err := os.Create(stderrPath)
	if err != nil {
		return nil, nil, err
	}
	cmd.Stderr = stderrFile

	if err := cmd.Start(); err != nil {
		return nil, nil, err
	}

	c := newClient(name, cmd, stdin, stdout)
	return c, c.exited, nil
}

// createLogSource calls create_log_source and returns the server-generated
// source_id, used to satisfy Python's ingest_local_file precondition (see
// the call site's comment in run()).
func createLogSource(c *client, workspaceID, name, path string, rpcTimeout time.Duration) (string, error) {
	raw, err := c.Call("create_log_source", map[string]any{
		"workspace_id": workspaceID,
		"name":         name,
		"type":         "file",
		"path":         filepath.ToSlash(path),
	}, rpcTimeout)
	if err != nil {
		return "", err
	}
	var resp struct {
		SourceID string `json:"source_id"`
	}
	if err := json.Unmarshal(raw, &resp); err != nil {
		return "", fmt.Errorf("decoding create_log_source: %w", err)
	}
	if resp.SourceID == "" {
		return "", fmt.Errorf("create_log_source returned an empty source_id (raw=%s)", string(raw))
	}
	return resp.SourceID, nil
}

// cleanupPythonStorageFiles removes the .log/.index files Python's
// DiskLogStore wrote for sourceID under the real repo's data/storage
// directory (see the call site's comment). Best-effort: errors are logged,
// never fatal to the run. Must only be called after the Python process has
// exited (its file handles released) -- see run()'s early defer
// registration comment for how that ordering is guaranteed.
func cleanupPythonStorageFiles(repoRoot, sourceID string) {
	if sourceID == "" {
		return
	}
	dir := filepath.Join(repoRoot, "data", "storage")
	for _, ext := range []string{".log", ".index"} {
		p := filepath.Join(dir, sourceID+ext)
		if err := os.Remove(p); err != nil && !os.IsNotExist(err) {
			fmt.Fprintf(os.Stderr, "goldentest: WARNING: failed to clean up %s: %v\n", p, err)
		}
	}
}

// --- Ingest + settle ---

type ingestSummary struct {
	count      int
	settleTime time.Duration
	backlog    int
}

// ingestAndSettle calls ingest_local_file, then waits for BOTH of these to
// settle before considering the data ready to compare:
//
//  1. get_logs' total to reach expectedTotal -- needed because the two
//     sidecars complete ingestion on different timelines: Python enqueues
//     the file onto a background serial-worker queue and returns
//     immediately (rows don't exist in `logs` at all until that worker
//     thread actually runs), while Go inserts rows synchronously within the
//     RPC call itself but leaves them unprocessed for the async clustering
//     worker (see handlers_ingest.go's architecture note). Polling
//     get_clustering_status alone (as an earlier version of this harness
//     did) is wrong for the Python side: immediately after the RPC returns,
//     no rows exist yet, so backlog trivially reads 0 despite ingestion
//     having not even started.
//  2. get_clustering_status's backlog to reach 0 -- needed for the Go side,
//     where row insertion and clustering are two separate asynchronous
//     stages; a no-op wait on the Python side, whose clustering is already
//     complete by the time its rows are inserted at all.
func ingestAndSettle(c *client, label, workspaceID, sourceID, logPath string, waitTimeout, rpcTimeout time.Duration) (ingestSummary, error) {
	params := map[string]any{
		"workspace_id": workspaceID,
		"source_id":    sourceID,
		"filepath":     filepath.ToSlash(logPath),
	}
	raw, err := c.Call("ingest_local_file", params, rpcTimeout)
	if err != nil {
		return ingestSummary{}, err
	}
	var ingestResp struct {
		Count      int `json:"count"`
		TotalLines int `json:"total_lines"`
	}
	_ = json.Unmarshal(raw, &ingestResp)
	expected := ingestResp.TotalLines
	if expected == 0 {
		expected = ingestResp.Count
	}
	fmt.Printf("goldentest[%s]: ingest_local_file accepted, expecting %d rows\n", label, expected)

	start := time.Now()
	deadline := start.Add(waitTimeout)

	// Stage 1: wait for row count to reach `expected`.
	lastTotal := -1
	for time.Now().Before(deadline) {
		raw, err := c.Call("get_logs", map[string]any{
			"workspace_id": workspaceID, "offset": 0, "limit": 1, "sort_by": "id", "sort_order": "ASC",
		}, rpcTimeout)
		if err != nil {
			return ingestSummary{}, err
		}
		var resp struct {
			Total int `json:"total"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return ingestSummary{}, fmt.Errorf("decoding get_logs: %w", err)
		}
		lastTotal = resp.Total
		if resp.Total >= expected {
			break
		}
		time.Sleep(200 * time.Millisecond)
	}
	if lastTotal < expected {
		return ingestSummary{count: lastTotal, settleTime: time.Since(start)},
			fmt.Errorf("%s: row count did not reach %d within %s (last total=%d)", label, expected, waitTimeout, lastTotal)
	}
	fmt.Printf("goldentest[%s]: row count settled at %d after %s\n", label, lastTotal, time.Since(start))

	// Stage 2: wait for the clustering backlog to drain.
	lastBacklog := -1
	for time.Now().Before(deadline) {
		raw, err := c.Call("get_clustering_status", map[string]any{}, rpcTimeout)
		if err != nil {
			return ingestSummary{}, err
		}
		var status struct {
			Backlog int `json:"backlog"`
		}
		if err := json.Unmarshal(raw, &status); err != nil {
			return ingestSummary{}, fmt.Errorf("decoding get_clustering_status: %w", err)
		}
		lastBacklog = status.Backlog
		if status.Backlog == 0 {
			return ingestSummary{count: lastTotal, settleTime: time.Since(start), backlog: 0}, nil
		}
		time.Sleep(300 * time.Millisecond)
	}

	return ingestSummary{count: lastTotal, settleTime: time.Since(start), backlog: lastBacklog},
		fmt.Errorf("%s: clustering backlog did not reach 0 within %s (last backlog=%d)", label, waitTimeout, lastBacklog)
}

// --- Fetch results ---

type logRow struct {
	Level     string `json:"level"`
	Timestamp string `json:"timestamp"`
	ClusterID string `json:"cluster_id"`
}

type clusterRow struct {
	ID       any    `json:"id"`
	Template string `json:"template"`
	Size     int    `json:"size"`
}

func fetchResults(c *client, workspaceID string, totalInputLines int, rpcTimeout time.Duration) ([]logRow, []clusterRow, error) {
	limit := totalInputLines + 100
	raw, err := c.Call("get_logs", map[string]any{
		"workspace_id": workspaceID,
		"offset":       0,
		"limit":        limit,
		"sort_by":      "id",
		"sort_order":   "ASC",
	}, rpcTimeout)
	if err != nil {
		return nil, nil, fmt.Errorf("get_logs: %w", err)
	}
	var logsResp struct {
		Logs []logRow `json:"logs"`
	}
	if err := json.Unmarshal(raw, &logsResp); err != nil {
		return nil, nil, fmt.Errorf("decoding get_logs: %w", err)
	}

	raw, err = c.Call("get_clusters", map[string]any{"workspace_id": workspaceID}, rpcTimeout)
	if err != nil {
		return nil, nil, fmt.Errorf("get_clusters: %w", err)
	}
	var clusters []clusterRow
	if err := json.Unmarshal(raw, &clusters); err != nil {
		return nil, nil, fmt.Errorf("decoding get_clusters: %w", err)
	}

	return logsResp.Logs, clusters, nil
}

func dumpStderr(label, path string) {
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	fmt.Fprintf(os.Stderr, "\n--- %s stderr (%s) ---\n%s\n--- end %s stderr ---\n", label, path, string(data), label)
}

// --- Comparison / report ---

func compare(totalInput int, pyIngest, goIngest ingestSummary, pyLogs, goLogs []logRow, pyClusters, goClusters []clusterRow) string {
	var b strings.Builder

	fmt.Fprintf(&b, "=== LogLensAi Go-vs-Python Golden File Comparison ===\n")
	fmt.Fprintf(&b, "Input lines:            %d\n", totalInput)
	fmt.Fprintf(&b, "Python: ingested=%d, get_logs returned=%d, settle_time=%s\n", pyIngest.count, len(pyLogs), pyIngest.settleTime)
	fmt.Fprintf(&b, "Go:     ingested=%d, get_logs returned=%d, settle_time=%s\n", goIngest.count, len(goLogs), goIngest.settleTime)
	fmt.Fprintln(&b)

	// --- Log count parity ---
	if len(pyLogs) == len(goLogs) && len(pyLogs) == totalInput {
		fmt.Fprintf(&b, "[PASS] Log count parity: both sides ingested and stored exactly %d rows.\n", totalInput)
	} else {
		fmt.Fprintf(&b, "[FAIL] Log count mismatch: python=%d go=%d input=%d\n", len(pyLogs), len(goLogs), totalInput)
	}

	// --- Per-row (level, timestamp) alignment ---
	n := len(pyLogs)
	if len(goLogs) < n {
		n = len(goLogs)
	}
	levelMismatches := 0
	tsMismatches := 0
	var levelExamples, tsExamples []string
	for i := 0; i < n; i++ {
		if pyLogs[i].Level != goLogs[i].Level {
			levelMismatches++
			if len(levelExamples) < 5 {
				levelExamples = append(levelExamples, fmt.Sprintf("row %d: python=%q go=%q", i, pyLogs[i].Level, goLogs[i].Level))
			}
		}
		if pyLogs[i].Timestamp != goLogs[i].Timestamp {
			tsMismatches++
			if len(tsExamples) < 5 {
				tsExamples = append(tsExamples, fmt.Sprintf("row %d: python=%q go=%q", i, pyLogs[i].Timestamp, goLogs[i].Timestamp))
			}
		}
	}
	if levelMismatches == 0 {
		fmt.Fprintf(&b, "[PASS] Level extraction: all %d compared rows match exactly.\n", n)
	} else {
		fmt.Fprintf(&b, "[FAIL] Level extraction: %d/%d rows differ. Examples:\n", levelMismatches, n)
		for _, ex := range levelExamples {
			fmt.Fprintf(&b, "         %s\n", ex)
		}
	}
	if tsMismatches == 0 {
		fmt.Fprintf(&b, "[PASS] Timestamp extraction: all %d compared rows match exactly.\n", n)
	} else {
		fmt.Fprintf(&b, "[FAIL] Timestamp extraction: %d/%d rows differ. Examples:\n", tsMismatches, n)
		for _, ex := range tsExamples {
			fmt.Fprintf(&b, "         %s\n", ex)
		}
	}

	// --- Level distribution ---
	pyDist := levelDistribution(pyLogs)
	goDist := levelDistribution(goLogs)
	fmt.Fprintf(&b, "\nLevel distribution:\n")
	fmt.Fprintf(&b, "  python: %s\n", formatDist(pyDist))
	fmt.Fprintf(&b, "  go:     %s\n", formatDist(goDist))

	// --- Cluster count ---
	fmt.Fprintf(&b, "\nCluster count: python=%d go=%d (delta=%d)\n", len(pyClusters), len(goClusters), len(goClusters)-len(pyClusters))

	// --- Template overlap ---
	pySet := templateSet(pyClusters)
	goSet := templateSet(goClusters)
	common := 0
	for t := range pySet {
		if goSet[t] {
			common++
		}
	}
	fmt.Fprintf(&b, "Template overlap: %d templates appear identically on both sides (out of %d python / %d go distinct templates).\n", common, len(pySet), len(goSet))

	onlyPy := setDiff(pySet, goSet)
	onlyGo := setDiff(goSet, pySet)
	if len(onlyPy) > 0 {
		fmt.Fprintf(&b, "  Only in Python (%d), up to 10 shown:\n", len(onlyPy))
		for i, t := range onlyPy {
			if i >= 10 {
				break
			}
			fmt.Fprintf(&b, "    - %s\n", t)
		}
	}
	if len(onlyGo) > 0 {
		fmt.Fprintf(&b, "  Only in Go (%d), up to 10 shown:\n", len(onlyGo))
		for i, t := range onlyGo {
			if i >= 10 {
				break
			}
			fmt.Fprintf(&b, "    - %s\n", t)
		}
	}

	fmt.Fprintln(&b, "\n=== End of report ===")
	return b.String()
}

func levelDistribution(rows []logRow) map[string]int {
	out := make(map[string]int)
	for _, r := range rows {
		out[r.Level]++
	}
	return out
}

func formatDist(dist map[string]int) string {
	keys := make([]string, 0, len(dist))
	for k := range dist {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, fmt.Sprintf("%s=%d", k, dist[k]))
	}
	return strings.Join(parts, " ")
}

func templateSet(clusters []clusterRow) map[string]bool {
	out := make(map[string]bool, len(clusters))
	for _, c := range clusters {
		out[c.Template] = true
	}
	return out
}

func setDiff(a, b map[string]bool) []string {
	var out []string
	for k := range a {
		if !b[k] {
			out = append(out, k)
		}
	}
	sort.Strings(out)
	return out
}
