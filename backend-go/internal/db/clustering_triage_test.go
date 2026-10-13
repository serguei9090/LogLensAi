package db

import (
	"testing"
)

func TestClusterTriage_UpsertAndGet(t *testing.T) {
	d, err := Open(MemoryDB)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer d.Close()

	if err := d.InitClusterTriageTable(); err != nil {
		t.Fatalf("InitClusterTriageTable: %v", err)
	}

	wsID := "test-ws"
	cID := "42"

	// 1. Initial Upsert via UpsertClusterRAGTag
	err = d.UpsertClusterRAGTag(wsID, cID, "connection timeout <*> to redis", true, "🟡 KNOWN ISSUE (Matches resolution in memory)", "connection timeout to redis", "Restart redis pod", 0.92)
	if err != nil {
		t.Fatalf("UpsertClusterRAGTag: %v", err)
	}

	// 2. Fetch single triage
	triage, err := d.GetClusterTriage(wsID, cID)
	if err != nil {
		t.Fatalf("GetClusterTriage: %v", err)
	}
	if triage == nil {
		t.Fatal("expected triage record, got nil")
	}
	if !triage.IsKnownIssue {
		t.Errorf("expected is_known_issue true, got %v", triage.IsKnownIssue)
	}
	if triage.RAGTag != "🟡 KNOWN ISSUE (Matches resolution in memory)" {
		t.Errorf("unexpected rag_tag: %s", triage.RAGTag)
	}
	if triage.MatchedSignature != "connection timeout to redis" {
		t.Errorf("unexpected matched_signature: %s", triage.MatchedSignature)
	}
	if triage.KnownResolution != "Restart redis pod" {
		t.Errorf("unexpected known_resolution: %s", triage.KnownResolution)
	}
	if triage.MatchScore < 0.91 || triage.MatchScore > 0.93 {
		t.Errorf("unexpected match_score: %f", triage.MatchScore)
	}

	// 3. Upsert update (conflict handling)
	err = d.UpsertClusterRAGTag(wsID, cID, "", false, "🔴 NEW ANOMALY (First occurrence)", "", "", 0.35)
	if err != nil {
		t.Fatalf("UpsertClusterRAGTag update: %v", err)
	}

	triageUpdated, err := d.GetClusterTriage(wsID, cID)
	if err != nil {
		t.Fatalf("GetClusterTriage after update: %v", err)
	}
	// Template should not be overwritten by empty string due to CASE WHEN
	if triageUpdated.Template != "connection timeout <*> to redis" {
		t.Errorf("expected template to be preserved, got %s", triageUpdated.Template)
	}
	if triageUpdated.IsKnownIssue {
		t.Errorf("expected is_known_issue false after update, got %v", triageUpdated.IsKnownIssue)
	}
	if triageUpdated.RAGTag != "🔴 NEW ANOMALY (First occurrence)" {
		t.Errorf("unexpected rag_tag: %s", triageUpdated.RAGTag)
	}

	// 4. Test GetClusterTriageMap
	triageMap, err := d.GetClusterTriageMap(wsID)
	if err != nil {
		t.Fatalf("GetClusterTriageMap: %v", err)
	}
	if len(triageMap) != 1 {
		t.Errorf("expected 1 triage entry, got %d", len(triageMap))
	}
	if entry, ok := triageMap[cID]; !ok || entry.ClusterID != cID {
		t.Errorf("cluster %s not found in triageMap", cID)
	}
}
