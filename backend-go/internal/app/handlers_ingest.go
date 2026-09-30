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
// + DB.InsertLogBatch call during a local-file ingest. With the DuckDB Appender,
// 20,000 entries per batch delivers optimal 200k-500k rows/sec throughput while
// keeping RAM bounded.
const ingestChunkSize = 20000

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
// IngestLocalFile implements the ingest_local_file RPC method.
// It canonicalizes the filepath, tracks progress in the ingestion_jobs table,
// streams lines in bounded chunks (ingestChunkSize = 20,000) directly into the
// LogStore and DuckDB Appender (keeping RAM bounded even on 700MB+ logs),
// updates ingestion_jobs with real progress, and sets status='completed'.
func (a *App) IngestLocalFile(req models.IngestLocalFileRequest) (any, *models.RPCError) {
	cleanPath := normalizeAbsPath(req.Filepath)
	if _, err := os.Stat(cleanPath); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: fmt.Sprintf("File not found: %s", cleanPath)}
	}

	if a.sourceIsUploaded(req.SourceID) {
		return map[string]any{"status": "completed", "job_id": 0, "total_lines": 0, "queue_position": 0}, nil
	}

	if err := a.deleteLogs(req.WorkspaceID, req.SourceID); err != nil {
		log.Printf("[App] ingest_local_file: delete_logs failed for %s/%s: %v", req.WorkspaceID, req.SourceID, err)
	}

	// Insert active job into ingestion_jobs
	var jobID int64
	err := a.DB.Conn.QueryRow(
		`INSERT INTO ingestion_jobs (workspace_id, source_id, status, total_lines, processed_lines)
		 VALUES (?, ?, 'processing', 0, 0) RETURNING id`,
		req.WorkspaceID, req.SourceID,
	).Scan(&jobID)
	if err != nil {
		log.Printf("[App] ingest_local_file: failed to insert job into ingestion_jobs: %v", err)
	}

	rules := a.getFacetRules(req.WorkspaceID)
	cfg, tz := a.getParserConfig(req.WorkspaceID, req.SourceID)
	nowTS := time.Now().Format("2006-01-02 15:04:05")

	processed := 0
	totalEntries, streamErr := streamLogChunks(cleanPath, ingestChunkSize, func(chunk []string) error {
		lineIDs, err := a.LogStore.AppendBatch(req.SourceID, chunk)
		if err != nil {
			return err
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
			return err
		}
		processed += len(chunk)

		a.Shared.GetSource(req.SourceID, "").PushBatch(chunk, lineIDs)

		if jobID > 0 {
			_, _ = a.DB.Conn.Exec(
				`UPDATE ingestion_jobs SET processed_lines = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
				processed, jobID,
			)
		}
		return nil
	})

	if streamErr != nil {
		if jobID > 0 {
			_, _ = a.DB.Conn.Exec(
				`UPDATE ingestion_jobs SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
				jobID,
			)
		}
		return nil, &models.RPCError{Code: errInternal, Message: streamErr.Error()}
	}

	if _, err := a.DB.Conn.Exec(`UPDATE log_sources SET is_uploaded = TRUE WHERE id = ?`, req.SourceID); err != nil {
		log.Printf("[App] ingest_local_file: failed to set is_uploaded for %s: %v", req.SourceID, err)
	}

	if jobID > 0 {
		_, _ = a.DB.Conn.Exec(
			`UPDATE ingestion_jobs SET status = 'completed', total_lines = ?, processed_lines = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
			totalEntries, totalEntries, jobID,
		)
	}

	return map[string]any{
		"status":      "completed",
		"job_id":      jobID,
		"total_lines": totalEntries,
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

// streamLogChunks reads path and streams multiline log entries in bounded chunks
// to onChunk without holding the entire file in RAM. Memory is strictly bounded
// to chunkSize entries.
func streamLogChunks(path string, chunkSize int, onChunk func(chunk []string) error) (int, error) {
	f, err := os.Open(path)
	if err != nil {
		return 0, err
	}
	defer f.Close()

	reader := bufio.NewReaderSize(f, 1<<20)
	var chunk []string
	var current []string
	totalCount := 0

	flushEntry := func() error {
		if len(current) == 0 {
			return nil
		}
		chunk = append(chunk, joinLines(current))
		current = current[:0]
		totalCount++
		if len(chunk) >= chunkSize {
			if err := onChunk(chunk); err != nil {
				return err
			}
			chunk = chunk[:0]
		}
		return nil
	}

	for {
		raw, readErr := reader.ReadString('\n')
		line := trimCRLF(raw)
		if line != "" {
			if metadata.IsNewLogHeader(line) {
				if err := flushEntry(); err != nil {
					return totalCount, err
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

	if err := flushEntry(); err != nil {
		return totalCount, err
	}
	if len(chunk) > 0 {
		if err := onChunk(chunk); err != nil {
			return totalCount, err
		}
	}

	return totalCount, nil
}

// readLogEntries provides full-slice reading using streamLogChunks for testing and callers
// that specifically request all entries.
func readLogEntries(path string) ([]string, error) {
	var entries []string
	_, err := streamLogChunks(path, 10000, func(chunk []string) error {
		entries = append(entries, chunk...)
		return nil
	})
	return entries, err
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
