package db

import (
	"database/sql"
	"fmt"
	"log"
	"strings"
)

// This file adds query helpers used only by the clustering worker
// (internal/services/clustering), ported from the raw SQL embedded in
// sidecar/src/workers/clustering.py. It is intentionally kept separate from
// schema.go/migrations.go/settings.go (Phase 1 files this task was told not
// to modify) — nothing here changes schema, it only reads/writes rows.

// UnprocessedLog mirrors one row of clustering.py's
// `SELECT id, workspace_id, source_id, line_id, facets, raw_text FROM logs
// WHERE processed = FALSE ORDER BY id ASC LIMIT ?`
// (clustering.py:266-276, ClusteringWorker._select_unprocessed_logs).
type UnprocessedLog struct {
	ID          int64
	WorkspaceID string
	SourceID    string
	LineID      sql.NullInt64
	FacetsJSON  sql.NullString
	RawText     sql.NullString
}

// SelectUnprocessedLogs fetches up to limit unprocessed log rows, oldest
// first. Mirrors ClusteringWorker._select_unprocessed_logs, including its
// specific tolerance for querying a not-yet-created `logs` table (returns
// an empty result instead of erroring, matching Python's string-matched
// "Table with name logs does not exist" special case).
func (d *DB) SelectUnprocessedLogs(limit int) ([]UnprocessedLog, error) {
	// facets is cast to VARCHAR explicitly: the go-duckdb driver
	// auto-decodes JSON-typed columns into native Go values
	// (map[string]interface{}/[]interface{}) rather than handing back raw
	// text, which sql.NullString.Scan cannot accept ("unsupported Scan,
	// storing driver.Value type map[string]interface {} into type
	// *string") — confirmed empirically against a live ingest+cluster run.
	// Casting in SQL keeps the Go-side type (sql.NullString) simple and
	// matches what every consumer of UnprocessedLog.FacetsJSON already
	// expects (raw JSON text, subsequently json.Unmarshal'd).
	rows, err := d.Conn.Query(
		`SELECT id, workspace_id, source_id, line_id, CAST(facets AS VARCHAR), raw_text
		 FROM logs WHERE processed = FALSE ORDER BY id ASC LIMIT ?`,
		limit,
	)
	if err != nil {
		if strings.Contains(err.Error(), "Table with name logs does not exist") {
			return nil, nil
		}
		return nil, err
	}
	defer rows.Close()

	var out []UnprocessedLog
	for rows.Next() {
		var u UnprocessedLog
		if err := rows.Scan(&u.ID, &u.WorkspaceID, &u.SourceID, &u.LineID, &u.FacetsJSON, &u.RawText); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

// CountUnprocessedLogs returns the current backlog size, for
// clustering.Worker.GetStatus (mirrors ClusteringWorker.get_status,
// clustering.py:959-971).
func (d *DB) CountUnprocessedLogs() (int, error) {
	var n int
	err := d.Conn.QueryRow(`SELECT COUNT(*) FROM logs WHERE processed = FALSE`).Scan(&n)
	if err != nil && strings.Contains(err.Error(), "Table with name logs does not exist") {
		return 0, nil
	}
	return n, err
}

// LogUpdate is one row of the batched (timestamp, level, facets,
// cluster_id, log_id) tuple clustering.py accumulates into its `updates`
// list (e.g. clustering.py:335-343, 391-399) before applying them all in
// one vectorized UPDATE via a temp table (clustering.py:756-775).
type LogUpdate struct {
	Timestamp  sql.NullString
	Level      sql.NullString
	FacetsJSON string
	ClusterID  sql.NullString
	LogID      int64
}

// ClusterIncrement is one (workspace, cluster, template) => count delta,
// mirroring clustering.py's `cluster_increments` dict keyed by
// (ws_id, cluster_id, template) (e.g. clustering.py:333-334).
type ClusterIncrement struct {
	WorkspaceID string
	ClusterID   string
	Template    string
	Count       int
}

// logsIndexes mirrors the `logs`-table entries of schema.go's
// indexStatements (idx_logs_workspace_id/source_id/timestamp/cluster_id/
// processed) — everything ApplyClusteringBatch needs to drop and recreate
// around a batch update. Kept as literal CREATE INDEX text here (not
// imported from schema.go) since this file was added specifically to avoid
// touching schema.go; if schema.go's `logs` indexes ever change, this list
// needs to be updated to match.
var logsIndexes = []struct{ name, createStmt string }{
	{"idx_logs_workspace_id", `CREATE INDEX IF NOT EXISTS idx_logs_workspace_id ON logs (workspace_id)`},
	{"idx_logs_source_id", `CREATE INDEX IF NOT EXISTS idx_logs_source_id ON logs (source_id)`},
	{"idx_logs_timestamp", `CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs (timestamp)`},
	{"idx_logs_cluster_id", `CREATE INDEX IF NOT EXISTS idx_logs_cluster_id ON logs (cluster_id)`},
	{"idx_logs_processed", `CREATE INDEX IF NOT EXISTS idx_logs_processed ON logs (processed)`},
}

// ApplyClusteringBatch atomically applies one clustering-worker cycle's
// results: a batch of LogUpdates (via a temp-table + vectorized JOIN
// UPDATE, mirroring ClusteringWorker._apply_batch_updates's "Performance
// Trick" of avoiding slow row-by-row UPDATEs, clustering.py:745-820) plus
// the derived hourly_cluster_counts increments and cluster count/template
// upserts (clustering.py:776-807).
//
// # A real DuckDB engine limitation, and this function's workaround
//
// `UPDATE ... FROM <join>` against a table that has ANY secondary index is
// internally rewritten by DuckDB as a full DELETE-of-old-row +
// INSERT-of-new-row per matched row (see DuckDB's own docs on index
// limitations: "UPDATE statements on indexed columns ... are transformed
// into a DELETE of the original row followed by an INSERT of the updated
// row"). In the DuckDB version bundled with this repo's go-duckdb
// (v1.8.5), that rewrite has a bug specific to the JOIN/FROM form: it
// spuriously raises "Constraint Error: Duplicate key ... violates primary
// key constraint" for the row's OWN existing primary key value, even when
// the update touches none of the indexed columns directly and the target
// table's PK is untouched. This was confirmed empirically against this
// package's exact `logs` schema (5 secondary indexes + a
// nextval()-defaulted INTEGER PRIMARY KEY): a literal single-column,
// single-row `UPDATE logs SET level = 'x' WHERE id = 1` succeeds fine, but
// the identical row via `UPDATE logs SET ... FROM updates_temp WHERE
// logs.id = updates_temp.lid` fails — and only stops failing once EVERY
// secondary index on `logs` is dropped first (dropping fewer, e.g. just the
// two columns actually being written, still fails; the JOIN form appears
// to touch/rebuild all of a row's indexes, not just the changed columns').
//
// The workaround: drop every secondary index on `logs`, in autocommit mode
// (DuckDB's per-connection transactional-DDL visibility didn't fold into
// the same transaction as the update reliably during testing — the drop
// has to actually commit before the batched UPDATE runs, so it cannot be
// done as the opening statements of the same tx), run the batch update +
// aggregation in one transaction, commit, then recreate the indexes
// (autocommit) — all always attempted via a deferred cleanup, so a failure
// mid-batch still leaves the indexes restored rather than permanently
// missing. Recreating a DuckDB index means a full rebuild, so this trades
// some per-batch overhead (proportional to `logs` table size) for
// correctness; if that overhead becomes material at real data volumes, the
// better long-term fix is tracking this as a DuckDB/go-duckdb upstream
// issue and revisiting once a fixed version is available, rather than
// living with the drop/recreate cost indefinitely.
//
// Concurrency note: because this temporarily drops table-wide indexes,
// ApplyClusteringBatch assumes it is never called concurrently with itself
// against the same *DB — true for this migration's Worker (its run loop
// calls processBatch, and therefore this, strictly sequentially) but worth
// flagging if a future caller parallelizes across workspaces sharing one
// DB handle.
func (d *DB) ApplyClusteringBatch(updates []LogUpdate, increments []ClusterIncrement) error {
	if len(updates) == 0 && len(increments) == 0 {
		return nil
	}

	for _, idx := range logsIndexes {
		if _, err := d.Conn.Exec(`DROP INDEX IF EXISTS ` + idx.name); err != nil {
			return fmt.Errorf("clustering: dropping %s before batch update: %w", idx.name, err)
		}
	}
	defer func() {
		for _, idx := range logsIndexes {
			if _, err := d.Conn.Exec(idx.createStmt); err != nil {
				log.Printf("[DB] clustering: failed to recreate %s after batch update: %v", idx.name, err)
			}
		}
	}()

	tx, err := d.Conn.Begin()
	if err != nil {
		return fmt.Errorf("clustering: begin tx: %w", err)
	}
	defer tx.Rollback() //nolint:errcheck // no-op once committed

	if err := applyLogUpdatesTx(tx, updates); err != nil {
		return err
	}
	if err := upsertClustersTx(tx, increments); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("clustering: commit: %w", err)
	}
	return nil
}

// applyLogUpdatesTx applies a batch of LogUpdates plus the derived
// hourly_cluster_counts increments via a DuckDB temporary table +
// vectorized JOIN update. Must run inside the same transaction as the rest
// of ApplyClusteringBatch's work — see that function's doc comment for why
// callers can't invoke this directly without also handling the index
// drop/recreate dance around it.
func applyLogUpdatesTx(tx *sql.Tx, updates []LogUpdate) error {
	if len(updates) == 0 {
		return nil
	}

	if _, err := tx.Exec(`CREATE TEMPORARY TABLE updates_temp (ts VARCHAR, lvl VARCHAR, fcts VARCHAR, cid VARCHAR, lid BIGINT)`); err != nil {
		return fmt.Errorf("clustering: creating updates_temp: %w", err)
	}
	// Best-effort cleanup; a failure here shouldn't mask the real error
	// from the caller, and DuckDB drops temp tables on connection close
	// regardless.
	defer func() { _, _ = tx.Exec(`DROP TABLE IF EXISTS updates_temp`) }()

	stmt, err := tx.Prepare(`INSERT INTO updates_temp VALUES (?, ?, ?, ?, ?)`)
	if err != nil {
		return fmt.Errorf("clustering: preparing updates_temp insert: %w", err)
	}
	for _, u := range updates {
		if _, err := stmt.Exec(u.Timestamp, u.Level, u.FacetsJSON, u.ClusterID, u.LogID); err != nil {
			stmt.Close()
			return fmt.Errorf("clustering: inserting update row for log %d: %w", u.LogID, err)
		}
	}
	stmt.Close()

	if _, err := tx.Exec(`
		UPDATE logs
		SET timestamp = COALESCE(updates_temp.ts, logs.timestamp),
		    level = updates_temp.lvl,
		    facets = updates_temp.fcts::JSON,
		    cluster_id = updates_temp.cid,
		    processed = TRUE
		FROM updates_temp
		WHERE logs.id = updates_temp.lid
	`); err != nil {
		return fmt.Errorf("clustering: applying log updates: %w", err)
	}

	if _, err := tx.Exec(`
		INSERT INTO hourly_cluster_counts (workspace_id, cluster_id, hour_bucket, count)
		SELECT
		    logs.workspace_id,
		    updates_temp.cid,
		    SUBSTRING(REPLACE(COALESCE(updates_temp.ts, logs.timestamp), 'T', ' '), 1, 13) AS hr,
		    COUNT(*)
		FROM updates_temp
		JOIN logs ON logs.id = updates_temp.lid
		WHERE updates_temp.cid IS NOT NULL AND COALESCE(updates_temp.ts, logs.timestamp) IS NOT NULL
		GROUP BY logs.workspace_id, updates_temp.cid, hr
		ON CONFLICT (workspace_id, cluster_id, hour_bucket)
		DO UPDATE SET count = count + excluded.count
	`); err != nil {
		return fmt.Errorf("clustering: upserting hourly_cluster_counts: %w", err)
	}

	return nil
}

// upsertClustersTx applies cluster count increments (and refreshes each
// cluster's stored template) via ON CONFLICT DO UPDATE, mirroring the
// `INSERT INTO clusters ... ON CONFLICT (workspace_id, cluster_id) DO
// UPDATE SET count = count + excluded.count, template = excluded.template`
// loop in ClusteringWorker._apply_batch_updates (clustering.py:798-807).
// Must run inside the same transaction as the rest of
// ApplyClusteringBatch's work. `clusters`' primary key is (workspace_id,
// cluster_id) — not the `logs.id`-style sequence PK that triggers the
// index bug documented on ApplyClusteringBatch — so this plain upsert
// doesn't need the same workaround.
func upsertClustersTx(tx *sql.Tx, increments []ClusterIncrement) error {
	if len(increments) == 0 {
		return nil
	}
	stmt, err := tx.Prepare(`
		INSERT INTO clusters (workspace_id, cluster_id, template, count)
		VALUES (?, ?, ?, ?)
		ON CONFLICT (workspace_id, cluster_id)
		DO UPDATE SET count = count + excluded.count, template = excluded.template
	`)
	if err != nil {
		return fmt.Errorf("clustering: preparing cluster upsert: %w", err)
	}
	defer stmt.Close()

	for _, inc := range increments {
		if _, err := stmt.Exec(inc.WorkspaceID, inc.ClusterID, inc.Template, inc.Count); err != nil {
			return fmt.Errorf("clustering: upserting cluster %s/%s: %w", inc.WorkspaceID, inc.ClusterID, err)
		}
	}
	return nil
}

// UpdateIngestionJobProgress bumps processed_lines for the most recent
// active ingestion job matching (workspaceID, sourceID) and marks it
// completed once it has processed at least total_lines, mirroring
// ClusteringWorker._update_ingestion_jobs (clustering.py:821-840). Runs in
// its own transaction — matches Python, where this call commits separately
// from the main _apply_batch_updates transaction.
func (d *DB) UpdateIngestionJobProgress(workspaceID, sourceID string, count int) error {
	tx, err := d.Conn.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback() //nolint:errcheck // no-op once committed

	if _, err := tx.Exec(`
		UPDATE ingestion_jobs
		SET processed_lines = processed_lines + ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = (
		    SELECT id FROM ingestion_jobs
		    WHERE workspace_id = ? AND source_id = ? AND status IN ('pending', 'processing')
		    ORDER BY created_at DESC LIMIT 1
		)
	`, count, workspaceID, sourceID); err != nil {
		return fmt.Errorf("clustering: bumping ingestion job progress: %w", err)
	}

	if _, err := tx.Exec(`
		UPDATE ingestion_jobs SET status = 'completed'
		WHERE workspace_id = ? AND source_id = ? AND status = 'processing' AND processed_lines >= total_lines
	`, workspaceID, sourceID); err != nil {
		return fmt.Errorf("clustering: completing ingestion job: %w", err)
	}

	return tx.Commit()
}
