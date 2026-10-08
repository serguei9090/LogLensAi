package app

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"loglensai/backend-go/internal/ingestion"
	"loglensai/backend-go/internal/models"
)

// --- start_ssh_tail ---

var (
	sshIngestorsMu sync.Mutex
	sshIngestors   = make(map[*App]map[string]*ingestion.SSHLoader)
)

func (a *App) registerSSHIngestor(key string, loader *ingestion.SSHLoader) {
	sshIngestorsMu.Lock()
	defer sshIngestorsMu.Unlock()
	m, ok := sshIngestors[a]
	if !ok {
		m = make(map[string]*ingestion.SSHLoader)
		sshIngestors[a] = m
	}
	m[key] = loader
}

func (a *App) sshIngestor(key string) (*ingestion.SSHLoader, bool) {
	sshIngestorsMu.Lock()
	defer sshIngestorsMu.Unlock()
	m, ok := sshIngestors[a]
	if !ok {
		return nil, false
	}
	l, ok := m[key]
	return l, ok
}

// StartSSHTail implements the start_ssh_tail RPC method, mirroring api.py's
// App.method_start_ssh_tail.
func (a *App) StartSSHTail(req models.StartSSHTailRequest) (any, *models.RPCError) {
	effWorkspaceID := req.WorkspaceID
	if effWorkspaceID == "" {
		effWorkspaceID = "default"
	}
	effFilepath := req.Filepath

	effSourceID := ""
	if req.SourceID != nil {
		effSourceID = *req.SourceID
	}
	if effSourceID == "" {
		effSourceID = fmt.Sprintf("ssh:%s:%s:%s", effWorkspaceID, req.Host, effFilepath)
	}

	key := effSourceID
	a.tailersMu.Lock()
	_, exists := a.tailers[key]
	a.tailersMu.Unlock()
	if exists {
		return map[string]any{"status": "already tailing"}, nil
	}

	port := req.Port
	if port == 0 {
		port = 22
	}
	password := ""
	if req.Password != nil {
		password = *req.Password
	}

	ingestorKey := "ingestor:ssh:" + effSourceID
	if _, ok := a.sshIngestor(ingestorKey); !ok {
		loader := ingestion.NewSSHLoader(req.Host, port, req.Username, password, effFilepath, effSourceID, a.Shared)
		a.registerSSHIngestor(ingestorKey, loader)
		loader.Start()
	}

	subscriber := ingestion.NewFileTailer(effFilepath, effWorkspaceID, a.DB, a.Shared, effSourceID)
	a.tailersMu.Lock()
	a.tailers[key] = subscriber
	a.tailersMu.Unlock()
	subscriber.Start()

	return map[string]any{"status": "started", "source_id": effSourceID}, nil
}

// --- log_trace ---

var traceFileMu sync.Mutex

// LogTrace implements the log_trace RPC method, mirroring api.py's
// App.method_log_trace / trace_ingestion_event.
func (a *App) LogTrace(req models.LogTraceRequest) (any, *models.RPCError) {
	if os.Getenv("INGESTION_TRACE") == "true" {
		traceFileMu.Lock()
		defer traceFileMu.Unlock()

		logDir := filepath.Join(filepath.Dir(a.dataDir), "logs")
		if err := os.MkdirAll(logDir, 0o755); err == nil {
			logPath := filepath.Join(logDir, "ingestion_trace.log")
			ts := time.Now().Format("2006-01-02 15:04:05.000")
			line := fmt.Sprintf("[%s] [Backend] [Frontend] %s\n", ts, req.Message)
			if f, openErr := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644); openErr == nil {
				_, _ = f.WriteString(line)
				_ = f.Close()
			}
		}
	}
	return map[string]any{"status": "success"}, nil
}

// --- cleanup_ingestion_jobs / get_ingestion_jobs ---

// CleanupIngestionJobs implements the cleanup_ingestion_jobs RPC method,
// mirroring api.py's App.method_cleanup_ingestion_jobs.
func (a *App) CleanupIngestionJobs(req models.CleanupIngestionJobsRequest) (any, *models.RPCError) {
	cutoff := time.Now().Add(-30 * time.Minute).Format("2006-01-02 15:04:05")
	res, err := a.DB.Conn.Exec(
		`DELETE FROM ingestion_jobs WHERE workspace_id = ? AND processed_lines = 0 AND (status = 'failed' OR created_at < CAST(? AS TIMESTAMP))`,
		req.WorkspaceID, cutoff,
	)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	count, _ := res.RowsAffected()
	return map[string]any{"status": "success", "purged_count": count}, nil
}

// pyIsoFormat mirrors Python's datetime.isoformat(): "YYYY-MM-DDTHH:MM:SS".
func pyIsoFormat(t time.Time) string {
	base := t.Format("2006-01-02T15:04:05")
	if t.Nanosecond() == 0 {
		return base
	}
	return fmt.Sprintf("%s.%06d", base, t.Nanosecond()/1000)
}

// GetIngestionJobs implements the get_ingestion_jobs RPC method, mirroring
// db.py's LogDatabase.get_ingestion_jobs.
func (a *App) GetIngestionJobs(req models.GetIngestionJobsRequest) (any, *models.RPCError) {
	var rows *sql.Rows
	var err error
	if req.WorkspaceID != nil && *req.WorkspaceID != "" {
		rows, err = a.DB.Conn.Query(
			`SELECT id, workspace_id, source_id, status, total_lines, processed_lines, created_at, updated_at
			 FROM ingestion_jobs WHERE workspace_id = ? ORDER BY created_at DESC`,
			*req.WorkspaceID,
		)
	} else {
		rows, err = a.DB.Conn.Query(
			`SELECT id, workspace_id, source_id, status, total_lines, processed_lines, created_at, updated_at
			 FROM ingestion_jobs ORDER BY created_at DESC LIMIT 50`,
		)
	}
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	defer rows.Close()

	type ingestionJob struct {
		id                         int64
		workspaceID, sourceID      string
		status                     string
		totalLines, processedLines int64
		createdAt, updatedAt       sql.NullTime
	}
	var jobs []ingestionJob
	for rows.Next() {
		var j ingestionJob
		if scanErr := rows.Scan(&j.id, &j.workspaceID, &j.sourceID, &j.status, &j.totalLines, &j.processedLines, &j.createdAt, &j.updatedAt); scanErr != nil {
			continue
		}
		jobs = append(jobs, j)
	}

	type activeEntry struct {
		idx       int
		createdAt time.Time
		id        int64
	}
	activeByWS := map[string][]activeEntry{}
	for i, j := range jobs {
		if j.status == "queued" || j.status == "processing" || j.status == "pending" {
			activeByWS[j.workspaceID] = append(activeByWS[j.workspaceID], activeEntry{idx: i, createdAt: j.createdAt.Time, id: j.id})
		}
	}
	queuePos := make(map[int]int, len(jobs))
	for _, entries := range activeByWS {
		sort.Slice(entries, func(x, y int) bool {
			if entries[x].createdAt.Equal(entries[y].createdAt) {
				return entries[x].id < entries[y].id
			}
			return entries[x].createdAt.Before(entries[y].createdAt)
		})
		for pos, e := range entries {
			queuePos[e.idx] = pos + 1
		}
	}

	result := make([]map[string]any, len(jobs))
	for i, j := range jobs {
		m := map[string]any{
			"id": j.id, "workspace_id": j.workspaceID, "source_id": j.sourceID,
			"status": j.status, "total_lines": j.totalLines, "processed_lines": j.processedLines,
			"queue_position": queuePos[i],
		}
		if j.createdAt.Valid {
			m["created_at"] = pyIsoFormat(j.createdAt.Time)
		} else {
			m["created_at"] = nil
		}
		if j.updatedAt.Valid {
			m["updated_at"] = pyIsoFormat(j.updatedAt.Time)
		} else {
			m["updated_at"] = nil
		}
		result[i] = m
	}
	return result, nil
}
