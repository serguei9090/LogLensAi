package rag

import (
	"context"
	"path/filepath"
	"strings"
	"testing"

	loglensdb "loglensai/backend-go/internal/db"
)

func newTestDB(t *testing.T) *loglensdb.DB {
	t.Helper()
	path := filepath.Join(t.TempDir(), "ragtest.duckdb")
	d, err := loglensdb.Open(path)
	if err != nil {
		t.Fatalf("db.Open: %v", err)
	}
	t.Cleanup(func() { _ = d.Close() })
	return d
}

// TestSaveAndSearchMemoryRoundTrip exercises the full Service against a real
// temp DuckDB file (not :memory:, so it also exercises SetupVectorSearch's
// ALTER TABLE / index-creation path the same way a real deployment would),
// with the real ONNX embedder. It proves: (1) save+search round-trips
// end-to-end through DuckDB, (2) a semantically relevant saved memory ranks
// above an irrelevant one, (3) workspace_id properly isolates memories
// (also implicitly proving the query is parameterized rather than
// string-interpolated: a workspace_id containing a quote is used
// specifically to confirm no SQL-injection-style breakage, mirroring the
// rag_service.py `.where(f"workspace_id = '{workspace_id}'")` bug this port
// fixes).
func TestSaveAndSearchMemoryRoundTrip(t *testing.T) {
	d := newTestDB(t)
	embedder := newTestEmbedder(t)

	svc, err := NewService(d.Conn, embedder)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	t.Logf("VSS status: %+v", svc.VSSStatus())

	ctx := context.Background()
	// Deliberately includes a single quote, to prove workspace_id is bound
	// as a parameter rather than interpolated into SQL text the way
	// rag_service.py's Python does.
	workspaceA := `ws-a's-workspace`
	workspaceB := "ws-b"

	if err := svc.SaveMemory(ctx, workspaceA, "NullPointerException in OrderService.processPayment", "Add a null check before dereferencing customer.address"); err != nil {
		t.Fatalf("SaveMemory (a/npe): %v", err)
	}
	if err := svc.SaveMemory(ctx, workspaceA, "Disk usage at 95% on /var partition", "Rotate and compress old log files under /var/log"); err != nil {
		t.Fatalf("SaveMemory (a/disk): %v", err)
	}
	if err := svc.SaveMemory(ctx, workspaceB, "NullPointerException in OrderService.processPayment", "This memory belongs to a different workspace and must never be returned for workspace A searches"); err != nil {
		t.Fatalf("SaveMemory (b/npe): %v", err)
	}

	results, err := svc.SearchMemory(ctx, workspaceA, "OrderService throws NullPointerException on payment", 5)
	if err != nil {
		t.Fatalf("SearchMemory: %v", err)
	}
	if len(results) == 0 {
		t.Fatal("SearchMemory returned no results")
	}

	top := results[0]
	if !strings.Contains(top.IssueSignature, "NullPointerException") {
		t.Errorf("expected the NPE memory to rank first for a semantically similar query, got top result %q (distance=%v)", top.IssueSignature, top.Distance)
	}
	for _, r := range results {
		if strings.Contains(r.Resolution, "different workspace") {
			t.Errorf("workspace_id filtering leaked a memory from workspace B: %+v", r)
		}
	}
	if top.CreatedAt.IsZero() {
		t.Error("expected CreatedAt to be populated")
	}

	// Distances should be sorted ascending (nearest first).
	for i := 1; i < len(results); i++ {
		if results[i].Distance < results[i-1].Distance {
			t.Errorf("results not sorted by ascending distance: [%d]=%v < [%d]=%v", i, results[i].Distance, i-1, results[i-1].Distance)
		}
	}
}

// TestSaveMemoryUpsertsOnRepeatedIssueSignature confirms saving the same
// (workspace_id, issue_signature) twice replaces the resolution rather than
// accumulating a duplicate row -- forced by the pre-existing ai_memory
// PRIMARY KEY (workspace_id, issue_signature), unlike Python's LanceDB table
// which has no such constraint. See rag.go's SaveMemory doc comment.
func TestSaveMemoryUpsertsOnRepeatedIssueSignature(t *testing.T) {
	d := newTestDB(t)
	embedder := newTestEmbedder(t)
	svc, err := NewService(d.Conn, embedder)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	ctx := context.Background()

	if err := svc.SaveMemory(ctx, "ws", "connection timeout", "first resolution"); err != nil {
		t.Fatalf("first save: %v", err)
	}
	if err := svc.SaveMemory(ctx, "ws", "connection timeout", "second, corrected resolution"); err != nil {
		t.Fatalf("second save: %v", err)
	}

	var count int
	if err := d.Conn.QueryRow(`SELECT count(*) FROM ai_memory WHERE workspace_id = ? AND issue_signature = ?`, "ws", "connection timeout").Scan(&count); err != nil {
		t.Fatalf("count query: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected exactly 1 row after saving the same issue signature twice, got %d", count)
	}

	results, err := svc.SearchMemory(ctx, "ws", "connection timeout", 5)
	if err != nil {
		t.Fatalf("SearchMemory: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected exactly 1 search result, got %d", len(results))
	}
	if results[0].Resolution != "second, corrected resolution" {
		t.Errorf("expected the upserted resolution, got %q", results[0].Resolution)
	}
}
