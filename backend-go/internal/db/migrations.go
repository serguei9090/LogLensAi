package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
)

// runMigrations ports db.py:_run_migrations (db.py:346-359). Each migration
// is a small, idempotent step run in the same order as Python so that a
// database created by either implementation converges on the same schema.
func runMigrations(conn *sql.DB) error {
	steps := []struct {
		name string
		fn   func(*sql.DB) error
	}{
		{"ai_tables", migrateAiTables},
		{"fusion_pk", migrateFusionPK},
		{"fusion_time_shift", migrateFusionTimeShift},
		{"log_columns", migrateLogColumns},
		{"log_facets", migrateLogFacets},
		{"ingestion_columns", migrateIngestionColumns},
		{"ingestion_jobs", migrateIngestionJobs},
		{"fast_path_schema", migrateFastPathSchema},
		{"indexes", migrateIndexes},
		{"drain_masks", migrateDrainMasks},
		{"hourly_stats", migrateHourlyStats},
		{"log_sources_uploaded", migrateLogSourcesUploaded},
	}
	for _, s := range steps {
		if err := s.fn(conn); err != nil {
			return fmt.Errorf("migration %s: %w", s.name, err)
		}
	}
	return nil
}

// migrateLogSourcesUploaded ports db.py:_migrate_log_sources_uploaded
// (db.py:361-366).
func migrateLogSourcesUploaded(conn *sql.DB) error {
	ok, err := columnExists(conn, "log_sources", "is_uploaded")
	if err != nil {
		return err
	}
	if ok {
		return nil
	}
	log.Println("[DB] Migrating: Adding 'is_uploaded' column to log_sources table")
	_, err = conn.Exec(`ALTER TABLE log_sources ADD COLUMN is_uploaded BOOLEAN DEFAULT FALSE`)
	return err
}

// maskRule mirrors the drain_masks JSON shape from db.py:131-157.
type maskRule struct {
	Pattern string `json:"pattern"`
	Label   string `json:"label"`
	Enabled bool   `json:"enabled"`
}

// migrateDrainMasks ports db.py:_migrate_drain_masks (db.py:368-426): fixes
// the historically-broken IP lookbehind regex in the stored drain_masks
// setting, and appends HTTP_STATUS/HTTP_METHOD masks if not already present.
func migrateDrainMasks(conn *sql.DB) error {
	const brokenIPPattern = `((?<=[^A-Za-z0-9])|^)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?=[^A-Za-z0-9]|$)`
	const fixedIPPattern = `\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b`

	extraMasks := []maskRule{
		{Pattern: `\b([1-5][0-9]{2})\b`, Label: "HTTP_STATUS", Enabled: true},
		{Pattern: `\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE)\b`, Label: "HTTP_METHOD", Enabled: true},
	}

	var raw sql.NullString
	err := conn.QueryRow(`SELECT value FROM settings WHERE key = 'drain_masks'`).Scan(&raw)
	if err == sql.ErrNoRows {
		return nil
	}
	if err != nil {
		return err
	}
	if !raw.Valid {
		return nil
	}

	// Decode leniently: skip the migration entirely (like Python's
	// `except Exception: return`) if the stored value isn't valid JSON.
	var masks []map[string]any
	if err := json.Unmarshal([]byte(raw.String), &masks); err != nil {
		return nil
	}

	changed := false
	existingLabels := map[string]bool{}
	for _, m := range masks {
		if label, ok := m["label"].(string); ok {
			existingLabels[label] = true
		}
	}

	for _, m := range masks {
		if pattern, ok := m["pattern"].(string); ok && pattern == brokenIPPattern {
			m["pattern"] = fixedIPPattern
			changed = true
			log.Println("[DB Migration] Fixed broken IP lookbehind regex in drain_masks")
		}
	}

	for _, extra := range extraMasks {
		if !existingLabels[extra.Label] {
			masks = append(masks, map[string]any{
				"pattern": extra.Pattern,
				"label":   extra.Label,
				"enabled": extra.Enabled,
			})
			changed = true
			log.Printf("[DB Migration] Added '%s' mask to drain_masks", extra.Label)
		}
	}

	if !changed {
		return nil
	}

	encoded, err := json.Marshal(masks)
	if err != nil {
		return err
	}
	_, err = conn.Exec(`UPDATE settings SET value = ? WHERE key = 'drain_masks'`, string(encoded))
	return err
}

// migrateHourlyStats ports db.py:_migrate_hourly_stats (db.py:428-449):
// creates hourly_cluster_counts and backfills it from existing logs once.
func migrateHourlyStats(conn *sql.DB) error {
	if _, err := conn.Exec(`
        CREATE TABLE IF NOT EXISTS hourly_cluster_counts (
            workspace_id TEXT,
            cluster_id TEXT,
            hour_bucket TEXT,
            count INTEGER,
            PRIMARY KEY (workspace_id, cluster_id, hour_bucket)
        );`); err != nil {
		return err
	}

	var count int
	if err := conn.QueryRow(`SELECT count(*) FROM hourly_cluster_counts`).Scan(&count); err != nil {
		return err
	}
	if count != 0 {
		return nil
	}

	log.Println("[DB] Backfilling hourly_cluster_counts from existing logs...")
	_, err := conn.Exec(`
        INSERT INTO hourly_cluster_counts (workspace_id, cluster_id, hour_bucket, count)
        SELECT workspace_id, cluster_id, SUBSTRING(REPLACE(timestamp, 'T', ' '), 1, 13) as hr, count(*)
        FROM logs
        WHERE cluster_id IS NOT NULL AND timestamp IS NOT NULL AND length(timestamp) >= 13
        GROUP BY workspace_id, cluster_id, hr
        ON CONFLICT DO NOTHING
    `)
	return err
}

// migrateFastPathSchema ports db.py:_migrate_fast_path_schema
// (db.py:451-498). Each of the three steps only logs on failure, matching
// Python (a failure here should not abort the rest of migration/startup).
func migrateFastPathSchema(conn *sql.DB) error {
	if ok, err := columnExists(conn, "logs", "line_id"); err != nil {
		return err
	} else if !ok {
		log.Println("[DB] Fast-Path Migration: adding 'line_id' column...")
		if _, err := conn.Exec(`ALTER TABLE logs ADD COLUMN line_id INTEGER`); err != nil {
			log.Printf("[DB] Fast-Path Migration (line_id): %v", err)
		}
	}

	if ok, err := columnExists(conn, "logs", "raw_text"); err != nil {
		return err
	} else if !ok {
		log.Println("[DB] Dual-Track Migration: adding 'raw_text' column back...")
		if _, err := conn.Exec(`ALTER TABLE logs ADD COLUMN raw_text TEXT`); err != nil {
			log.Printf("[DB] Dual-Track Migration (raw_text): %v", err)
		}
	}

	if ok, err := columnExists(conn, "logs", "message"); err != nil {
		return err
	} else if ok {
		log.Println("[DB] Fast-Path Migration: dropping 'message' column...")
		if _, err := conn.Exec(`ALTER TABLE logs DROP COLUMN message`); err != nil {
			log.Printf("[DB] Fast-Path Migration (drop message): %v", err)
		}
	}

	return nil
}

// migrateIngestionColumns ports db.py:_migrate_ingestion_columns
// (db.py:500-520).
func migrateIngestionColumns(conn *sql.DB) error {
	ok, err := columnExists(conn, "logs", "processed")
	if err != nil {
		return err
	}
	if !ok {
		log.Println("[DB] Migration: Adding 'processed' column to 'logs' table...")
		// STAB-004: drop dependent indexes first to avoid DependencyException.
		for _, idx := range []string{
			"idx_logs_workspace_id", "idx_logs_source_id", "idx_logs_timestamp", "idx_logs_cluster_id",
		} {
			if _, err := conn.Exec(`DROP INDEX IF EXISTS ` + idx); err != nil {
				log.Printf("[DB] Migration Error (logs.processed): %v", err)
			}
		}
		if _, err := conn.Exec(`ALTER TABLE logs ADD COLUMN processed BOOLEAN DEFAULT FALSE`); err != nil {
			log.Printf("[DB] Migration Error (logs.processed): %v", err)
		}
	}

	_, err = conn.Exec(`CREATE INDEX IF NOT EXISTS idx_logs_processed ON logs (processed)`)
	return err
}

// migrateIngestionJobs ports db.py:_migrate_ingestion_jobs (db.py:522-564).
func migrateIngestionJobs(conn *sql.DB) error {
	ok, err := columnExists(conn, "ingestion_jobs", "source_id")
	if err != nil {
		return err
	}
	if !ok {
		log.Println("[DB] Migration: Adding 'source_id' column to 'ingestion_jobs' table...")
		if _, alterErr := conn.Exec(`ALTER TABLE ingestion_jobs ADD COLUMN source_id TEXT`); alterErr != nil {
			log.Printf("[DB] Migration Error (ingestion_jobs.source_id): %v. Recreating table.", alterErr)
			if _, err := conn.Exec(`DROP TABLE IF EXISTS ingestion_jobs`); err != nil {
				return err
			}
			return setupSchema(conn)
		}
	}

	// Stale 'queued'/'pending'/'processing' jobs from a previous crashed
	// session can never complete (the tracking goroutines are gone).
	res, err := conn.Exec(`
        UPDATE ingestion_jobs
        SET status = 'failed', updated_at = CURRENT_TIMESTAMP
        WHERE status IN ('queued', 'pending', 'processing')
    `)
	if err != nil {
		log.Printf("[DB] Migration: Could not clean up stale ingestion jobs: %v", err)
		return nil
	}
	if n, err := res.RowsAffected(); err == nil && n > 0 {
		log.Printf("[DB] Migration: Marked %d stale ingestion job(s) as 'failed' (leftover from previous session).", n)
	}
	return nil
}

// migrateIndexes ports db.py:_migrate_indexes (db.py:566-581): ensures every
// performance index exists on legacy databases, including two
// (idx_folders_workspace_id, idx_log_sources_workspace_id) that aren't part
// of the initial setupSchema index list.
func migrateIndexes(conn *sql.DB) error {
	stmts := []string{
		`CREATE INDEX IF NOT EXISTS idx_logs_workspace_id ON logs (workspace_id);`,
		`CREATE INDEX IF NOT EXISTS idx_logs_source_id ON logs (source_id);`,
		`CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs (timestamp);`,
		`CREATE INDEX IF NOT EXISTS idx_logs_cluster_id ON logs (cluster_id);`,
		`CREATE INDEX IF NOT EXISTS idx_logs_processed ON logs (processed);`,
		`CREATE INDEX IF NOT EXISTS idx_ai_messages_session_id ON ai_messages (session_id);`,
		`CREATE INDEX IF NOT EXISTS idx_folders_workspace_id ON folders (workspace_id);`,
		`CREATE INDEX IF NOT EXISTS idx_log_sources_workspace_id ON log_sources (workspace_id);`,
	}
	for _, stmt := range stmts {
		if _, err := conn.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}

// migrateAiTables ports db.py:_migrate_ai_tables (db.py:583-623).
func migrateAiTables(conn *sql.DB) error {
	// Renames are best-effort: if the legacy column isn't there either,
	// Python silently swallows the error (contextlib.suppress(Exception))
	// and we do the same.
	if ok, err := columnExists(conn, "ai_sessions", "name"); err != nil {
		return err
	} else if !ok {
		_, _ = conn.Exec(`ALTER TABLE ai_sessions RENAME COLUMN title TO name`)
	}

	if ok, err := columnExists(conn, "ai_sessions", "last_modified"); err != nil {
		return err
	} else if !ok {
		_, _ = conn.Exec(`ALTER TABLE ai_sessions RENAME COLUMN last_updated TO last_modified`)
	}

	addColumns := []struct{ table, column string }{
		{"ai_sessions", "provider_session_id"},
		{"ai_messages", "provider_session_id"},
		{"ai_messages", "a2ui_payload"},
	}
	for _, c := range addColumns {
		ok, err := columnExists(conn, c.table, c.column)
		if err != nil {
			return err
		}
		if !ok {
			if _, err := conn.Exec(`ALTER TABLE ` + c.table + ` ADD COLUMN ` + c.column + ` TEXT`); err != nil {
				return err
			}
		}
	}

	ok, err := columnExists(conn, "ai_memory", "workspace_id")
	if err != nil {
		return err
	}
	if !ok {
		_, err := conn.Exec(`
            CREATE TABLE IF NOT EXISTS ai_memory (
                workspace_id TEXT,
                issue_signature TEXT,
                resolution TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (workspace_id, issue_signature)
            );`)
		if err != nil {
			return err
		}
	}
	return nil
}

// migrateFusionPK ports db.py:_migrate_fusion_pk (db.py:625-655). Errors are
// logged and swallowed rather than propagated, matching Python's broad
// `except Exception as e: logger.error(...)` around the whole method.
func migrateFusionPK(conn *sql.DB) error {
	rows, err := conn.Query(`SELECT k.name FROM pragma_table_info('fusion_configs') k WHERE k.pk > 0`)
	if err != nil {
		log.Printf("[DB] Error migrating fusion_configs: %v", err)
		return nil
	}
	var pkCols []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			rows.Close()
			log.Printf("[DB] Error migrating fusion_configs: %v", err)
			return nil
		}
		pkCols = append(pkCols, name)
	}
	rows.Close()

	hasFusionID := false
	for _, c := range pkCols {
		if c == "fusion_id" {
			hasFusionID = true
			break
		}
	}
	if hasFusionID {
		return nil
	}

	log.Println("[DB] Migrating fusion_configs to update Primary Key...")
	if _, err := conn.Exec(`CREATE TEMP TABLE fusion_configs_backup AS SELECT * FROM fusion_configs`); err != nil {
		log.Printf("[DB] Error migrating fusion_configs: %v", err)
		return nil
	}
	if _, err := conn.Exec(`DROP TABLE fusion_configs`); err != nil {
		log.Printf("[DB] Error migrating fusion_configs: %v", err)
		return nil
	}
	if err := setupSchema(conn); err != nil {
		log.Printf("[DB] Error migrating fusion_configs: %v", err)
		return nil
	}

	backupHasFusionID, err := columnExists(conn, "fusion_configs_backup", "fusion_id")
	if err != nil {
		log.Printf("[DB] Error migrating fusion_configs: %v", err)
		return nil
	}

	if backupHasFusionID {
		_, err = conn.Exec(`
            INSERT INTO fusion_configs (workspace_id, fusion_id, source_id, enabled, tz_offset, custom_format, parser_config)
            SELECT workspace_id, fusion_id, source_id, enabled, tz_offset, custom_format, parser_config FROM fusion_configs_backup
        `)
	} else {
		_, err = conn.Exec(`
            INSERT INTO fusion_configs (workspace_id, fusion_id, source_id, enabled, tz_offset, custom_format, parser_config)
            SELECT workspace_id, 'default', source_id, enabled, tz_offset, custom_format, parser_config FROM fusion_configs_backup
        `)
	}
	if err != nil {
		log.Printf("[DB] Error migrating fusion_configs: %v", err)
		return nil
	}

	if _, err := conn.Exec(`DROP TABLE fusion_configs_backup`); err != nil {
		log.Printf("[DB] Error migrating fusion_configs: %v", err)
	}
	return nil
}

// migrateFusionTimeShift ports db.py:_migrate_fusion_time_shift
// (db.py:657-664).
func migrateFusionTimeShift(conn *sql.DB) error {
	ok, err := columnExists(conn, "fusion_configs", "time_shift_seconds")
	if err != nil {
		return err
	}
	if ok {
		return nil
	}
	log.Println("[DB] Adding time_shift_seconds to fusion_configs...")
	_, err = conn.Exec(`ALTER TABLE fusion_configs ADD COLUMN time_shift_seconds INTEGER DEFAULT 0`)
	return err
}

// migrateLogColumns ports db.py:_migrate_log_columns (db.py:666-688).
func migrateLogColumns(conn *sql.DB) error {
	if ok, err := columnExists(conn, "logs", "source_id"); err != nil {
		return err
	} else if !ok {
		if _, err := conn.Exec(`ALTER TABLE logs ADD COLUMN source_id TEXT`); err != nil {
			return err
		}
	}

	if ok, err := columnExists(conn, "logs", "ingest_timestamp"); err != nil {
		return err
	} else if !ok {
		log.Println("[DB] Migrating: Adding 'ingest_timestamp' column to logs table")
		if _, err := conn.Exec(`ALTER TABLE logs ADD COLUMN ingest_timestamp TEXT`); err != nil {
			return err
		}
	}

	// Ensure per-table sequences exist on legacy databases predating the
	// dedicated-sequence migration. Best-effort, like Python's
	// contextlib.suppress(Exception) around each.
	for _, seq := range []string{"log_streams_id_seq", "ai_messages_id_seq", "settings_templates_id_seq"} {
		_, _ = conn.Exec(`CREATE SEQUENCE IF NOT EXISTS ` + seq + `;`)
	}

	_, _ = conn.Exec(`ALTER TABLE logs ALTER id SET DEFAULT nextval('log_id_seq')`)

	return nil
}

// migrateLogFacets ports db.py:_migrate_log_facets (db.py:690-695).
func migrateLogFacets(conn *sql.DB) error {
	ok, err := columnExists(conn, "logs", "facets")
	if err != nil {
		return err
	}
	if ok {
		return nil
	}
	log.Println("[DB] Adding facets column to logs table...")
	_, err = conn.Exec(`ALTER TABLE logs ADD COLUMN facets JSON`)
	return err
}

// initializeClusterCache ports db.py:_initialize_cluster_cache
// (db.py:697-709). Not part of the _run_migrations chain in Python, but
// called from the same place (_create_tables) immediately afterward, so we
// call it right after runMigrations too (see db.go's init()).
func initializeClusterCache(conn *sql.DB) error {
	var count int
	if err := conn.QueryRow(`SELECT count(*) FROM clusters`).Scan(&count); err != nil {
		log.Printf("[DB] Cluster cache initialization failure: %v", err)
		return nil
	}
	if count != 0 {
		return nil
	}
	log.Println("[DB] Initializing clusters cache...")
	_, err := conn.Exec(`
        INSERT INTO clusters (workspace_id, cluster_id, template, count)
        SELECT workspace_id, cluster_id, 'Pattern ' || cluster_id, count(*)
        FROM logs WHERE cluster_id IS NOT NULL GROUP BY workspace_id, cluster_id
    `)
	if err != nil {
		log.Printf("[DB] Cluster cache initialization failure: %v", err)
	}
	return nil
}
