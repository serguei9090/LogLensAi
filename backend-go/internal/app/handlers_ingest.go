package app

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"loglensai/backend-go/internal/db"
	"loglensai/backend-go/internal/metadata"
	"loglensai/backend-go/internal/models"
)

// ingestChunkSize bounds how many entries are batched per LogStore.AppendBatch
// + DB.InsertLogBatch call during a local-file ingest, keeping memory bounded
// for large files. api.py uses an adaptive 5000->10000 chunking scheme
// (_read_file_chunks); this port uses one fixed size, which is simpler and
// sufficient for the core-subset wiring this phase targets.
const ingestChunkSize = 2000

// Architecture note (see internal/services/clustering's package doc comment
// for the full rationale): unlike api.py's method_ingest_logs /
// method_ingest_local_file, which run Drain3 training/tagging SYNCHRONOUSLY
// at ingest time (RAM-first, PyArrow bulk insert with cluster_id already
// resolved), every ingest path in this Go port inserts rows with
// cluster_id=NULL, processed=FALSE and leaves clustering entirely to the
// async clustering.Worker — exactly like internal/ingestion's FileTailer
// already does for live tailing. This is a deliberate, load-bearing
// architectural difference: it means immediately after an ingest_logs /
// ingest_local_file call returns, get_logs rows will have no cluster_id yet
// and get_clustering_status will show a nonzero backlog until the worker
// catches up. Callers (including the golden-file comparison harness, see
// cmd/goldentest) must poll get_clustering_status until backlog reaches 0
// before comparing clustering-derived output against the Python sidecar,
// which has none of this lag (its clustering is already done by the time
// the RPC call returns).

// IngestLogs implements the ingest_logs RPC method, mirroring api.py's
// App.method_ingest_logs (streaming/HTTP/syslog batch path): groups entries
// by (workspace_id, source_id), writes raw lines to the disk-first log
// store, extracts timestamp/level/facets metadata, and inserts unprocessed
// rows for the clustering worker to pick up (see the architecture note
// above for why this diverges from Python's synchronous-at-ingest
// clustering).
func (a *App) IngestLogs(req models.IngestLogsRequest) (any, *models.RPCError) {
	if len(req.Logs) == 0 {
		return map[string]any{"status": "ok", "count": 0}, nil
	}

	type groupKey struct{ ws, src string }
	grouped := make(map[groupKey][]models.IngestLogEntry)
	var order []groupKey
	for _, e := range req.Logs {
		ws := e.WorkspaceID
		if ws == "" {
			ws = "default"
		}
		src := e.SourceID
		if src == "" {
			src = "manual"
		}
		k := groupKey{ws, src}
		if _, ok := grouped[k]; !ok {
			order = append(order, k)
		}
		grouped[k] = append(grouped[k], e)
	}

	nowTS := time.Now().Format("2006-01-02 15:04:05")

	for _, k := range order {
		entries := grouped[k]
		rawLines := make([]string, len(entries))
		for i, e := range entries {
			text := e.RawText
			if text == "" && e.Message != nil {
				text = *e.Message
			}
			rawLines[i] = text
		}

		lineIDs, err := a.LogStore.AppendBatch(k.src, rawLines)
		if err != nil {
			log.Printf("[App] ingest_logs: append_batch failed for %s/%s: %v", k.ws, k.src, err)
			continue
		}

		rules := a.getFacetRules(k.ws)
		cfg, tz := a.getParserConfig(k.ws, k.src)

		rows := make([]db.LogInsertRow, len(entries))
		for i, e := range entries {
			md := metadata.ExtractLogMetadata(rawLines[i], rules, cfg, tz)

			ts := md.Timestamp
			if e.Timestamp != nil && *e.Timestamp != "" {
				ts = *e.Timestamp
			}
			level := md.Level
			if e.Level != "" {
				level = e.Level
			}

			rows[i] = db.LogInsertRow{
				WorkspaceID:     k.ws,
				SourceID:        k.src,
				LineID:          lineIDs[i],
				RawText:         rawLines[i],
				Timestamp:       ts,
				IngestTimestamp: nowTS,
				Level:           level,
				FacetsJSON:      facetsJSONPtr(md.Facets),
			}
		}

		if err := a.DB.InsertLogBatch(rows); err != nil {
			log.Printf("[App] ingest_logs: insert failed for %s/%s: %v", k.ws, k.src, err)
			continue
		}

		a.Shared.GetSource(k.src, "").PushBatch(rawLines, lineIDs)
	}

	return map[string]any{"status": "ok", "count": len(req.Logs)}, nil
}

// IngestLocalFile implements the ingest_local_file RPC method, mirroring
// api.py's App.method_ingest_local_file + its background worker
// (_bg_ingest_local_file): reads filepath, groups continuation lines into
// multiline entries, writes them to the disk-first log store, extracts
// metadata, and bulk-inserts unprocessed rows in ingestChunkSize batches.
//
// Simplification versus Python: this runs synchronously on the calling
// goroutine and returns once ingestion is complete, rather than enqueuing a
// job on a serial background-worker queue and returning immediately with a
// job_id to poll (api.py's ingestion_jobs table + _ingestion_queue_worker
// thread). No ingestion_jobs row is created. The response still includes a
// job_id field (always 0) for shape compatibility with callers expecting
// it, but polling get_ingestion_jobs will not reflect this call's progress
// — a documented parity gap for this core-subset wiring pass.
func (a *App) IngestLocalFile(req models.IngestLocalFileRequest) (any, *models.RPCError) {
	if _, err := os.Stat(req.Filepath); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: fmt.Sprintf("File not found: %s", req.Filepath)}
	}

	if a.sourceIsUploaded(req.SourceID) {
		return map[string]any{"status": "completed", "job_id": 0, "total_lines": 0, "queue_position": 0}, nil
	}

	if err := a.deleteLogs(req.WorkspaceID, req.SourceID); err != nil {
		log.Printf("[App] ingest_local_file: delete_logs failed for %s/%s: %v", req.WorkspaceID, req.SourceID, err)
	}

	entries, err := readLogEntries(req.Filepath)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	if len(entries) == 0 {
		return map[string]any{"status": "ok", "count": 0, "job_id": nil}, nil
	}

	rules := a.getFacetRules(req.WorkspaceID)
	cfg, tz := a.getParserConfig(req.WorkspaceID, req.SourceID)
	nowTS := time.Now().Format("2006-01-02 15:04:05")

	processed := 0
	for start := 0; start < len(entries); start += ingestChunkSize {
		end := start + ingestChunkSize
		if end > len(entries) {
			end = len(entries)
		}
		chunk := entries[start:end]

		lineIDs, err := a.LogStore.AppendBatch(req.SourceID, chunk)
		if err != nil {
			return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
		}

		rows := make([]db.LogInsertRow, len(chunk))
		for i, line := range chunk {
			md := metadata.ExtractLogMetadata(line, rules, cfg, tz)
			rows[i] = db.LogInsertRow{
				WorkspaceID:     req.WorkspaceID,
				SourceID:        req.SourceID,
				LineID:          lineIDs[i],
				RawText:         line,
				Timestamp:       md.Timestamp,
				IngestTimestamp: nowTS,
				Level:           md.Level,
				FacetsJSON:      facetsJSONPtr(md.Facets),
			}
		}

		if err := a.DB.InsertLogBatch(rows); err != nil {
			return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
		}
		processed += len(chunk)

		a.Shared.GetSource(req.SourceID, "").PushBatch(chunk, lineIDs)
	}

	return map[string]any{
		"status":      "completed",
		"job_id":      0,
		"total_lines": len(entries),
		"count":       processed,
	}, nil
}

func facetsJSONPtr(facets map[string]string) *string {
	if len(facets) == 0 {
		return nil
	}
	b, err := json.Marshal(facets)
	if err != nil {
		return nil
	}
	s := string(b)
	return &s
}

// readLogEntries reads path and groups continuation lines (any line not
// starting a new header, per metadata.IsNewLogHeader) into multiline
// entries joined by "\n", mirroring api.py's App._read_file_chunks (minus
// its chunk-yielding — this returns every entry at once, since the core
// subset this phase wires doesn't need streaming/adaptive chunk sizing).
func readLogEntries(path string) ([]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	reader := bufio.NewReaderSize(f, 1<<20)
	var entries []string
	var current []string

	for {
		raw, readErr := reader.ReadString('\n')
		line := trimCRLF(raw)
		if line != "" {
			if metadata.IsNewLogHeader(line) {
				if len(current) > 0 {
					entries = append(entries, joinLines(current))
					current = current[:0]
				}
				current = append(current, line)
			} else {
				current = append(current, line)
			}
		}
		if readErr != nil {
			break
		}
	}
	if len(current) > 0 {
		entries = append(entries, joinLines(current))
	}
	return entries, nil
}

func trimCRLF(s string) string {
	for len(s) > 0 && (s[len(s)-1] == '\n' || s[len(s)-1] == '\r') {
		s = s[:len(s)-1]
	}
	return s
}

func joinLines(lines []string) string {
	out := lines[0]
	for _, l := range lines[1:] {
		out += "\n" + l
	}
	return out
}
