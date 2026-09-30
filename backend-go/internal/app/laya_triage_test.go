// Assume Role: The Automation Engineer (@test)

package app

import (
	"path/filepath"
	"testing"
	"time"

	"loglensai/backend-go/internal/db"
)

func TestLayaClusterTriager_AsyncTriage(t *testing.T) {
	tmpDir := t.TempDir()
	dbFile := filepath.Join(tmpDir, "test_triage.duckdb")

	a, err := NewApp(dbFile)
	if err != nil {
		t.Fatalf("NewApp failed: %v", err)
	}
	defer a.Close()

	// 1. Enable Laya settings so triager will process
	_ = a.LayaManager.UpdateSettings(true, "cpu")

	triager := NewLayaClusterTriager(a)

	// 2. Feed cluster templates
	templates := map[string]string{
		"101": "Connection pool exhausted: 150/150 connections active in postgres",
		"102": "Failed to connect to auth server at 10.0.0.1:443: connection refused",
		"103": "Fatal crash: kernel panic out of memory outage on node-04",
	}

	triager.TriageClustersAsync("ws_test", templates)

	// 3. Poll DB for triage records
	deadline := time.Now().Add(5 * time.Second)
	var triageMap map[string]db.ClusterTriage
	for time.Now().Before(deadline) {
		triageMap, err = a.DB.GetClusterTriageMap("ws_test")
		if err == nil && len(triageMap) == 3 {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}

	if len(triageMap) != 3 {
		t.Fatalf("expected 3 triage records in DB, got %d (err: %v)", len(triageMap), err)
	}

	// 4. Verify postgres connection pool classified as database
	rec101 := triageMap["101"]
	if rec101.Category != "database" {
		t.Errorf("expected cluster 101 category 'database', got %q", rec101.Category)
	}

	// 5. Verify crash classified with outage
	rec103 := triageMap["103"]
	if !rec103.IsOutage {
		t.Errorf("expected cluster 103 IsOutage = true")
	}
	if rec103.Severity < 3.0 {
		t.Errorf("expected cluster 103 severity >= 3.0, got %f", rec103.Severity)
	}

	// 6. Verify single cluster triage fetch
	single, err := a.DB.GetClusterTriage("ws_test", "101")
	if err != nil || single == nil {
		t.Fatalf("GetClusterTriage failed: %v, single: %+v", err, single)
	}
	if single.Category != "database" {
		t.Errorf("expected single category 'database', got %q", single.Category)
	}
}

func TestLayaClusterTriager_DisabledWhenSettingOff(t *testing.T) {
	tmpDir := t.TempDir()
	dbFile := filepath.Join(tmpDir, "test_triage_off.duckdb")

	a, err := NewApp(dbFile)
	if err != nil {
		t.Fatalf("NewApp failed: %v", err)
	}
	defer a.Close()

	// Ensure Laya is disabled
	_ = a.LayaManager.UpdateSettings(false, "cpu")

	triager := NewLayaClusterTriager(a)
	templates := map[string]string{
		"201": "Some error message in app",
	}

	triager.TriageClustersAsync("ws_disabled", templates)
	time.Sleep(100 * time.Millisecond)

	triageMap, err := a.DB.GetClusterTriageMap("ws_disabled")
	if err != nil {
		t.Fatalf("GetClusterTriageMap failed: %v", err)
	}
	if len(triageMap) != 0 {
		t.Errorf("expected 0 records when Laya is disabled, got %d", len(triageMap))
	}
}
