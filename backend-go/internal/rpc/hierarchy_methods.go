package rpc

import (
	"encoding/json"

	"loglensai/backend-go/internal/app"
	"loglensai/backend-go/internal/models"
)

// RegisterHierarchyMethods overrides the hierarchy/folder/log-source and
// workspace-lifecycle stub registrations installed by RegisterStubs with
// real handlers backed by a live *app.App, following the exact pattern
// RegisterApp uses (see app_methods.go): each wrapper decodes params itself
// via appHandler (Dispatch only validates shape against the model registered
// via paramModels; it does not thread the decoded struct through to the
// handler — see dispatch.go).
//
// Covers sidecar/src/api.py's "--- Hierarchy Methods ---" section
// (get_hierarchy, create_folder, update_folder, delete_folder,
// create_log_source, update_log_source, delete_log_source, move_source) plus
// the workspace-lifecycle methods that live alongside them
// (get_workspace_sources, delete_workspace, purge_inactive_workspaces,
// factory_reset, get_time_boundaries).
//
// Not called from cmd/sidecar/main.go yet — intentionally left for a later
// wiring pass (see docs/migration/STATUS.md) so this addition doesn't
// conflict with other concurrent wiring work touching that file. Call
// RegisterStubs before this so the stub registrations this overrides exist
// first.
func RegisterHierarchyMethods(r *Registry, a *app.App) {
	r.RegisterWithModel("get_hierarchy", paramModels["get_hierarchy"], appHandler(func(req models.GetHierarchyRequest) (any, *models.RPCError) {
		return a.GetHierarchy(req)
	}))
	r.RegisterWithModel("create_folder", paramModels["create_folder"], appHandler(func(req models.FolderCreateRequest) (any, *models.RPCError) {
		return a.CreateFolder(req)
	}))
	r.RegisterWithModel("update_folder", paramModels["update_folder"], appHandler(func(req models.FolderUpdateRequest) (any, *models.RPCError) {
		return a.UpdateFolder(req)
	}))
	r.RegisterWithModel("delete_folder", paramModels["delete_folder"], appHandler(func(req models.FolderDeleteRequest) (any, *models.RPCError) {
		return a.DeleteFolder(req)
	}))
	r.RegisterWithModel("create_log_source", paramModels["create_log_source"], appHandler(func(req models.CreateLogSourceRequest) (any, *models.RPCError) {
		return a.CreateLogSource(req)
	}))
	r.RegisterWithModel("update_log_source", paramModels["update_log_source"], appHandler(func(req models.SourceUpdateRequest) (any, *models.RPCError) {
		return a.UpdateLogSource(req)
	}))
	r.RegisterWithModel("delete_log_source", paramModels["delete_log_source"], appHandler(func(req models.DeleteLogSourceRequest) (any, *models.RPCError) {
		return a.DeleteLogSource(req)
	}))
	r.RegisterWithModel("move_source", paramModels["move_source"], appHandler(func(req models.SourceMoveRequest) (any, *models.RPCError) {
		return a.MoveSource(req)
	}))
	r.RegisterWithModel("get_workspace_sources", paramModels["get_workspace_sources"], appHandler(func(req models.GetWorkspaceSourcesRequest) (any, *models.RPCError) {
		return a.GetWorkspaceSources(req)
	}))
	r.RegisterWithModel("delete_workspace", paramModels["delete_workspace"], appHandler(func(req models.DeleteWorkspaceRequest) (any, *models.RPCError) {
		return a.DeleteWorkspace(req)
	}))
	r.RegisterWithModel("purge_inactive_workspaces", paramModels["purge_inactive_workspaces"], appHandler(func(req models.PurgeInactiveWorkspacesRequest) (any, *models.RPCError) {
		return a.PurgeInactiveWorkspaces(req)
	}))
	r.RegisterWithModel("get_time_boundaries", paramModels["get_time_boundaries"], appHandler(func(req models.GetTimeBoundariesRequest) (any, *models.RPCError) {
		return a.GetTimeBoundaries(req)
	}))

	// factory_reset has no RPC_MODELS entry in api.py (mapped to None) and
	// takes no params, matching get_health's registration in RegisterApp.
	r.Register("factory_reset", func(params json.RawMessage) (any, *models.RPCError) {
		return a.FactoryReset()
	})
}
