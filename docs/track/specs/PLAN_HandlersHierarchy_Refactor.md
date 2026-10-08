# Refactoring Plan: Decompose `handlers_hierarchy.go` (734 lines)

## 1. Context & Motivation
- **File**: `backend-go/internal/app/handlers_hierarchy.go` (734 lines)
- **Goal**: Decompose into cohesive domain modules per the 400–500 line Go backend ceiling.
- **Problem**: This file bundles 3 distinct concerns:
  1. Hierarchy & folder tree assembly (`GetHierarchy`, `folderBuild`, `CreateFolder`, `UpdateFolder`, `DeleteFolder`, `MoveSource`).
  2. Log source CRUD & workspace source queries (`CreateLogSource`, `UpdateLogSource`, `DeleteLogSource`, `GetWorkspaceSources`, `GetTimeBoundaries`).
  3. Workspace lifecycle & system teardown (`DeleteWorkspace`, `PurgeInactiveWorkspaces`, `FactoryReset`).

---

## 2. Target File Structure (`backend-go/internal/app/`)

```
backend-go/internal/app/
├── handlers_hierarchy.go           (~220 lines) - GetHierarchy, CreateFolder, UpdateFolder, DeleteFolder, MoveSource
├── handlers_logsources.go          (~240 lines) - CreateLogSource, UpdateLogSource, DeleteLogSource, GetWorkspaceSources, GetTimeBoundaries
└── handlers_workspace_lifecycle.go (~240 lines) - DeleteWorkspace, PurgeInactiveWorkspaces, FactoryReset
```

---

## 3. Detailed Distribution of Functions

### 1. `handlers_hierarchy.go` (~220 lines)
- `type folderBuild struct { ... }`
- `func (a *App) GetHierarchy(req models.GetHierarchyRequest) (any, *models.RPCError)`
- `func (a *App) CreateFolder(req models.FolderCreateRequest) (any, *models.RPCError)`
- `func (a *App) UpdateFolder(req models.FolderUpdateRequest) (any, *models.RPCError)`
- `func (a *App) DeleteFolder(req models.FolderDeleteRequest) (any, *models.RPCError)`
- `func (a *App) MoveSource(req models.SourceMoveRequest) (any, *models.RPCError)`

### 2. `handlers_logsources.go` (~240 lines)
- `func (a *App) CreateLogSource(req models.CreateLogSourceRequest) (any, *models.RPCError)`
- `func (a *App) UpdateLogSource(req models.SourceUpdateRequest) (any, *models.RPCError)`
- `func (a *App) DeleteLogSource(req models.DeleteLogSourceRequest) (any, *models.RPCError)`
- `func (a *App) GetWorkspaceSources(req models.GetWorkspaceSourcesRequest) (any, *models.RPCError)`
- `func (a *App) GetTimeBoundaries(req models.GetTimeBoundariesRequest) (any, *models.RPCError)`

### 3. `handlers_workspace_lifecycle.go` (~240 lines)
- `func (a *App) DeleteWorkspace(req models.DeleteWorkspaceRequest) (any, *models.RPCError)`
- `func (a *App) PurgeInactiveWorkspaces(req models.PurgeInactiveWorkspacesRequest) (any, *models.RPCError)`
- `func (a *App) FactoryReset() (any, *models.RPCError)`

---

## 4. Verification Plan
1. Ensure all methods stay in `package app` (direct receiver on `*App`, zero changes to RPC registration).
2. Run `go vet ./...` in `backend-go/`.
3. Run `go test ./...` in `backend-go/`.
4. Update `docs/track/CodeDebt_Monolith_Refactor.md`.
