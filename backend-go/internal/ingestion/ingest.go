package ingestion

import (
	"encoding/json"
	"fmt"
	"time"

	"loglensai/backend-go/internal/db"
	"loglensai/backend-go/internal/metadata"
	"loglensai/backend-go/internal/services/logstore"
)

// IngestEntry is one log line submitted through the syslog/HTTP listeners
// (listeners.go), mirroring the fields of models.py's IngestLogEntry /
// internal/models.IngestLogEntry that this port's seam actually needs.
type IngestEntry struct {
	WorkspaceID string
	SourceID    string
	RawText     string
	Timestamp   string            // optional; "" lets metadata extraction derive one.
	Level       string            // optional; "" lets metadata extraction derive one.
	Facets      map[string]string // optional extra facets (e.g. syslog's source_ip).
}

// BatchIngester is the seam this package's listeners flush into. The real
// `ingest_logs` RPC handler (method_ingest_logs in api.py) is expected to be
// wired up to satisfy this interface in a later migration phase — see
// DBBatchIngester below for a working implementation used until then.
type BatchIngester interface {
	IngestBatch(entries []IngestEntry) error
}

// DBBatchIngester is a straightforward BatchIngester: write raw text via
// DiskLogStore, extract metadata via internal/metadata, and insert into
// `logs` with cluster_id=NULL/processed=FALSE for the clustering worker to
// pick up — the same shape FileTailer's flush uses (tailer.go), not the
// full RAM-first/PyArrow + inline-clustering pipeline
// api.py's method_ingest_logs implements. It exists so the syslog/HTTP
// listeners have somewhere real to flush into; a later phase can either
// keep using this directly or swap in a richer implementation of
// BatchIngester without listeners.go needing to change.
type DBBatchIngester struct {
	db       *db.DB
	logStore *logstore.DiskLogStore
}

// NewDBBatchIngester builds a DBBatchIngester over database and logStore.
func NewDBBatchIngester(database *db.DB, logStore *logstore.DiskLogStore) *DBBatchIngester {
	return &DBBatchIngester{db: database, logStore: logStore}
}

// IngestBatch groups entries by (workspace_id, source_id) — defaulting
// missing values to "default"/"manual" as models.py's IngestLogEntry does —
// appends each group's raw text to DiskLogStore in one call (so line_ids
// stay contiguous per source), extracts metadata per line, and inserts
// everything in one InsertLogBatch transaction. Mirrors the grouping in
// method_ingest_logs / _ingest_source_logs_batch (api.py:1639-1666),
// without that method's inline drain-clustering step.
func (b *DBBatchIngester) IngestBatch(entries []IngestEntry) error {
	if len(entries) == 0 {
		return nil
	}

	type groupKey struct{ workspaceID, sourceID string }
	order := make([]groupKey, 0)
	groups := make(map[groupKey][]IngestEntry)

	for _, e := range entries {
		ws := e.WorkspaceID
		if ws == "" {
			ws = "default"
		}
		src := e.SourceID
		if src == "" {
			src = "manual"
		}
		k := groupKey{ws, src}
		if _, ok := groups[k]; !ok {
			order = append(order, k)
		}
		e.WorkspaceID, e.SourceID = ws, src
		groups[k] = append(groups[k], e)
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	var rows []db.LogInsertRow

	for _, k := range order {
		group := groups[k]
		raws := make([]string, len(group))
		for i, e := range group {
			raws[i] = e.RawText
		}

		lineIDs, err := b.logStore.AppendBatch(k.sourceID, raws)
		if err != nil {
			return fmt.Errorf("ingestion: appending batch for %s/%s: %w", k.workspaceID, k.sourceID, err)
		}

		for i, e := range group {
			md := metadata.ExtractLogMetadata(e.RawText, nil, nil, 0)

			timestamp := md.Timestamp
			if e.Timestamp != "" {
				timestamp = e.Timestamp
			}
			level := md.Level
			if e.Level != "" {
				level = e.Level
			}

			facets := md.Facets
			if len(e.Facets) > 0 {
				merged := make(map[string]string, len(facets)+len(e.Facets))
				for k, v := range facets {
					merged[k] = v
				}
				for k, v := range e.Facets {
					merged[k] = v
				}
				facets = merged
			}

			var facetsJSON *string
			if len(facets) > 0 {
				if enc, err := json.Marshal(facets); err == nil {
					s := string(enc)
					facetsJSON = &s
				}
			}

			rows = append(rows, db.LogInsertRow{
				WorkspaceID:     k.workspaceID,
				SourceID:        k.sourceID,
				LineID:          lineIDs[i],
				RawText:         e.RawText,
				Timestamp:       timestamp,
				IngestTimestamp: now,
				Level:           level,
				FacetsJSON:      facetsJSON,
			})
		}
	}

	return b.db.InsertLogBatch(rows)
}
