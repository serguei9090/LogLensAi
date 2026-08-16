package ingestion

import (
	"bytes"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"loglensai/backend-go/internal/db"
)

// fakeIngester is a BatchIngester test double that records every batch it
// receives.
type fakeIngester struct {
	mu      sync.Mutex
	batches [][]IngestEntry
}

func (f *fakeIngester) IngestBatch(entries []IngestEntry) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	cp := make([]IngestEntry, len(entries))
	copy(cp, entries)
	f.batches = append(f.batches, cp)
	return nil
}

func (f *fakeIngester) all() []IngestEntry {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []IngestEntry
	for _, b := range f.batches {
		out = append(out, b...)
	}
	return out
}

func waitForEntries(t *testing.T, f *fakeIngester, want int, timeout time.Duration) []IngestEntry {
	t.Helper()
	deadline := time.Now().Add(timeout)
	var got []IngestEntry
	for time.Now().Before(deadline) {
		got = f.all()
		if len(got) >= want {
			return got
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for %d entries, got %d", want, len(got))
	return nil
}

// TestServer_UDPSyslog_ReceivesAndRoutes verifies a UDP packet sent to the
// syslog listener's bound port is decoded, tagged with source_ip, and
// (absent any matching `log_streams` row) routed to the default/syslog
// fallback stream.
func TestServer_UDPSyslog_ReceivesAndRoutes(t *testing.T) {
	d := openTestDB(t)
	ingester := &fakeIngester{}
	srv := NewServer(d, ingester, true, 0, false, 0)

	if err := srv.Start(); err != nil {
		t.Fatalf("Start: %v", err)
	}
	t.Cleanup(srv.Stop)

	addr := srv.SyslogAddr()
	if addr == "" {
		t.Fatal("SyslogAddr() is empty after Start")
	}

	conn, err := net.Dial("udp4", loopbackDialAddr(t, addr))
	if err != nil {
		t.Fatalf("dial syslog listener: %v", err)
	}
	defer conn.Close()

	if _, err := conn.Write([]byte("  <34>1 test syslog message  \n")); err != nil {
		t.Fatalf("write UDP packet: %v", err)
	}

	entries := waitForEntries(t, ingester, 1, 2*time.Second)
	if entries[0].WorkspaceID != "default" || entries[0].SourceID != "syslog" {
		t.Errorf("got workspace_id=%q source_id=%q, want default/syslog fallback", entries[0].WorkspaceID, entries[0].SourceID)
	}
	if entries[0].RawText != "<34>1 test syslog message" {
		t.Errorf("RawText = %q, want trimmed packet text", entries[0].RawText)
	}
	if entries[0].Facets["source_ip"] == "" {
		t.Error("expected source_ip facet to be populated")
	}
}

// TestServer_UDPSyslog_RoutesToConfiguredStream verifies a `log_streams` row
// matching type=syslog+port takes precedence over the default fallback.
func TestServer_UDPSyslog_RoutesToConfiguredStream(t *testing.T) {
	d := openTestDB(t)
	ingester := &fakeIngester{}

	// Routing matches log_streams.port against the server's *configured*
	// syslog port (ingestion.py compares against a real, fixed
	// settings-driven port — this never uses port 0 in practice), so the
	// test needs a concrete free port rather than the "pick any free port"
	// 0 used by the other UDP test.
	port := freeUDPPort(t)
	seedLogStream(t, d, "ws-syslog", "custom-syslog", "syslog", port)

	srv := NewServer(d, ingester, true, port, false, 0)
	if err := srv.Start(); err != nil {
		t.Fatalf("Start: %v", err)
	}
	t.Cleanup(srv.Stop)

	conn, err := net.Dial("udp4", loopbackDialAddr(t, srv.SyslogAddr()))
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer conn.Close()
	if _, err := conn.Write([]byte("routed message")); err != nil {
		t.Fatalf("write: %v", err)
	}

	entries := waitForEntries(t, ingester, 1, 2*time.Second)
	if entries[0].WorkspaceID != "ws-syslog" || entries[0].SourceID != "custom-syslog" {
		t.Errorf("got workspace_id=%q source_id=%q, want ws-syslog/custom-syslog", entries[0].WorkspaceID, entries[0].SourceID)
	}
}

// TestServer_HTTP_SingleObjectAndArray verifies the HTTP push handler
// accepts both a single JSON object and a JSON array, and maps a `message`
// field to `raw_text` when `raw_text` is absent. With no explicit
// workspace_id in the URL and no matching `log_streams` row, routing falls
// back to the "default" stream — which, matching ingestion.py's
// handle_ingest, overwrites each entry's own workspace_id field rather
// than preserving whatever the payload sent (entry["workspace_id"] =
// stream["workspace_id"] runs unconditionally for every target stream).
func TestServer_HTTP_SingleObjectAndArray(t *testing.T) {
	d := openTestDB(t)
	ingester := &fakeIngester{}
	srv := NewServer(d, ingester, false, 0, true, 0)
	startFlushOnly(t, srv)
	ts := httptest.NewServer(srv.mux())
	defer ts.Close()

	// Single object, using `message` (no raw_text) — should be mapped.
	singleBody := `{"message":"hello from object"}`
	resp, err := http.Post(ts.URL+"/ingest", "application/json", bytes.NewBufferString(singleBody))
	if err != nil {
		t.Fatalf("POST /ingest (object): %v", err)
	}
	assertOKAndCount(t, resp, 1)

	// Array of two objects, one with raw_text, one with message.
	arrayBody := `[{"raw_text":"first"},{"message":"second"}]`
	resp, err = http.Post(ts.URL+"/ingest", "application/json", bytes.NewBufferString(arrayBody))
	if err != nil {
		t.Fatalf("POST /ingest (array): %v", err)
	}
	assertOKAndCount(t, resp, 2)

	entries := waitForEntries(t, ingester, 3, 2*time.Second)

	byText := map[string]bool{}
	for _, e := range entries {
		byText[e.RawText] = true
		if e.WorkspaceID != "default" {
			t.Errorf("entry %+v has workspace_id %q, want default (no matching log_streams row)", e, e.WorkspaceID)
		}
		if e.SourceID != "http-ingest" {
			t.Errorf("entry %+v has source_id %q, want http-ingest (default fallback)", e, e.SourceID)
		}
	}
	for _, want := range []string{"hello from object", "first", "second"} {
		if !byText[want] {
			t.Errorf("missing expected entry with raw_text=%q among %v", want, entries)
		}
	}
}

// TestServer_HTTP_WorkspacePathRouting verifies /ingest/{workspace_id}/{collection_name}
// overrides the payload's own workspace_id/source_id, matching
// ingestion.py's "explicit workspace in URL takes precedence" rule.
func TestServer_HTTP_WorkspacePathRouting(t *testing.T) {
	d := openTestDB(t)
	ingester := &fakeIngester{}
	srv := NewServer(d, ingester, false, 0, true, 0)
	startFlushOnly(t, srv)
	ts := httptest.NewServer(srv.mux())
	defer ts.Close()

	body := `{"raw_text":"payload says something else","workspace_id":"ignored-ws","source_id":"ignored-src"}`
	resp, err := http.Post(ts.URL+"/ingest/ws-from-path/coll-from-path", "application/json", bytes.NewBufferString(body))
	if err != nil {
		t.Fatalf("POST: %v", err)
	}
	assertOKAndCount(t, resp, 1)

	entries := waitForEntries(t, ingester, 1, 2*time.Second)
	if entries[0].WorkspaceID != "ws-from-path" || entries[0].SourceID != "coll-from-path" {
		t.Errorf("got workspace_id=%q source_id=%q, want ws-from-path/coll-from-path", entries[0].WorkspaceID, entries[0].SourceID)
	}
}

// TestServer_HTTP_InvalidJSON verifies malformed JSON gets a 400, not a
// panic or 500.
func TestServer_HTTP_InvalidJSON(t *testing.T) {
	d := openTestDB(t)
	ingester := &fakeIngester{}
	srv := NewServer(d, ingester, false, 0, true, 0)
	ts := httptest.NewServer(srv.mux())
	defer ts.Close()

	resp, err := http.Post(ts.URL+"/ingest", "application/json", bytes.NewBufferString("not json"))
	if err != nil {
		t.Fatalf("POST: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", resp.StatusCode)
	}
}

// TestDBBatchIngester_IngestBatch is an end-to-end check of the seam's
// default implementation: entries land in `logs` with cluster_id=NULL /
// processed=FALSE, and raw text is retrievable back out of the log store.
func TestDBBatchIngester_IngestBatch(t *testing.T) {
	d := openTestDB(t)
	store := newTestLogStore(t)
	ingester := NewDBBatchIngester(d, store)

	err := ingester.IngestBatch([]IngestEntry{
		{WorkspaceID: "ws1", SourceID: "src1", RawText: "first line"},
		{WorkspaceID: "ws1", SourceID: "src1", RawText: "second line"},
		{WorkspaceID: "", SourceID: "", RawText: "defaults line"},
	})
	if err != nil {
		t.Fatalf("IngestBatch: %v", err)
	}

	if got := countLogs(t, d); got != 3 {
		t.Fatalf("expected 3 rows, got %d", got)
	}

	var ws, src string
	if err := d.Conn.QueryRow(`SELECT workspace_id, source_id FROM logs WHERE raw_text = 'defaults line'`).Scan(&ws, &src); err != nil {
		t.Fatalf("querying defaulted row: %v", err)
	}
	if ws != "default" || src != "manual" {
		t.Errorf("got workspace_id=%q source_id=%q, want default/manual", ws, src)
	}

	lines, err := store.GetHotBuffer("src1")
	if err != nil {
		t.Fatalf("GetHotBuffer: %v", err)
	}
	if len(lines) != 2 || lines[0].Text != "first line" || lines[1].Text != "second line" {
		t.Fatalf("log store hot buffer = %+v, want [first line, second line]", lines)
	}
}

func assertOKAndCount(t *testing.T, resp *http.Response, wantCount int) {
	t.Helper()
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	var out struct {
		Status string `json:"status"`
		Count  int    `json:"count"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decoding response: %v", err)
	}
	if out.Status != "ok" || out.Count != wantCount {
		t.Fatalf("got %+v, want status=ok count=%d", out, wantCount)
	}
}

// startFlushOnly runs srv's flush worker (without binding any real
// syslog/HTTP listener), for tests that exercise handleIngest directly via
// srv.mux() + httptest and still need entries to actually reach the
// ingester.
func startFlushOnly(t *testing.T, srv *Server) {
	t.Helper()
	srv.stopCh = make(chan struct{})
	srv.wg.Add(1)
	go srv.runFlushWorker()
	t.Cleanup(func() {
		close(srv.stopCh)
		srv.wg.Wait()
	})
}

// freeUDPPort finds a currently-unused UDP port by briefly binding to port
// 0 and releasing it. Small TOCTOU race in theory; fine for test use.
func freeUDPPort(t *testing.T) int {
	t.Helper()
	conn, err := net.ListenUDP("udp4", &net.UDPAddr{Port: 0})
	if err != nil {
		t.Fatalf("finding a free UDP port: %v", err)
	}
	port := conn.LocalAddr().(*net.UDPAddr).Port
	conn.Close()
	return port
}

func seedLogStream(t *testing.T, d *db.DB, workspaceID, name, streamType string, port int) {
	t.Helper()
	_, err := d.Conn.Exec(
		`INSERT INTO log_streams (workspace_id, name, type, port, enabled) VALUES (?, ?, ?, ?, TRUE)`,
		workspaceID, name, streamType, port,
	)
	if err != nil {
		t.Fatalf("seeding log_streams: %v", err)
	}
}

// loopbackDialAddr rewrites a "0.0.0.0:port"-style bound address (as
// reported by SyslogAddr, matching the server's wildcard bind) into a
// dialable "127.0.0.1:port" for test clients on the same machine.
func loopbackDialAddr(t *testing.T, addr string) string {
	t.Helper()
	_, port, err := net.SplitHostPort(addr)
	if err != nil {
		t.Fatalf("SplitHostPort(%q): %v", addr, err)
	}
	return net.JoinHostPort("127.0.0.1", port)
}

func atoiT(t *testing.T, s string) int {
	t.Helper()
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			t.Fatalf("atoiT(%q): not numeric", s)
		}
		n = n*10 + int(c-'0')
	}
	return n
}
