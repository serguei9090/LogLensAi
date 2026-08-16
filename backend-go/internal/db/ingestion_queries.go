package db

import (
	"database/sql"
	"fmt"
)

// This file adds query/insert helpers used only by the ingestion subsystem
// (internal/ingestion — FileTailer, SSHLoader, the syslog/HTTP listeners),
// ported from the raw SQL embedded in sidecar/src/tailer.py, ssh_loader.py,
// and ingestion.py. Like clustering_queries.go, it is intentionally kept
// separate from schema.go/migrations.go/settings.go (Phase 1 files this
// migration was told not to modify) — nothing here changes schema, it only
// reads/writes rows.

// LogStreamConfig mirrors one row of `log_streams` used for ingestion
// routing (ingestion.py's `self._streams_cache` entries: {workspace_id,
// name, type, port}).
type LogStreamConfig struct {
	WorkspaceID string
	Name        string
	Type        string
	Port        int
}

// ActiveLogStreams fetches every enabled routing rule, mirroring
// IngestionServer.refresh_streams's
// `SELECT workspace_id, name, type, port FROM log_streams WHERE enabled = 1`
// (ingestion.py:110-123).
func (d *DB) ActiveLogStreams() ([]LogStreamConfig, error) {
	rows, err := d.Conn.Query(`SELECT workspace_id, name, type, port FROM log_streams WHERE enabled = 1`)
	if err != nil {
		return nil, fmt.Errorf("ingestion: querying active log streams: %w", err)
	}
	defer rows.Close()

	var out []LogStreamConfig
	for rows.Next() {
		var s LogStreamConfig
		var port sql.NullInt64
		if err := rows.Scan(&s.WorkspaceID, &s.Name, &s.Type, &port); err != nil {
			return nil, fmt.Errorf("ingestion: scanning log stream row: %w", err)
		}
		s.Port = int(port.Int64)
		out = append(out, s)
	}
	return out, rows.Err()
}

// FusionParserConfig fetches the per-(workspace, source) parser_config JSON
// text and tz_offset, mirroring the
// `SELECT parser_config, tz_offset FROM fusion_configs WHERE workspace_id = ?
// AND source_id = ?` query used by both FileTailer._get_parser_config
// (tailer.py:158-185) and api.py's _ingest_source_logs_batch. Returns
// ("", 0, nil) if no row exists, matching Python's `config = {}; tz_offset =
// 0.0` fallback.
func (d *DB) FusionParserConfig(workspaceID, sourceID string) (parserConfigJSON string, tzOffset float64, err error) {
	var cfg sql.NullString
	var tz sql.NullInt64
	row := d.Conn.QueryRow(
		`SELECT parser_config, tz_offset FROM fusion_configs WHERE workspace_id = ? AND source_id = ?`,
		workspaceID, sourceID,
	)
	if scanErr := row.Scan(&cfg, &tz); scanErr != nil {
		if scanErr == sql.ErrNoRows {
			return "", 0, nil
		}
		return "", 0, fmt.Errorf("ingestion: querying fusion_configs for %s/%s: %w", workspaceID, sourceID, scanErr)
	}
	return cfg.String, float64(tz.Int64), nil
}

// FacetExtractionRulesJSON fetches the raw JSON text of the global
// (`settings.facet_extractions`) and workspace-specific
// (`workspace_settings` where key='facet_extractions') facet rule lists,
// mirroring FileTailer._get_rules (tailer.py:187-221) and
// LogLensBackend._get_global_rules (api.py:1564-1571). Either return value
// may be "" if no row/value is set.
func (d *DB) FacetExtractionRulesJSON(workspaceID string) (globalJSON, workspaceJSON string, err error) {
	var global sql.NullString
	globalErr := d.Conn.QueryRow(`SELECT value FROM settings WHERE key = 'facet_extractions'`).Scan(&global)
	if globalErr != nil && globalErr != sql.ErrNoRows {
		return "", "", fmt.Errorf("ingestion: querying global facet_extractions: %w", globalErr)
	}

	var ws sql.NullString
	wsErr := d.Conn.QueryRow(
		`SELECT value FROM workspace_settings WHERE workspace_id = ? AND key = 'facet_extractions'`,
		workspaceID,
	).Scan(&ws)
	if wsErr != nil && wsErr != sql.ErrNoRows {
		return "", "", fmt.Errorf("ingestion: querying workspace facet_extractions for %s: %w", workspaceID, wsErr)
	}

	return global.String, ws.String, nil
}

// LogInsertRow is one row of a batched insert into `logs`, always written
// with cluster_id=NULL and processed=FALSE so the clustering worker
// (internal/services/clustering) picks it up later — mirrors the shape
// FileTailer._flush_batch (tailer.py:131-146) inserts.
type LogInsertRow struct {
	WorkspaceID     string
	SourceID        string
	LineID          int64
	RawText         string
	Timestamp       string
	IngestTimestamp string
	Level           string
	FacetsJSON      *string // nil => SQL NULL, matching `facets_json = json.dumps(facets) if facets else None`
}

// InsertLogBatch inserts rows into `logs` inside a single transaction,
// mirroring FileTailer._flush_batch's
// `INSERT INTO logs (workspace_id, source_id, line_id, raw_text, timestamp,
// ingest_timestamp, level, cluster_id, facets, processed) VALUES (?, ?, ?,
// ?, ?, ?, ?, NULL, ?, FALSE)` executemany (tailer.py:131-146). Also used by
// the ingestion listeners' DBBatchIngester (internal/ingestion/ingest.go).
func (d *DB) InsertLogBatch(rows []LogInsertRow) error {
	if len(rows) == 0 {
		return nil
	}

	tx, err := d.Conn.Begin()
	if err != nil {
		return fmt.Errorf("ingestion: begin log batch tx: %w", err)
	}
	defer tx.Rollback() //nolint:errcheck // no-op once committed

	stmt, err := tx.Prepare(`
		INSERT INTO logs (workspace_id, source_id, line_id, raw_text, timestamp, ingest_timestamp, level, cluster_id, facets, processed)
		VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, FALSE)
	`)
	if err != nil {
		return fmt.Errorf("ingestion: preparing log batch insert: %w", err)
	}
	defer stmt.Close()

	for _, r := range rows {
		if _, err := stmt.Exec(r.WorkspaceID, r.SourceID, r.LineID, r.RawText, r.Timestamp, r.IngestTimestamp, r.Level, r.FacetsJSON); err != nil {
			return fmt.Errorf("ingestion: inserting log row (source=%s, line_id=%d): %w", r.SourceID, r.LineID, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("ingestion: commit log batch: %w", err)
	}
	return nil
}
