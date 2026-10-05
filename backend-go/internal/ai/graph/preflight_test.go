// Assume Role: The Automation Engineer (@test)

package graph

import (
	"strings"
	"testing"

	_ "github.com/marcboeker/go-duckdb"
	"loglensai/backend-go/internal/app"
	"loglensai/backend-go/internal/db"
)

func TestInspectWorkspace_EmptyAndWithErrors(t *testing.T) {
	testDB, err := db.Open(db.MemoryDB)
	if err != nil {
		t.Fatalf("failed to open in-memory duckdb: %v", err)
	}
	defer testDB.Close()

	testApp := &app.App{DB: testDB}

	// 1. Test empty workspace
	invEmpty, err := InspectWorkspace(testApp, "empty-ws")
	if err != nil {
		t.Fatalf("InspectWorkspace empty failed: %v", err)
	}
	if invEmpty.TotalLogs != 0 || len(invEmpty.Catalogs) != 0 {
		t.Fatalf("expected 0 logs in empty workspace, got %d", invEmpty.TotalLogs)
	}
	emptyPrompt := invEmpty.FormatGroundedSystemPromptContext()
	if !strings.Contains(emptyPrompt, "Total Logs: 0") {
		t.Errorf("expected empty total logs count, got: %s", emptyPrompt)
	}

	// 2. Populate workspace with catalogs and logs (1 error in server2.log)
	_, _ = testDB.Conn.Exec(`INSERT INTO log_sources (id, workspace_id, name, path) VALUES ('src1', 'test-ws', 'server.log', '/path/server.log')`)
	_, _ = testDB.Conn.Exec(`INSERT INTO log_sources (id, workspace_id, name, path) VALUES ('src2', 'test-ws', 'server2.log', '/path/server2.log')`)

	_, _ = testDB.Conn.Exec(`INSERT INTO logs (id, workspace_id, source_id, level, raw_text, timestamp, cluster_id) VALUES (1, 'test-ws', 'src1', 'INFO', 'System started', '2025-05-26 00:00:00', 'c1')`)
	_, _ = testDB.Conn.Exec(`INSERT INTO logs (id, workspace_id, source_id, level, raw_text, timestamp, cluster_id) VALUES (2, 'test-ws', 'src1', 'INFO', 'Connection established', '2025-05-26 00:00:01', 'c1')`)
	_, _ = testDB.Conn.Exec(`INSERT INTO logs (id, workspace_id, source_id, level, raw_text, timestamp, cluster_id) VALUES (3, 'test-ws', 'src2', 'ERROR', 'Received unexpected referrer header: abort', '2025-05-26 00:01:14', 'c4')`)

	// 3. Populate cluster_triage
	_, _ = testDB.Conn.Exec(`CREATE TABLE IF NOT EXISTS cluster_triage (
		workspace_id TEXT,
		cluster_id TEXT,
		template TEXT,
		category TEXT,
		severity FLOAT,
		is_outage BOOLEAN,
		confidence FLOAT
	)`)
	_, err = testDB.Conn.Exec(`INSERT INTO cluster_triage (workspace_id, cluster_id, template, category, severity, is_outage, confidence) VALUES ('test-ws', 'c4', 'Received unexpected referrer header: <*> abort', 'network', 4.5, true, 0.95)`)
	if err != nil {
		t.Fatalf("failed to insert cluster_triage: %v", err)
	}

	inv, err := InspectWorkspace(testApp, "test-ws")
	if err != nil {
		t.Fatalf("InspectWorkspace test-ws failed: %v", err)
	}

	if inv.TotalLogs != 3 {
		t.Errorf("expected 3 total logs, got %d", inv.TotalLogs)
	}
	if inv.ErrorCount != 1 {
		t.Errorf("expected 1 error count, got %d", inv.ErrorCount)
	}
	if len(inv.Catalogs) != 2 {
		t.Errorf("expected 2 catalogs, got %d", len(inv.Catalogs))
	}
	if len(inv.RecentErrors) != 1 {
		t.Fatalf("expected 1 recent error snippet, got %d", len(inv.RecentErrors))
	}
	if inv.RecentErrors[0].SourceName != "server2.log" {
		t.Errorf("expected error in server2.log, got %s", inv.RecentErrors[0].SourceName)
	}
	if len(inv.ClusterTriages) != 1 {
		t.Fatalf("expected 1 cluster triage, got %d", len(inv.ClusterTriages))
	}
	if inv.ClusterTriages[0].Category != "network" || !inv.ClusterTriages[0].IsOutage {
		t.Errorf("expected network outage cluster, got %+v", inv.ClusterTriages[0])
	}

	prompt := inv.FormatGroundedSystemPromptContext()
	if !strings.Contains(prompt, "server2.log") {
		t.Errorf("expected prompt context to mention server2.log, got: %s", prompt)
	}
	if !strings.Contains(prompt, "server.log") {
		t.Errorf("expected prompt context to cite scanned server.log catalog, got: %s", prompt)
	}
	if !strings.Contains(prompt, "network") || !strings.Contains(prompt, "OUTAGE ALERT") {
		t.Errorf("expected prompt context to include Laya triage tags, got: %s", prompt)
	}
}
