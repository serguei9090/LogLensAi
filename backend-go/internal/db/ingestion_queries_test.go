package db

import (
	"context"
	"database/sql/driver"
	"testing"
	"time"

	duckdb "github.com/marcboeker/go-duckdb"
)

func TestInsertLogBatch_Standard(t *testing.T) {
	d, err := Open(MemoryDB)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer d.Close()

	facets := `{"service":"auth"}`
	rows := []LogInsertRow{
		{
			WorkspaceID:     "ws-1",
			SourceID:        "src-1",
			LineID:          1,
			RawText:         "2026-09-16 INFO Hello World",
			Timestamp:       "2026-09-16 10:00:00",
			IngestTimestamp: "2026-09-16 10:00:01",
			Level:           "INFO",
			FacetsJSON:      &facets,
		},
		{
			WorkspaceID:     "ws-1",
			SourceID:        "src-1",
			LineID:          2,
			RawText:         "2026-09-16 ERROR Something failed",
			Timestamp:       "2026-09-16 10:00:02",
			IngestTimestamp: "2026-09-16 10:00:03",
			Level:           "ERROR",
			FacetsJSON:      nil,
		},
	}

	if err := d.InsertLogBatch(rows); err != nil {
		t.Fatalf("InsertLogBatch failed: %v", err)
	}

	var count int
	if err := d.Conn.QueryRow(`SELECT COUNT(*) FROM logs WHERE workspace_id = 'ws-1'`).Scan(&count); err != nil {
		t.Fatalf("Query count failed: %v", err)
	}
	if count != 2 {
		t.Fatalf("Expected 2 logs, got %d", count)
	}
}

func TestInsertLogBatch_BulkAppender(t *testing.T) {
	d, err := Open(MemoryDB)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer d.Close()

	n := 10000
	rows := make([]LogInsertRow, n)
	facets := `{"service":"api","status":"200"}`
	for i := 0; i < n; i++ {
		rows[i] = LogInsertRow{
			WorkspaceID:     "ws-perf",
			SourceID:        "src-perf",
			LineID:          int64(i + 1),
			RawText:         "2026-09-16 12:00:00 [INFO] User login succeeded from 192.168.1.10",
			Timestamp:       "2026-09-16 12:00:00",
			IngestTimestamp: "2026-09-16 12:00:01",
			Level:           "INFO",
			FacetsJSON:      &facets,
		}
	}

	start := time.Now()
	if err := d.InsertLogBatchAppender(rows); err != nil {
		t.Fatalf("InsertLogBatchAppender failed: %v", err)
	}
	elapsed := time.Since(start)
	t.Logf("Inserted %d rows via Appender in %v (%.0f rows/sec)", n, elapsed, float64(n)/elapsed.Seconds())

	var count int
	if err := d.Conn.QueryRow(`SELECT COUNT(*) FROM logs WHERE workspace_id = 'ws-perf'`).Scan(&count); err != nil {
		t.Fatalf("Query failed: %v", err)
	}
	if count != n {
		t.Fatalf("Expected %d rows, got %d", n, count)
	}
}

func TestAppenderBehavior(t *testing.T) {
	d, err := Open(MemoryDB)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer d.Close()

	conn, err := d.Conn.Conn(context.Background())
	if err != nil {
		t.Fatalf("Conn failed: %v", err)
	}
	defer conn.Close()

	var startID int64
	if err := d.Conn.QueryRow(`SELECT MIN(id) FROM (SELECT nextval('log_id_seq') AS id FROM range(5))`).Scan(&startID); err != nil {
		t.Fatalf("range startID failed: %v", err)
	}
	t.Logf("Allocated batch startID: %d (covers %d to %d)", startID, startID, startID+5-1)

	err = conn.Raw(func(driverConn any) error {
		dc, ok := driverConn.(driver.Conn)
		if !ok {
			t.Fatalf("driverConn is not driver.Conn, got %T", driverConn)
		}
		appender, err := duckdb.NewAppenderFromConn(dc, "", "logs")
		if err != nil {
			return err
		}
		defer appender.Close()

		// Try appending a row with explicit integer id
		if err := appender.AppendRow(
			int64(1), // id
			"ws-appender",
			"src-appender",
			int64(10),
			"2026-09-16 INFO Test Appender",
			"2026-09-16 12:00:00",
			"2026-09-16 12:00:01",
			"INFO",
			nil, // cluster_id
			false, // has_comment
			nil, // comment
			nil, // facets
			false, // processed
		); err != nil {
			return err
		}
		if err := appender.Flush(); err != nil {
			return err
		}
		return appender.Close()
	})
	if err != nil {
		t.Fatalf("Appender failed: %v", err)
	}

	var total int
	if err := d.Conn.QueryRow(`SELECT COUNT(*) FROM logs`).Scan(&total); err != nil {
		t.Fatalf("Query failed: %v", err)
	}
	t.Logf("Total logs in table: %d", total)
}
