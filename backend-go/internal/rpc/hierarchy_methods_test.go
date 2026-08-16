package rpc

import (
	"testing"

	"loglensai/backend-go/internal/models"
)

// newHierarchyTestRegistry builds a Registry with the stub set overridden by
// RegisterHierarchyMethods against a fresh in-memory *app.App, mirroring
// newSettingsTestRegistry in settings_methods_test.go. Reuses the
// package-level newTestApp helper already defined in ai_methods_test.go.
func newHierarchyTestRegistry(t *testing.T) *Registry {
	t.Helper()
	a := newTestApp(t)
	reg := NewRegistry()
	RegisterStubs(reg)
	RegisterHierarchyMethods(reg, a)
	return reg
}

// TestHierarchyMethods_EndToEnd exercises the RPC dispatch path (not just
// direct *app.App method calls, which internal/app/handlers_hierarchy_test.go
// already covers in depth) for a representative slice of the newly-wired
// methods, confirming RegisterHierarchyMethods actually plugs the real
// handlers in over the stub registrations and params validation works via
// the registered paramModels.
func TestHierarchyMethods_EndToEnd(t *testing.T) {
	reg := newHierarchyTestRegistry(t)
	ws := "ws1"

	createRes := dispatchOK(t, reg, "create_folder", models.FolderCreateRequest{WorkspaceID: ws, Name: "folder-a"}, 1)
	createMap, ok := createRes.(map[string]any)
	if !ok || createMap["status"] != "success" {
		t.Fatalf("create_folder: unexpected result %+v", createRes)
	}
	folderID, _ := createMap["folder_id"].(string)
	if folderID == "" {
		t.Fatal("create_folder: empty folder_id")
	}

	srcRes := dispatchOK(t, reg, "create_log_source", models.CreateLogSourceRequest{
		WorkspaceID: ws, Name: "src", Type: "file", Path: "/var/log/a.log", FolderID: &folderID,
	}, 2)
	srcMap := srcRes.(map[string]any)
	if srcMap["status"] != "success" || srcMap["source_id"] == "" {
		t.Fatalf("create_log_source: unexpected result %+v", srcRes)
	}

	hierRes := dispatchOK(t, reg, "get_hierarchy", models.GetHierarchyRequest{WorkspaceID: ws}, 3)
	hierarchy, ok := hierRes.(models.HierarchyResponse)
	if !ok {
		t.Fatalf("get_hierarchy: expected models.HierarchyResponse, got %T: %+v", hierRes, hierRes)
	}
	if len(hierarchy.Root.Children) != 1 || hierarchy.Root.Children[0].ID != folderID {
		t.Fatalf("get_hierarchy: expected folder-a at root, got %+v", hierarchy.Root)
	}
	if len(hierarchy.Root.Children[0].Sources) != 1 {
		t.Fatalf("get_hierarchy: expected source nested under folder-a, got %+v", hierarchy.Root.Children[0])
	}

	deleteRes := dispatchOK(t, reg, "delete_folder", models.FolderDeleteRequest{FolderID: folderID}, 4)
	if deleteRes.(map[string]any)["status"] != "success" {
		t.Fatalf("delete_folder: unexpected result %+v", deleteRes)
	}

	// factory_reset has no params model (mirrors get_health) -- confirm it
	// dispatches with empty/no params and actually wipes state.
	resetRes := dispatchOK(t, reg, "factory_reset", map[string]any{}, 5)
	if resetRes.(map[string]any)["status"] != "ok" {
		t.Fatalf("factory_reset: unexpected result %+v", resetRes)
	}

	hierAfterReset := dispatchOK(t, reg, "get_hierarchy", models.GetHierarchyRequest{WorkspaceID: ws}, 6)
	afterReset := hierAfterReset.(models.HierarchyResponse)
	if len(afterReset.Root.Children) != 0 || len(afterReset.Root.Sources) != 0 {
		t.Fatalf("expected empty hierarchy after factory_reset, got %+v", afterReset.Root)
	}
}
