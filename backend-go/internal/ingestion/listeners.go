package ingestion

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"loglensai/backend-go/internal/db"
)

// listenerBatchSize/listenerFlushInterval mirror ingestion.py's
// `_run_flush_worker`: flush whenever the batch reaches 1000 entries, or
// 1s have passed, whichever comes first.
const (
	listenerBatchSize     = 1000
	listenerFlushInterval = 1 * time.Second
)

// portReleasePause mirrors ingestion.py's `reconfigure`'s
// `time.sleep(0.2)` between stop and restart, giving the OS a moment to
// release the previously bound ports.
const portReleasePause = 200 * time.Millisecond

// Server runs the syslog UDP and HTTP push listeners, batching everything
// they receive into a shared BatchIngester. Ports ingestion.py's
// IngestionServer.
type Server struct {
	db       *db.DB
	ingester BatchIngester

	mu            sync.Mutex
	syslogEnabled bool
	syslogPort    int
	httpEnabled   bool
	httpPort      int
	running       bool

	stopCh chan struct{}
	wg     sync.WaitGroup
	queue  *microBatchQueue[IngestEntry]

	udpConn  *net.UDPConn
	httpSrv  *http.Server
	httpAddr string

	streamsMu sync.Mutex
	streams   []db.LogStreamConfig
}

// NewServer builds a Server that inserts through ingester and routes syslog
// (UDP, syslogPort) and HTTP push (TCP, httpPort) traffic according to
// `log_streams` rows read from database. Either listener can be disabled.
func NewServer(database *db.DB, ingester BatchIngester, syslogEnabled bool, syslogPort int, httpEnabled bool, httpPort int) *Server {
	return &Server{
		db:            database,
		ingester:      ingester,
		syslogEnabled: syslogEnabled,
		syslogPort:    syslogPort,
		httpEnabled:   httpEnabled,
		httpPort:      httpPort,
		// Allocated here (not in Start) so handleIngest is safe to exercise
		// directly — e.g. via mux() + httptest — without a full Start/Stop
		// cycle binding real ports.
		queue: newMicroBatchQueue[IngestEntry](listenerBatchSize),
	}
}

// Running reports whether the server's listeners are currently active.
func (s *Server) Running() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.running
}

// SyslogAddr returns the syslog UDP listener's actual bound address (useful
// when constructed with port 0), or "" if it isn't currently listening.
func (s *Server) SyslogAddr() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.udpConn == nil {
		return ""
	}
	return s.udpConn.LocalAddr().String()
}

// HTTPAddr returns the HTTP push listener's actual bound address (useful
// when constructed with port 0), or "" if it isn't currently listening.
func (s *Server) HTTPAddr() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.httpAddr
}

// mux builds the HTTP push listener's routes. Split out from Start so tests
// can exercise routing/handler behavior via httptest without binding a real
// port.
func (s *Server) mux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /ingest", s.handleIngest)
	mux.HandleFunc("POST /ingest/{workspace_id}", s.handleIngest)
	mux.HandleFunc("POST /ingest/{workspace_id}/{collection_name}", s.handleIngest)
	mux.HandleFunc("POST /{$}", s.handleIngest)
	return mux
}

// RefreshStreams re-reads every enabled `log_streams` row for routing.
// Ports IngestionServer.refresh_streams.
func (s *Server) RefreshStreams() error {
	streams, err := s.db.ActiveLogStreams()
	if err != nil {
		return fmt.Errorf("ingestion: refreshing log streams: %w", err)
	}
	s.streamsMu.Lock()
	s.streams = streams
	s.streamsMu.Unlock()
	return nil
}

// Start begins the flush worker and (per current enabled flags) the syslog
// UDP and HTTP push listeners. Ports IngestionServer.start.
func (s *Server) Start() error {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return nil
	}
	s.running = true
	s.stopCh = make(chan struct{})
	syslogEnabled, syslogPort := s.syslogEnabled, s.syslogPort
	httpEnabled, httpPort := s.httpEnabled, s.httpPort
	s.mu.Unlock()

	if err := s.RefreshStreams(); err != nil {
		log.Printf("[Ingestion] Failed to refresh log streams: %v", err)
	}

	s.wg.Add(1)
	go s.runFlushWorker()

	if syslogEnabled {
		// "udp4" + 0.0.0.0 matches ingestion.py's
		// `socket.socket(socket.AF_INET, socket.SOCK_DGRAM); sock.bind(("0.0.0.0", port))`
		// — IPv4-only, all interfaces.
		conn, err := net.ListenUDP("udp4", &net.UDPAddr{Port: syslogPort})
		if err != nil {
			s.mu.Lock()
			s.running = false
			s.mu.Unlock()
			return fmt.Errorf("ingestion: binding syslog UDP port %d: %w", syslogPort, err)
		}
		s.mu.Lock()
		s.udpConn = conn
		s.mu.Unlock()

		s.wg.Add(1)
		go s.runSyslog(conn)
		log.Printf("Ingestion Server: Syslog UDP listener started on port %d", syslogPort)
	}

	if httpEnabled {
		addr := ":" + strconv.Itoa(httpPort)
		ln, err := net.Listen("tcp", addr)
		if err != nil {
			s.Stop()
			return fmt.Errorf("ingestion: binding HTTP port %d: %w", httpPort, err)
		}

		srv := &http.Server{Handler: s.mux()}
		s.mu.Lock()
		s.httpSrv = srv
		s.httpAddr = ln.Addr().String()
		s.mu.Unlock()

		s.wg.Add(1)
		go func() {
			defer s.wg.Done()
			if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
				log.Printf("[Ingestion] HTTP listener error: %v", err)
			}
		}()
		log.Printf("Ingestion Server: HTTP TCP listener started on port %d", httpPort)
	}

	return nil
}

// Stop shuts down both listeners and the flush worker, waiting for all of
// them to exit. Ports IngestionServer.stop.
func (s *Server) Stop() {
	s.mu.Lock()
	if !s.running {
		s.mu.Unlock()
		return
	}
	s.running = false
	close(s.stopCh)
	udp := s.udpConn
	httpSrv := s.httpSrv
	s.udpConn = nil
	s.httpSrv = nil
	s.httpAddr = ""
	s.mu.Unlock()

	if udp != nil {
		_ = udp.Close()
	}
	if httpSrv != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		_ = httpSrv.Shutdown(ctx)
		cancel()
	}

	s.wg.Wait()
	log.Println("Ingestion Server: Stopped")
}

// Reconfigure stops (if running), updates syslog/http enabled+port
// settings, pauses briefly for the OS to release the old ports, and
// restarts. A no-op if nothing changed and the server is already running.
// Ports IngestionServer.reconfigure.
func (s *Server) Reconfigure(syslogEnabled bool, syslogPort int, httpEnabled bool, httpPort int) error {
	s.mu.Lock()
	changed := s.syslogEnabled != syslogEnabled || s.syslogPort != syslogPort ||
		s.httpEnabled != httpEnabled || s.httpPort != httpPort
	running := s.running
	s.mu.Unlock()

	if !changed && running {
		return nil
	}

	log.Println("Ingestion Server: Reconfiguring listeners...")
	s.Stop()
	time.Sleep(portReleasePause)

	s.mu.Lock()
	s.syslogEnabled = syslogEnabled
	s.syslogPort = syslogPort
	s.httpEnabled = httpEnabled
	s.httpPort = httpPort
	s.mu.Unlock()

	return s.Start()
}

// runFlushWorker drains the shared queue into ingester whenever it fills up
// or every listenerFlushInterval, plus one final flush on shutdown. Ports
// IngestionServer._run_flush_worker.
func (s *Server) runFlushWorker() {
	defer s.wg.Done()

	ticker := time.NewTicker(listenerFlushInterval)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopCh:
			s.flush()
			return
		case <-s.queue.wake:
			s.flush()
		case <-ticker.C:
			s.flush()
		}
	}
}

func (s *Server) flush() {
	batch := s.queue.drain()
	if len(batch) == 0 {
		return
	}
	if err := s.ingester.IngestBatch(batch); err != nil {
		log.Printf("[Ingestion] Failed to bulk ingest streams: %v", err)
	}
}

// runSyslog receives UDP packets on conn until it is closed (by Stop),
// routing each to every enabled `type='syslog'` stream bound to this port,
// or a `default/syslog` fallback if none match. Ports
// IngestionServer._run_syslog.
func (s *Server) runSyslog(conn *net.UDPConn) {
	defer s.wg.Done()

	buf := make([]byte, 65536)
	for {
		n, addr, err := conn.ReadFromUDP(buf)
		if err != nil {
			select {
			case <-s.stopCh:
				return
			default:
			}
			log.Printf("Syslog ingestion network error: %v", err)
			continue
		}

		rawText := strings.TrimSpace(string(buf[:n]))
		if rawText == "" {
			continue
		}

		s.streamsMu.Lock()
		syslogPort := s.currentSyslogPort()
		var targets []db.LogStreamConfig
		for _, st := range s.streams {
			if st.Type == "syslog" && st.Port == syslogPort {
				targets = append(targets, st)
			}
		}
		s.streamsMu.Unlock()
		if len(targets) == 0 {
			targets = []db.LogStreamConfig{{WorkspaceID: "default", Name: "syslog"}}
		}

		host, _, splitErr := net.SplitHostPort(addr.String())
		if splitErr != nil {
			host = addr.String()
		}

		now := time.Now().Format("2006-01-02 15:04:05")
		for _, t := range targets {
			s.queue.push(IngestEntry{
				WorkspaceID: t.WorkspaceID,
				SourceID:    t.Name,
				RawText:     rawText,
				Timestamp:   now,
				Level:       "INFO",
				Facets:      map[string]string{"source_ip": host},
			})
		}
	}
}

func (s *Server) currentSyslogPort() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.syslogPort
}

func (s *Server) currentHTTPPort() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.httpPort
}

// handleIngest serves POST /ingest, /ingest/{workspace_id},
// /ingest/{workspace_id}/{collection_name}, and /, accepting a single JSON
// object or an array of objects. Ports ingestion.py's handle_ingest.
func (s *Server) handleIngest(w http.ResponseWriter, r *http.Request) {
	workspaceID := r.PathValue("workspace_id")
	if workspaceID == "" {
		workspaceID = r.URL.Query().Get("ws")
	}
	if workspaceID == "" {
		workspaceID = "default"
	}

	sourceID := r.PathValue("collection_name")
	if sourceID == "" {
		sourceID = r.URL.Query().Get("source_id")
	}
	if sourceID == "" {
		sourceID = "http-ingest"
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	logs, err := decodeIngestPayload(body)
	if err != nil {
		http.Error(w, "Invalid JSON format", http.StatusBadRequest)
		return
	}

	// Routing logic for HTTP: explicit workspace_id in the URL path takes
	// precedence over stream-cache lookup; only "default" (no explicit
	// workspace) consults `log_streams`.
	var targets []db.LogStreamConfig
	if workspaceID == "default" {
		httpPort := s.currentHTTPPort()
		s.streamsMu.Lock()
		for _, st := range s.streams {
			if st.Type == "http" && st.Port == httpPort {
				targets = append(targets, st)
			}
		}
		s.streamsMu.Unlock()
		if len(targets) == 0 {
			targets = []db.LogStreamConfig{{WorkspaceID: "default", Name: sourceID}}
		}
	} else {
		targets = []db.LogStreamConfig{{WorkspaceID: workspaceID, Name: sourceID}}
	}

	for _, target := range targets {
		for _, logEntry := range logs {
			m := make(map[string]any, len(logEntry)+2)
			for k, v := range logEntry {
				m[k] = v
			}
			m["workspace_id"] = target.WorkspaceID
			if workspaceID != "default" {
				m["source_id"] = sourceID
			} else {
				m["source_id"] = target.Name
			}
			if _, ok := m["raw_text"]; !ok {
				if msg, ok2 := m["message"]; ok2 {
					m["raw_text"] = msg
				}
			}
			s.queue.push(entryFromMap(m))
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"status": "ok", "count": len(logs)})
}

// decodeIngestPayload accepts either a single JSON object or an array of
// objects, matching ingestion.py's
// `logs = [data] if isinstance(data, dict) else data if isinstance(data, list) else <400>`.
func decodeIngestPayload(body []byte) ([]map[string]any, error) {
	var asArray []map[string]any
	if err := json.Unmarshal(body, &asArray); err == nil {
		return asArray, nil
	}
	var asObject map[string]any
	if err := json.Unmarshal(body, &asObject); err == nil {
		return []map[string]any{asObject}, nil
	}
	return nil, fmt.Errorf("ingestion: invalid JSON payload")
}

// entryFromMap extracts the fixed IngestEntry fields from a loosely-typed
// decoded JSON object, ignoring any other keys the client sent.
func entryFromMap(m map[string]any) IngestEntry {
	e := IngestEntry{}
	if v, ok := m["workspace_id"].(string); ok {
		e.WorkspaceID = v
	}
	if v, ok := m["source_id"].(string); ok {
		e.SourceID = v
	}
	if v, ok := m["raw_text"].(string); ok {
		e.RawText = v
	}
	if v, ok := m["timestamp"].(string); ok {
		e.Timestamp = v
	}
	if v, ok := m["level"].(string); ok {
		e.Level = v
	}
	return e
}
