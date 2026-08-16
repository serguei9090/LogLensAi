package app

import (
	"database/sql"
	"os"
	"path/filepath"
	"sort"
	"testing"

	"loglensai/backend-go/internal/models"
)

// newHierarchyTestApp constructs a real *App backed by a temp-file DuckDB
// database (not db.MemoryDB) so that a.dataDir resolves to an isolated
// per-test temp directory (see resolveDataDir in app.go) -- required for the
// physical-storage-file and factory_reset tests below, which must be able to
// assert real files were created/deleted without touching anything outside
// the test's own sandbox.
func newHierarchyTestApp(t *testing.T) *App {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "test.duckdb")
	a, err := NewApp(dbPath)
	if err != nil {
		t.Fatalf("NewApp: %v", err)
	}
	t.Cleanup(func() {
		_ = a.Close()
	})
	return a
}

// asMap asserts an RPC handler's (any, *models.RPCError) result succeeded
// and its payload is a map[string]any, returning that map.
func hierarchyAsMap(t *testing.T, res any, rpcErr *models.RPCError) map[string]any {
	t.Helper()
	if rpcErr != nil {
		t.Fatalf("unexpected RPC error: %+v", rpcErr)
	}
	m, ok := res.(map[string]any)
	if !ok {
		t.Fatalf("expected map[string]any result, got %T: %+v", res, res)
	}
	return m
}

func hierarchyStrPtr(s string) *string { return &s }

// --- folders ---

func TestFolderCRUDAndHierarchyNesting(t *testing.T) {
	a := newHierarchyTestApp(t)
	ws := "ws1"

	res, rpcErr := a.CreateFolder(models.FolderCreateRequest{WorkspaceID: ws, Name: "A"})
	rootRes := hierarchyAsMap(t, res, rpcErr)
	folderA := rootRes["folder_id"].(string)

	res, rpcErr = a.CreateFolder(models.FolderCreateRequest{WorkspaceID: ws, Name: "B", ParentID: &folderA})
	childRes := hierarchyAsMap(t, res, rpcErr)
	folderB := childRes["folder_id"].(string)

	hRes, rpcErr := a.GetHierarchy(models.GetHierarchyRequest{WorkspaceID: ws})
	if rpcErr != nil {
		t.Fatalf("GetHierarchy: %+v", rpcErr)
	}
	hierarchy := hRes.(models.HierarchyResponse)
	if hierarchy.WorkspaceID != ws {
		t.Errorf("workspace_id = %q, want %q", hierarchy.WorkspaceID, ws)
	}
	if len(hierarchy.Root.Children) != 1 || hierarchy.Root.Children[0].ID != folderA {
		t.Fatalf("expected exactly root child A, got %+v", hierarchy.Root.Children)
	}
	if hierarchy.Root.Children[0].Type != "folder" {
		t.Errorf("folder node Type = %q, want \"folder\"", hierarchy.Root.Children[0].Type)
	}
	if len(hierarchy.Root.Children[0].Children) != 1 || hierarchy.Root.Children[0].Children[0].ID != folderB {
		t.Fatalf("expected A to nest B, got %+v", hierarchy.Root.Children[0].Children)
	}

	// Rename A; a no-op/empty-string rename must be silently ignored
	// (mirrors db.py's `if name:` truthy check bit-for-bit).
	if _, rpcErr := a.UpdateFolder(models.FolderUpdateRequest{FolderID: folderA, Name: hierarchyStrPtr("A2")}); rpcErr != nil {
		t.Fatalf("UpdateFolder (rename): %+v", rpcErr)
	}
	if _, rpcErr := a.UpdateFolder(models.FolderUpdateRequest{FolderID: folderA, Name: hierarchyStrPtr("")}); rpcErr != nil {
		t.Fatalf("UpdateFolder (empty name): %+v", rpcErr)
	}

	// Move B to root via an explicit empty-string parent_id.
	_, rpcErr = a.UpdateFolder(models.FolderUpdateRequest{FolderID: folderB, ParentID: hierarchyStrPtr("")})
	if rpcErr != nil {
		t.Fatalf("UpdateFolder (move to root): %+v", rpcErr)
	}

	hRes2, rpcErr := a.GetHierarchy(models.GetHierarchyRequest{WorkspaceID: ws})
	if rpcErr != nil {
		t.Fatalf("GetHierarchy after update: %+v", rpcErr)
	}
	hierarchy2 := hRes2.(models.HierarchyResponse)
	if len(hierarchy2.Root.Children) != 2 {
		t.Fatalf("expected A2 and B both at root after move, got %+v", hierarchy2.Root.Children)
	}
	names := map[string]bool{}
	for _, n := range hierarchy2.Root.Children {
		names[n.Name] = true
		if len(n.Children) != 0 {
			t.Errorf("node %s should have no children after B moved out, got %+v", n.Name, n.Children)
		}
	}
	if !names["A2"] || !names["B"] {
		t.Fatalf("expected A2 (renamed) and B at root, got names=%v", names)
	}

	// Re-nest a fresh child C under A2, then delete A2: C must be PROMOTED
	// to root (parent_id -> NULL), not cascade-deleted, matching db.py's
	// delete_folder exactly.
	res, rpcErr = a.CreateFolder(models.FolderCreateRequest{WorkspaceID: ws, Name: "C", ParentID: &folderA})
	cRes := hierarchyAsMap(t, res, rpcErr)
	folderC := cRes["folder_id"].(string)

	if _, rpcErr := a.DeleteFolder(models.FolderDeleteRequest{FolderID: folderA}); rpcErr != nil {
		t.Fatalf("DeleteFolder: %+v", rpcErr)
	}

	hRes3, rpcErr := a.GetHierarchy(models.GetHierarchyRequest{WorkspaceID: ws})
	if rpcErr != nil {
		t.Fatalf("GetHierarchy after delete: %+v", rpcErr)
	}
	hierarchy3 := hRes3.(models.HierarchyResponse)
	foundC := false
	for _, n := range hierarchy3.Root.Children {
		if n.ID == folderA {
			t.Fatalf("deleted folder A2 still present: %+v", n)
		}
		if n.ID == folderC {
			foundC = true
		}
	}
	if !foundC {
		t.Fatalf("expected C promoted to root after parent A2 deleted, got %+v", hierarchy3.Root.Children)
	}
}

// --- log sources ---

func TestLogSourceCRUDAndPartialUpdateSafety(t *testing.T) {
	a := newHierarchyTestApp(t)
	ws := "ws1"

	res, rpcErr := a.CreateFolder(models.FolderCreateRequest{WorkspaceID: ws, Name: "F"})
	folderRes := hierarchyAsMap(t, res, rpcErr)
	folderID := folderRes["folder_id"].(string)

	res, rpcErr = a.CreateLogSource(models.CreateLogSourceRequest{
		WorkspaceID: ws, Name: "src1", Type: "file", Path: "/var/log/a.log",
	})
	srcRes := hierarchyAsMap(t, res, rpcErr)
	sourceID := srcRes["source_id"].(string)

	// Partial update: only Name given. Type/Path/FolderID must be left
	// completely untouched -- this is the deliberate deviation from
	// Python's apparent update_log_source bug (see UpdateLogSource's doc
	// comment in handlers_hierarchy.go).
	if _, rpcErr := a.UpdateLogSource(models.SourceUpdateRequest{SourceID: sourceID, Name: hierarchyStrPtr("renamed")}); rpcErr != nil {
		t.Fatalf("UpdateLogSource: %+v", rpcErr)
	}

	var name, sType, path string
	var folderIDCol sql.NullString
	row := a.DB.Conn.QueryRow(`SELECT name, type, path, folder_id FROM log_sources WHERE id = ?`, sourceID)
	if err := row.Scan(&name, &sType, &path, &folderIDCol); err != nil {
		t.Fatalf("querying log_sources: %v", err)
	}
	if name != "renamed" {
		t.Errorf("name = %q, want \"renamed\"", name)
	}
	if sType != "file" {
		t.Errorf("type was wiped by a partial update: got %q, want \"file\"", sType)
	}
	if path != "/var/log/a.log" {
		t.Errorf("path was wiped by a partial update: got %q, want \"/var/log/a.log\"", path)
	}
	if folderIDCol.Valid {
		t.Errorf("folder_id should still be NULL, got %q", folderIDCol.String)
	}

	// MoveSource attaches it to folderID.
	if _, rpcErr := a.MoveSource(models.SourceMoveRequest{SourceID: sourceID, FolderID: &folderID}); rpcErr != nil {
		t.Fatalf("MoveSource: %+v", rpcErr)
	}

	hRes, rpcErr := a.GetHierarchy(models.GetHierarchyRequest{WorkspaceID: ws})
	if rpcErr != nil {
		t.Fatalf("GetHierarchy: %+v", rpcErr)
	}
	hierarchy := hRes.(models.HierarchyResponse)
	if len(hierarchy.Root.Children) != 1 || len(hierarchy.Root.Children[0].Sources) != 1 {
		t.Fatalf("expected source nested under F, got %+v", hierarchy.Root.Children)
	}
	if hierarchy.Root.Children[0].Sources[0].ID != sourceID {
		t.Fatalf("nested source id = %q, want %q", hierarchy.Root.Children[0].Sources[0].ID, sourceID)
	}

	// Write real physical storage for this source, then delete it and
	// confirm both DB rows and physical files are gone.
	if _, err := a.LogStore.AppendLine(sourceID, "hello world"); err != nil {
		t.Fatalf("AppendLine: %v", err)
	}
	logPath := a.LogStore.FilePath(sourceID)
	if _, err := os.Stat(logPath); err != nil {
		t.Fatalf("expected physical log file to exist before delete: %v", err)
	}
	if _, err := a.DB.Conn.Exec(`INSERT INTO logs (workspace_id, source_id, raw_text) VALUES (?, ?, ?)`, ws, sourceID, "hello world"); err != nil {
		t.Fatalf("inserting logs row: %v", err)
	}

	if _, rpcErr := a.DeleteLogSource(models.DeleteLogSourceRequest{SourceID: sourceID}); rpcErr != nil {
		t.Fatalf("DeleteLogSource: %+v", rpcErr)
	}

	var count int
	if err := a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM log_sources WHERE id = ?`, sourceID).Scan(&count); err != nil {
		t.Fatalf("querying log_sources after delete: %v", err)
	}
	if count != 0 {
		t.Errorf("log_sources row still present after DeleteLogSource")
	}
	if err := a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM logs WHERE source_id = ?`, sourceID).Scan(&count); err != nil {
		t.Fatalf("querying logs after delete: %v", err)
	}
	if count != 0 {
		t.Errorf("logs rows still present after DeleteLogSource")
	}
	if _, err := os.Stat(logPath); !os.IsNotExist(err) {
		t.Errorf("expected physical log file removed after DeleteLogSource, stat err = %v", err)
	}
}

// --- get_workspace_sources ---

func TestGetWorkspaceSources(t *testing.T) {
	a := newHierarchyTestApp(t)
	ws := "ws1"

	if _, err := a.DB.Conn.Exec(`INSERT INTO logs (workspace_id, source_id, raw_text) VALUES (?, ?, ?)`, ws, "src-id-1", "x"); err != nil {
		t.Fatalf("insert logs: %v", err)
	}
	// Mirrors Python's actual (arguably buggy) behavior: log_sources.path is
	// unioned in, not log_sources.id -- see GetWorkspaceSources's doc
	// comment for why this is preserved rather than "fixed".
	if _, err := a.DB.Conn.Exec(`INSERT INTO log_sources (id, workspace_id, name, type, path) VALUES (?, ?, ?, ?, ?)`,
		"src-id-2", ws, "s2", "file", "/var/log/b.log"); err != nil {
		t.Fatalf("insert log_sources: %v", err)
	}

	res, rpcErr := a.GetWorkspaceSources(models.GetWorkspaceSourcesRequest{WorkspaceID: ws})
	if rpcErr != nil {
		t.Fatalf("GetWorkspaceSources: %+v", rpcErr)
	}
	got, ok := res.([]string)
	if !ok {
		t.Fatalf("expected []string, got %T", res)
	}
	sort.Strings(got)
	want := []string{"/var/log/b.log", "src-id-1"}
	if len(got) != len(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("got[%d] = %q, want %q (full: %v)", i, got[i], want[i], got)
		}
	}
}

// --- get_time_boundaries ---

func TestGetTimeBoundaries(t *testing.T) {
	a := newHierarchyTestApp(t)
	ws := "ws1"

	empty, rpcErr := a.GetTimeBoundaries(models.GetTimeBoundariesRequest{WorkspaceID: ws})
	if rpcErr != nil {
		t.Fatalf("GetTimeBoundaries (empty): %+v", rpcErr)
	}
	emptyMap := empty.(map[string]any)
	if emptyMap["min_time"] != "" || emptyMap["max_time"] != "" {
		t.Fatalf("expected empty min/max for a workspace with no logs, got %+v", emptyMap)
	}

	rows := []struct{ sourceID, ts string }{
		{"s1", "2024-01-01 00:00:00"},
		{"s1", "2024-06-01 00:00:00"},
		{"s2", "2024-12-01 00:00:00"},
	}
	for _, r := range rows {
		if _, err := a.DB.Conn.Exec(`INSERT INTO logs (workspace_id, source_id, raw_text, timestamp) VALUES (?, ?, 'x', ?)`,
			ws, r.sourceID, r.ts); err != nil {
			t.Fatalf("insert: %v", err)
		}
	}

	all, rpcErr := a.GetTimeBoundaries(models.GetTimeBoundariesRequest{WorkspaceID: ws})
	if rpcErr != nil {
		t.Fatalf("GetTimeBoundaries (all): %+v", rpcErr)
	}
	allMap := all.(map[string]any)
	if allMap["min_time"] != "2024-01-01 00:00:00" || allMap["max_time"] != "2024-12-01 00:00:00" {
		t.Fatalf("unexpected bounds across all sources: %+v", allMap)
	}

	scoped, rpcErr := a.GetTimeBoundaries(models.GetTimeBoundariesRequest{WorkspaceID: ws, SourceIDs: []string{"s1"}})
	if rpcErr != nil {
		t.Fatalf("GetTimeBoundaries (scoped): %+v", rpcErr)
	}
	scopedMap := scoped.(map[string]any)
	if scopedMap["min_time"] != "2024-01-01 00:00:00" || scopedMap["max_time"] != "2024-06-01 00:00:00" {
		t.Fatalf("unexpected bounds scoped to s1: %+v", scopedMap)
	}
}

// --- delete_workspace ---

func seedWorkspaceData(t *testing.T, a *App, ws string) {
	t.Helper()
	exec := func(query string, args ...any) {
		t.Helper()
		if _, err := a.DB.Conn.Exec(query, args...); err != nil {
			t.Fatalf("seed exec %q: %v", query, err)
		}
	}
	sourceID := ws + "-src"
	exec(`INSERT INTO log_sources (id, workspace_id, name, type, path) VALUES (?, ?, 's', 'file', '/x.log')`, sourceID, ws)
	exec(`INSERT INTO folders (id, workspace_id, name) VALUES (?, ?, 'f')`, ws+"-folder", ws)
	exec(`INSERT INTO logs (workspace_id, source_id, raw_text) VALUES (?, ?, 'x')`, ws, sourceID)
	exec(`INSERT INTO clusters (workspace_id, cluster_id, template, count) VALUES (?, 'c1', 't', 1)`, ws)
	exec(`INSERT INTO ingestion_jobs (workspace_id, source_id) VALUES (?, ?)`, ws, sourceID)
	exec(`INSERT INTO anomalies (workspace_id, cluster_id, z_score, current_rate, mean_rate) VALUES (?, 'c1', 1.0, 1.0, 1.0)`, ws)
	exec(`INSERT INTO ai_sessions (session_id, workspace_id, name) VALUES (?, ?, 'sess')`, ws+"-sess", ws)
	exec(`INSERT INTO ai_messages (session_id, role, content) VALUES (?, 'user', 'hi')`, ws+"-sess")
	exec(`INSERT INTO ai_memory (workspace_id, issue_signature, resolution) VALUES (?, 'sig', 'res')`, ws)
	exec(`INSERT INTO temporal_offsets (workspace_id, source_id, offset_seconds) VALUES (?, ?, 5)`, ws, sourceID)
	exec(`INSERT INTO fusion_configs (workspace_id, fusion_id, source_id) VALUES (?, 'default', ?)`, ws, sourceID)
	exec(`INSERT INTO workspace_settings (workspace_id, key, value) VALUES (?, 'k', 'v')`, ws)
	exec(`INSERT INTO settings_templates (workspace_id, name, config_json) VALUES (?, 'tpl', '{}')`, ws)
	exec(`INSERT INTO log_streams (workspace_id, name, type, port) VALUES (?, 'stream', 'syslog', 5140)`, ws)

	if _, err := a.LogStore.AppendLine(sourceID, "physical line"); err != nil {
		t.Fatalf("AppendLine: %v", err)
	}
}

func countWorkspaceRows(t *testing.T, a *App, ws string) map[string]int {
	t.Helper()
	tables := map[string]string{
		"log_sources":        "workspace_id",
		"folders":            "workspace_id",
		"logs":               "workspace_id",
		"clusters":           "workspace_id",
		"ingestion_jobs":     "workspace_id",
		"anomalies":          "workspace_id",
		"ai_sessions":        "workspace_id",
		"ai_memory":          "workspace_id",
		"temporal_offsets":   "workspace_id",
		"fusion_configs":     "workspace_id",
		"workspace_settings": "workspace_id",
		"settings_templates": "workspace_id",
		"log_streams":        "workspace_id",
	}
	out := make(map[string]int)
	for table, col := range tables {
		var n int
		if err := a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM `+table+` WHERE `+col+` = ?`, ws).Scan(&n); err != nil {
			t.Fatalf("counting %s: %v", table, err)
		}
		out[table] = n
	}
	var aiMsgCount int
	_ = a.DB.Conn.QueryRow(
		`SELECT COUNT(*) FROM ai_messages WHERE session_id IN (SELECT session_id FROM ai_sessions WHERE workspace_id = ?)`, ws,
	).Scan(&aiMsgCount) // a gone ai_sessions row for ws legitimately yields a 0-row subquery, not an error worth failing on here.
	out["ai_messages"] = aiMsgCount
	return out
}

func TestDeleteWorkspace(t *testing.T) {
	a := newHierarchyTestApp(t)
	wsDelete := "ws-delete"
	wsKeep := "ws-keep"

	seedWorkspaceData(t, a, wsDelete)
	seedWorkspaceData(t, a, wsKeep)

	// Start a tailer for the workspace being deleted so we can confirm
	// DeleteWorkspace stops it.
	tailPath := filepath.Join(t.TempDir(), "tail.log")
	if err := os.WriteFile(tailPath, []byte("line1\n"), 0o644); err != nil {
		t.Fatalf("writing tail file: %v", err)
	}
	if _, rpcErr := a.StartTail(models.StartTailRequest{Filepath: tailPath, WorkspaceID: wsDelete}); rpcErr != nil {
		t.Fatalf("StartTail: %+v", rpcErr)
	}
	if !a.IsTailing(tailPath, wsDelete) {
		t.Fatal("expected tailer to be running before delete_workspace")
	}

	logPath := a.LogStore.FilePath(wsDelete + "-src")
	if _, err := os.Stat(logPath); err != nil {
		t.Fatalf("expected physical file to exist before delete: %v", err)
	}

	if _, rpcErr := a.DeleteWorkspace(models.DeleteWorkspaceRequest{WorkspaceID: wsDelete}); rpcErr != nil {
		t.Fatalf("DeleteWorkspace: %+v", rpcErr)
	}

	if a.IsTailing(tailPath, wsDelete) {
		t.Error("expected tailer for deleted workspace to be stopped")
	}

	deleted := countWorkspaceRows(t, a, wsDelete)
	for table, n := range deleted {
		if n != 0 {
			t.Errorf("table %s still has %d row(s) for deleted workspace %s", table, n, wsDelete)
		}
	}

	kept := countWorkspaceRows(t, a, wsKeep)
	for table, n := range kept {
		if n == 0 {
			t.Errorf("table %s unexpectedly empty for untouched workspace %s", table, wsKeep)
		}
	}

	if _, err := os.Stat(logPath); !os.IsNotExist(err) {
		t.Errorf("expected physical storage file removed for deleted workspace's source, stat err = %v", err)
	}
}

// --- purge_inactive_workspaces ---

func TestPurgeInactiveWorkspaces(t *testing.T) {
	a := newHierarchyTestApp(t)
	active := "ws-active"
	inactive := "ws-inactive"

	for _, ws := range []string{active, inactive} {
		if _, err := a.DB.Conn.Exec(`INSERT INTO logs (workspace_id, source_id, raw_text) VALUES (?, 's', 'x')`, ws); err != nil {
			t.Fatalf("insert logs: %v", err)
		}
		if _, err := a.DB.Conn.Exec(`INSERT INTO clusters (workspace_id, cluster_id, template, count) VALUES (?, 'c1', 't', 1)`, ws); err != nil {
			t.Fatalf("insert clusters: %v", err)
		}
		if _, err := a.DB.Conn.Exec(`INSERT INTO workspace_settings (workspace_id, key, value) VALUES (?, 'k', 'v')`, ws); err != nil {
			t.Fatalf("insert workspace_settings: %v", err)
		}
	}
	// Folders/log_sources for the inactive workspace must survive a purge --
	// only DeleteWorkspace tears those down, not PurgeInactiveWorkspaces
	// (see PurgeInactiveWorkspaces's doc comment).
	if _, err := a.DB.Conn.Exec(`INSERT INTO folders (id, workspace_id, name) VALUES ('f1', ?, 'f')`, inactive); err != nil {
		t.Fatalf("insert folders: %v", err)
	}

	errRes, rpcErr := a.PurgeInactiveWorkspaces(models.PurgeInactiveWorkspacesRequest{})
	if rpcErr != nil {
		t.Fatalf("PurgeInactiveWorkspaces (empty active list): %+v", rpcErr)
	}
	if errRes.(map[string]any)["status"] != "error" {
		t.Fatalf("expected status=error for an empty active_workspace_ids list, got %+v", errRes)
	}

	res, rpcErr := a.PurgeInactiveWorkspaces(models.PurgeInactiveWorkspacesRequest{ActiveWorkspaceIDs: []string{active}})
	if rpcErr != nil {
		t.Fatalf("PurgeInactiveWorkspaces: %+v", rpcErr)
	}
	resMap := res.(map[string]any)
	if resMap["status"] != "ok" {
		t.Fatalf("expected status=ok, got %+v", resMap)
	}

	var n int
	if err := a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM logs WHERE workspace_id = ?`, inactive).Scan(&n); err != nil || n != 0 {
		t.Errorf("expected inactive workspace's logs purged, count=%d err=%v", n, err)
	}
	if err := a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM clusters WHERE workspace_id = ?`, inactive).Scan(&n); err != nil || n != 0 {
		t.Errorf("expected inactive workspace's clusters purged, count=%d err=%v", n, err)
	}
	if err := a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM workspace_settings WHERE workspace_id = ?`, inactive).Scan(&n); err != nil || n != 0 {
		t.Errorf("expected inactive workspace's workspace_settings purged, count=%d err=%v", n, err)
	}
	if err := a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM folders WHERE workspace_id = ?`, inactive).Scan(&n); err != nil || n != 1 {
		t.Errorf("expected inactive workspace's folders NOT purged, count=%d err=%v", n, err)
	}

	if err := a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM logs WHERE workspace_id = ?`, active).Scan(&n); err != nil || n != 1 {
		t.Errorf("expected active workspace's logs untouched, count=%d err=%v", n, err)
	}
}

// --- factory_reset ---

func TestFactoryReset(t *testing.T) {
	a := newHierarchyTestApp(t)
	ws := "ws1"

	if _, rpcErr := a.CreateFolder(models.FolderCreateRequest{WorkspaceID: ws, Name: "F"}); rpcErr != nil {
		t.Fatalf("CreateFolder: %+v", rpcErr)
	}
	res, rpcErr := a.CreateLogSource(models.CreateLogSourceRequest{WorkspaceID: ws, Name: "s", Type: "file", Path: "/x.log"})
	srcRes := hierarchyAsMap(t, res, rpcErr)
	sourceID := srcRes["source_id"].(string)
	if _, err := a.LogStore.AppendLine(sourceID, "hello"); err != nil {
		t.Fatalf("AppendLine: %v", err)
	}
	if _, err := a.DB.Conn.Exec(`INSERT INTO logs (workspace_id, source_id, raw_text) VALUES (?, ?, 'x')`, ws, sourceID); err != nil {
		t.Fatalf("insert logs: %v", err)
	}

	storageDir := filepath.Join(a.DataDir(), "storage")
	logFile := a.LogStore.FilePath(sourceID)
	if _, err := os.Stat(logFile); err != nil {
		t.Fatalf("expected physical log file before reset: %v", err)
	}
	dbFile := a.DB.Path
	if _, err := os.Stat(dbFile); err != nil {
		t.Fatalf("expected db file to exist before reset: %v", err)
	}

	resetRes, rpcErr := a.FactoryReset()
	if rpcErr != nil {
		t.Fatalf("FactoryReset: %+v", rpcErr)
	}
	resetMap := resetRes.(map[string]any)
	if resetMap["status"] != "ok" {
		t.Fatalf("expected status=ok, got %+v", resetMap)
	}

	var n int
	if err := a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM logs`).Scan(&n); err != nil {
		t.Fatalf("querying logs post-reset: %v", err)
	}
	if n != 0 {
		t.Errorf("expected 0 logs rows post-reset, got %d", n)
	}
	if err := a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM folders`).Scan(&n); err != nil {
		t.Fatalf("querying folders post-reset: %v", err)
	}
	if n != 0 {
		t.Errorf("expected 0 folders rows post-reset, got %d", n)
	}
	if err := a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM log_sources`).Scan(&n); err != nil {
		t.Fatalf("querying log_sources post-reset: %v", err)
	}
	if n != 0 {
		t.Errorf("expected 0 log_sources rows post-reset, got %d", n)
	}

	if _, err := os.Stat(logFile); !os.IsNotExist(err) {
		t.Errorf("expected physical log file removed post-reset, stat err = %v", err)
	}
	if _, err := os.Stat(a.drainDir); !os.IsNotExist(err) {
		t.Errorf("expected drain dir removed post-reset, stat err = %v", err)
	}

	// The app must remain fully usable after reset: a new storage dir was
	// recreated, and CRUD works against the freshly reopened DB.
	if _, err := os.Stat(storageDir); err != nil {
		t.Errorf("expected storage dir recreated post-reset: %v", err)
	}
	postRes, rpcErr := a.CreateFolder(models.FolderCreateRequest{WorkspaceID: ws, Name: "post-reset"})
	postMap := hierarchyAsMap(t, postRes, rpcErr)
	if postMap["folder_id"] == "" {
		t.Error("expected CreateFolder to work after factory reset")
	}
	if err := a.DB.Conn.QueryRow(`SELECT COUNT(*) FROM folders`).Scan(&n); err != nil || n != 1 {
		t.Errorf("expected exactly 1 folder after post-reset create, count=%d err=%v", n, err)
	}

	// Reset scope: nothing outside a.dataDir was touched -- the test's own
	// TempDir is a.dataDir itself here (dbPath's dir *is* a.dataDir, see
	// resolveDataDir), so verifying the directory itself still exists and is
	// exactly where we left it is a reasonable proxy for "reset stayed
	// inside its own sandbox".
	if _, err := os.Stat(a.DataDir()); err != nil {
		t.Errorf("expected app data dir itself to still exist post-reset: %v", err)
	}
}
