package db

import (
	"database/sql"
	"fmt"
)

// sequenceStatements creates one dedicated sequence per table with a
// synthetic integer primary key, verbatim from db.py:_setup_schema
// (db.py:176-181). Each table gets its own sequence to prevent cross-table
// ID collisions.
var sequenceStatements = []string{
	`CREATE SEQUENCE IF NOT EXISTS log_id_seq;`,
	`CREATE SEQUENCE IF NOT EXISTS log_streams_id_seq;`,
	`CREATE SEQUENCE IF NOT EXISTS ai_messages_id_seq;`,
	`CREATE SEQUENCE IF NOT EXISTS settings_templates_id_seq;`,
	`CREATE SEQUENCE IF NOT EXISTS ingestion_jobs_id_seq;`,
}

// logsTableStatement is split out from the rest of the schema because
// db.py runs an inline "add raw_text if missing" migration (db.py:200-206)
// immediately after creating it — see setupSchema below.
const logsTableStatement = `
CREATE TABLE IF NOT EXISTS logs (
    id           INTEGER PRIMARY KEY DEFAULT nextval('log_id_seq'),
    workspace_id TEXT,
    source_id    TEXT,
    line_id      INTEGER,
    raw_text     TEXT,
    timestamp    TEXT,
    ingest_timestamp TEXT,
    level        TEXT,
    cluster_id   TEXT,
    has_comment  BOOLEAN DEFAULT FALSE,
    comment      TEXT,
    facets       JSON,
    processed    BOOLEAN DEFAULT FALSE
);`

// tableStatements are the remaining 15 tables, verbatim from
// db.py:_setup_schema (db.py:208-336), one statement per entry so errors are
// attributable to a specific table.
var tableStatements = []string{
	`CREATE TABLE IF NOT EXISTS ingestion_jobs (
        id           INTEGER PRIMARY KEY DEFAULT nextval('ingestion_jobs_id_seq'),
        workspace_id TEXT,
        source_id    TEXT,
        status       TEXT DEFAULT 'queued',
        total_lines  INTEGER DEFAULT 0,
        processed_lines INTEGER DEFAULT 0,
        last_log_id  INTEGER DEFAULT NULL,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
	`CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT
    );`,
	`CREATE TABLE IF NOT EXISTS clusters (
        workspace_id TEXT,
        cluster_id   TEXT,
        template     TEXT,
        count        INTEGER DEFAULT 0,
        PRIMARY KEY (workspace_id, cluster_id)
    );`,
	`CREATE TABLE IF NOT EXISTS fusion_configs (
        workspace_id TEXT,
        fusion_id    TEXT DEFAULT 'default',
        source_id    TEXT,
        enabled      BOOLEAN DEFAULT TRUE,
        tz_offset    INTEGER DEFAULT 0,
        time_shift_seconds INTEGER DEFAULT 0,
        custom_format TEXT,
        parser_config TEXT,
        PRIMARY KEY (workspace_id, fusion_id, source_id)
    );`,
	`CREATE TABLE IF NOT EXISTS ai_sessions (
        session_id   TEXT PRIMARY KEY,
        workspace_id TEXT,
        name         TEXT,
        provider     TEXT,
        model        TEXT,
        provider_session_id TEXT,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
	`CREATE TABLE IF NOT EXISTS log_streams (
        id           INTEGER PRIMARY KEY DEFAULT nextval('log_streams_id_seq'),
        workspace_id TEXT,
        name         TEXT,
        type         TEXT,
        port         INTEGER,
        enabled      BOOLEAN DEFAULT TRUE,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
	`CREATE TABLE IF NOT EXISTS ai_messages (
        id           INTEGER PRIMARY KEY DEFAULT nextval('ai_messages_id_seq'),
        session_id   TEXT,
        role         TEXT,
        content      TEXT,
        a2ui_payload TEXT,
        context_logs TEXT,
        timestamp    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        provider_session_id TEXT
    );`,
	`CREATE TABLE IF NOT EXISTS ai_memory (
        workspace_id TEXT,
        issue_signature TEXT,
        resolution TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (workspace_id, issue_signature)
    );`,
	`CREATE TABLE IF NOT EXISTS temporal_offsets (
        workspace_id TEXT,
        source_id    TEXT,
        offset_seconds INTEGER DEFAULT 0,
        PRIMARY KEY (workspace_id, source_id)
    );`,
	`CREATE TABLE IF NOT EXISTS workspace_settings (
        workspace_id TEXT,
        key          TEXT,
        value        TEXT,
        PRIMARY KEY (workspace_id, key)
    );`,
	`CREATE TABLE IF NOT EXISTS settings_templates (
        id           INTEGER PRIMARY KEY DEFAULT nextval('settings_templates_id_seq'),
        workspace_id TEXT,
        name         TEXT,
        config_json  TEXT,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
	`CREATE TABLE IF NOT EXISTS anomalies (
        workspace_id TEXT,
        cluster_id   TEXT,
        timestamp    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        z_score      FLOAT,
        current_rate FLOAT,
        mean_rate    FLOAT,
        PRIMARY KEY (workspace_id, cluster_id, timestamp)
    );`,
	`CREATE TABLE IF NOT EXISTS folders (
        id           TEXT PRIMARY KEY,
        workspace_id TEXT,
        parent_id    TEXT,
        name         TEXT,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
	`CREATE TABLE IF NOT EXISTS log_sources (
        id           TEXT PRIMARY KEY,
        workspace_id TEXT,
        folder_id    TEXT,
        name         TEXT,
        type         TEXT,
        path         TEXT,
        is_uploaded  BOOLEAN DEFAULT FALSE,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
}

// indexStatements are the "Performance Indexes" from db.py:338-343.
var indexStatements = []string{
	`CREATE INDEX IF NOT EXISTS idx_logs_workspace_id ON logs (workspace_id);`,
	`CREATE INDEX IF NOT EXISTS idx_logs_source_id ON logs (source_id);`,
	`CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs (timestamp);`,
	`CREATE INDEX IF NOT EXISTS idx_logs_cluster_id ON logs (cluster_id);`,
	`CREATE INDEX IF NOT EXISTS idx_logs_processed ON logs (processed);`,
	`CREATE INDEX IF NOT EXISTS idx_ai_messages_session_id ON ai_messages (session_id);`,
}

// AllTables lists every table this package creates, for verification /
// tests. There are 16 (not the commonly-quoted 17 — see schema_test.go).
var AllTables = []string{
	"logs",
	"ingestion_jobs",
	"settings",
	"clusters",
	"fusion_configs",
	"ai_sessions",
	"log_streams",
	"ai_messages",
	"ai_memory",
	"temporal_offsets",
	"workspace_settings",
	"settings_templates",
	"anomalies",
	"folders",
	"log_sources",
	"hourly_cluster_counts", // created by migrateHourlyStats, see migrations.go
}

// setupSchema ports db.py:_setup_schema (db.py:169-344): sequences, tables,
// the inline raw_text migration, and indexes, in the same order. Every
// statement uses CREATE ... IF NOT EXISTS so this is safe to re-run.
func setupSchema(conn *sql.DB) error {
	for _, stmt := range sequenceStatements {
		if _, err := conn.Exec(stmt); err != nil {
			return fmt.Errorf("creating sequence: %w", err)
		}
	}

	if _, err := conn.Exec(logsTableStatement); err != nil {
		return fmt.Errorf("creating logs table: %w", err)
	}

	// --- MIGRATIONS (Vibe Shift v0.12.0), db.py:200-206 ---
	// Inline, because it lived inside _setup_schema itself in Python rather
	// than the _run_migrations chain.
	hasRawText, err := columnExists(conn, "logs", "raw_text")
	if err != nil {
		return fmt.Errorf("checking logs.raw_text: %w", err)
	}
	if !hasRawText {
		if _, err := conn.Exec(`ALTER TABLE logs ADD COLUMN raw_text TEXT`); err != nil {
			return fmt.Errorf("adding logs.raw_text: %w", err)
		}
	}

	for _, stmt := range tableStatements {
		if _, err := conn.Exec(stmt); err != nil {
			return fmt.Errorf("creating table: %w", err)
		}
	}

	for _, stmt := range indexStatements {
		if _, err := conn.Exec(stmt); err != nil {
			return fmt.Errorf("creating index: %w", err)
		}
	}

	return nil
}

// columnExists checks information_schema.columns, the same probe technique
// db.py's own newer migrations use (e.g. db.py:465-469,
// _migrate_fast_path_schema / _migrate_ingestion_columns). We use it as the
// single, consistent way to answer "does column X exist on table Y" across
// this whole package, in place of Python's mix of that technique and
// "SELECT col LIMIT 1, catch the exception" — same result, more idiomatic
// in Go, since a failed probe query is otherwise indistinguishable from a
// real connection error without string-matching driver errors.
func columnExists(conn *sql.DB, table, column string) (bool, error) {
	var count int
	err := conn.QueryRow(
		`SELECT count(*) FROM information_schema.columns WHERE table_name = ? AND column_name = ?`,
		table, column,
	).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// tableExists checks information_schema.tables.
func tableExists(conn *sql.DB, table string) (bool, error) {
	var count int
	err := conn.QueryRow(
		`SELECT count(*) FROM information_schema.tables WHERE table_name = ?`,
		table,
	).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
