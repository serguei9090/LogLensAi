package db

import (
	"path/filepath"
	"testing"
)

// TestOpen_CreatesAllTables verifies Open() creates every table this
// package owns and that they're visible via information_schema.
func TestOpen_CreatesAllTables(t *testing.T) {
	d, err := Open(MemoryDB)
	if err != nil {
		t.Fatalf("Open(MemoryDB) failed: %v", err)
	}
	defer d.Close()

	for _, table := range AllTables {
		ok, err := tableExists(d.Conn, table)
		if err != nil {
			t.Fatalf("checking table %q: %v", table, err)
		}
		if !ok {
			t.Errorf("expected table %q to exist, it does not", table)
		}
	}

	if len(AllTables) != 16 {
		t.Errorf("expected 16 tables, AllTables has %d", len(AllTables))
	}
}

// TestOpen_SeedsDefaultSettings verifies default settings are inserted on a
// fresh database, including the JSON-valued ones.
func TestOpen_SeedsDefaultSettings(t *testing.T) {
	d, err := Open(MemoryDB)
	if err != nil {
		t.Fatalf("Open(MemoryDB) failed: %v", err)
	}
	defer d.Close()

	var count int
	if err := d.Conn.QueryRow(`SELECT COUNT(*) FROM settings`).Scan(&count); err != nil {
		t.Fatalf("counting settings: %v", err)
	}
	if count == 0 {
		t.Fatal("expected default settings to be seeded, got 0 rows")
	}

	wantKeys := []string{
		"ai_provider", "ai_model", "drain_similarity_threshold",
		"drain_masks", "ui_command_palette_shortcut", "facet_extractions",
	}
	for _, key := range wantKeys {
		var value string
		err := d.Conn.QueryRow(`SELECT value FROM settings WHERE key = ?`, key).Scan(&value)
		if err != nil {
			t.Errorf("expected setting %q to exist: %v", key, err)
			continue
		}
		if value == "" && key != "ai_api_key" {
			t.Errorf("expected setting %q to have a non-empty value", key)
		}
	}

	var maskCount int
	if err := d.Conn.QueryRow(
		`SELECT json_array_length(value) FROM settings WHERE key = 'drain_masks'`,
	).Scan(&maskCount); err != nil {
		t.Fatalf("checking drain_masks: %v", err)
	}
	if maskCount != 11 {
		t.Errorf("expected 11 default drain_masks, got %d", maskCount)
	}
}

// TestOpen_Idempotent verifies Open() can run twice against the same file
// without error, mirroring app restarts against an existing database.
func TestOpen_Idempotent(t *testing.T) {
	path := filepath.Join(t.TempDir(), "loglens_test.duckdb")

	d1, err := Open(path)
	if err != nil {
		t.Fatalf("first Open() failed: %v", err)
	}
	if _, err := d1.Conn.Exec(
		`INSERT INTO folders (id, workspace_id, name) VALUES ('f1', 'ws1', 'Test Folder')`,
	); err != nil {
		t.Fatalf("insert failed: %v", err)
	}
	if err := d1.Close(); err != nil {
		t.Fatalf("closing first handle: %v", err)
	}

	d2, err := Open(path)
	if err != nil {
		t.Fatalf("second Open() (re-open existing db) failed: %v", err)
	}
	defer d2.Close()

	var name string
	if err := d2.Conn.QueryRow(`SELECT name FROM folders WHERE id = 'f1'`).Scan(&name); err != nil {
		t.Fatalf("expected previously-inserted row to survive reopen: %v", err)
	}
	if name != "Test Folder" {
		t.Errorf("expected folder name 'Test Folder', got %q", name)
	}

	for _, table := range AllTables {
		ok, err := tableExists(d2.Conn, table)
		if err != nil || !ok {
			t.Errorf("table %q missing after reopen (err=%v)", table, err)
		}
	}
}

// TestResolvePath verifies the in-memory sentinel is preserved and other
// paths are absolutized, mirroring db.py:_init_db's path handling.
func TestResolvePath(t *testing.T) {
	got, err := resolvePath("")
	if err != nil || got != MemoryDB {
		t.Errorf("resolvePath(\"\") = %q, %v; want %q, nil", got, err, MemoryDB)
	}

	got, err = resolvePath(MemoryDB)
	if err != nil || got != MemoryDB {
		t.Errorf("resolvePath(MemoryDB) = %q, %v; want %q, nil", got, err, MemoryDB)
	}

	got, err = resolvePath("relative.duckdb")
	if err != nil {
		t.Fatalf("resolvePath(relative) error: %v", err)
	}
	if !filepath.IsAbs(got) {
		t.Errorf("resolvePath(relative.duckdb) = %q, want absolute path", got)
	}
}
