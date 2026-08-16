// Package db owns the DuckDB connection lifecycle and schema for the LogLens
// backend: opening/creating the database file, WAL-corruption recovery,
// idempotent schema creation, schema-evolution migrations, and default
// settings seeding.
//
// This package is intentionally scoped to connection + schema only (see
// docs/migration/STATUS.md, Phase 1). Query methods for individual RPC
// handlers (get_logs, etc.) are built in later phases on top of DB.Conn.
package db

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"

	// Registers the "duckdb" database/sql driver.
	_ "github.com/marcboeker/go-duckdb"
)

// MemoryDB is the DuckDB DSN for an ephemeral in-memory database. It mirrors
// sidecar/src/db.py's MEMORY_DB constant, used as the fallback when no path
// is supplied so we never accidentally create a random file on disk.
const MemoryDB = ":memory:"

// DB wraps the pooled *sql.DB handle for one DuckDB database file (or an
// in-memory instance) together with the resolved path it was opened from.
type DB struct {
	Conn *sql.DB
	Path string
}

// Open creates/opens the DuckDB database at path, runs schema setup,
// migrations, and default-settings seeding, and returns a ready-to-use DB.
//
// Concurrency / connection model
// -------------------------------
// The Python sidecar (sidecar/src/db.py:20-97) implements a manual
// singleton: exactly one raw `duckdb.connect()` per process
// (self._main_conn), plus one thread-local "cursor" connection per thread
// created via `self._main_conn.cursor()`. Two things motivate that design:
//
//  1. DuckDB (like SQLite) locks the database file at the OS level. Opening
//     the same file twice via duckdb.connect() from the same process can
//     deadlock on Windows, so Python is careful to call duckdb.connect()
//     exactly once and hand out `.cursor()` sub-connections (which share the
//     same underlying database handle) to every other thread.
//  2. DuckDB has single-writer-at-a-time semantics; uncoordinated writer
//     connections across threads can contend/deadlock, so each thread gets
//     its own cursor rather than sharing one connection object across
//     threads.
//
// go-duckdb's database/sql driver already gives us both properties for
// free, provided we open the database exactly once per process:
//
//   - duckdb.Driver implements database/sql/driver.DriverContext
//     (OpenConnector). database/sql.Open() detects that and calls
//     OpenConnector exactly once — which is the only place go-duckdb calls
//     duckdb_open_ext (the C call that actually opens/locks the file). Every
//     subsequent pooled *sql.Conn is produced by Connector.Connect(), which
//     calls duckdb_connect() against that *same* shared duckdb_database
//     handle — i.e. exactly the "one main connection + N cheap
//     sub-connections" shape db.py builds by hand.
//   - database/sql's pool then hands each goroutine its own underlying
//     driver.Conn (never shares one conn across concurrent goroutines),
//     which is the Go analogue of Python's thread-local cursor.
//
// So there is no need to replicate threading.local() bookkeeping in Go: as
// long as callers call Open() exactly once per db path and reuse the
// returned *DB (never call Open() twice concurrently for the same file),
// database/sql's own pool gives us the same safety Python built manually.
// The one piece of Python's design we *do* port explicitly is WAL-corruption
// recovery (recoverWAL below), since that is a data-safety behavior, not a
// connection-pooling one.
func Open(path string) (*DB, error) {
	dbPath, err := resolvePath(path)
	if err != nil {
		return nil, err
	}

	conn, err := openDuckDB(dbPath)
	if err != nil {
		conn, err = recoverWAL(dbPath, err)
		if err != nil {
			return nil, err
		}
	}

	d := &DB{Conn: conn, Path: dbPath}

	if err := d.init(); err != nil {
		_ = conn.Close()
		return nil, err
	}

	return d, nil
}

// resolvePath mirrors db.py:_init_db's path handling: the in-memory sentinel
// is passed through unchanged, everything else is made absolute.
func resolvePath(path string) (string, error) {
	if path == "" {
		path = MemoryDB
	}
	if path == MemoryDB {
		return MemoryDB, nil
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return "", fmt.Errorf("db: resolving path %q: %w", path, err)
	}
	return abs, nil
}

// openDuckDB opens dbPath via the duckdb database/sql driver and eagerly
// verifies the connection with Ping, so that connect-time failures (e.g. WAL
// replay errors) surface here rather than on first query — matching Python,
// where duckdb.connect() itself raises on WAL corruption.
func openDuckDB(dbPath string) (*sql.DB, error) {
	conn, err := sql.Open("duckdb", dbPath)
	if err != nil {
		return nil, err
	}
	if err := conn.Ping(); err != nil {
		_ = conn.Close()
		return nil, err
	}
	return conn, nil
}

// recoverWAL ports db.py:_recover_wal (db.py:47-57). If the initial connect
// failed and a stale/corrupt `<path>.wal` file sits next to the database, we
// delete it and retry exactly once. Any error from the retry (including a
// fresh WAL error) is returned as-is; if there is no WAL file to blame, the
// original error is returned unchanged.
func recoverWAL(dbPath string, origErr error) (*sql.DB, error) {
	if dbPath == MemoryDB {
		return nil, origErr
	}
	walPath := dbPath + ".wal"
	if _, statErr := os.Stat(walPath); statErr != nil {
		// No WAL file to blame — propagate the original connect error.
		return nil, origErr
	}

	log.Printf("[DB] WAL replay failed: %v", origErr)
	if rmErr := os.Remove(walPath); rmErr != nil {
		// Couldn't remove the WAL either; surface the original error, same
		// as Python's `except Exception: pass` followed by `raise e`.
		return nil, origErr
	}

	return openDuckDB(dbPath)
}

// init runs schema creation, migrations, cache/backfill initialization, and
// default settings seeding, in the same order as db.py:_create_tables
// (db.py:102-107).
func (d *DB) init() error {
	if err := setupSchema(d.Conn); err != nil {
		return fmt.Errorf("db: schema setup: %w", err)
	}
	if err := runMigrations(d.Conn); err != nil {
		return fmt.Errorf("db: migrations: %w", err)
	}
	if err := initializeClusterCache(d.Conn); err != nil {
		return fmt.Errorf("db: cluster cache init: %w", err)
	}
	if err := initializeDefaultSettings(d.Conn); err != nil {
		return fmt.Errorf("db: default settings seed: %w", err)
	}
	return nil
}

// Close closes the underlying connection pool (and with it, the single
// shared duckdb_database handle — see the Open doc comment).
func (d *DB) Close() error {
	if d == nil || d.Conn == nil {
		return nil
	}
	return d.Conn.Close()
}
