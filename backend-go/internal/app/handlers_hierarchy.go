package app

import (
	"database/sql"

	"github.com/google/uuid"

	"loglensai/backend-go/internal/models"
)

// This file implements the hierarchy/folder and tree navigation RPC handlers.

type folderBuild struct {
	id, name string
	children []string
	sources  []models.HierarchySource
}

// GetHierarchy implements the get_hierarchy RPC method.
func (a *App) GetHierarchy(req models.GetHierarchyRequest) (any, *models.RPCError) {
	workspaceID := req.WorkspaceID

	frows, err := a.DB.Conn.Query(`SELECT id, name, parent_id FROM folders WHERE workspace_id = ?`, workspaceID)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	folders := make(map[string]*folderBuild)
	var rootFolderIDs []string
	type parentLink struct{ id, parent string }
	var links []parentLink
	for frows.Next() {
		var id, name string
		var parentID sql.NullString
		if err := frows.Scan(&id, &name, &parentID); err != nil {
			frows.Close()
			return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
		}
		folders[id] = &folderBuild{id: id, name: name}
		if parentID.Valid && parentID.String != "" {
			links = append(links, parentLink{id: id, parent: parentID.String})
		} else {
			rootFolderIDs = append(rootFolderIDs, id)
		}
	}
	ferr := frows.Err()
	frows.Close()
	if ferr != nil {
		return nil, &models.RPCError{Code: errInternal, Message: ferr.Error()}
	}

	for _, l := range links {
		if parent, ok := folders[l.parent]; ok {
			parent.children = append(parent.children, l.id)
		} else {
			rootFolderIDs = append(rootFolderIDs, l.id)
		}
	}

	srows, err := a.DB.Conn.Query(
		`SELECT id, name, type, path, folder_id, is_uploaded FROM log_sources WHERE workspace_id = ?`, workspaceID,
	)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	var rootSources []models.HierarchySource
	for srows.Next() {
		var id, name, sType, path string
		var folderID sql.NullString
		var isUploaded sql.NullBool
		if err := srows.Scan(&id, &name, &sType, &path, &folderID, &isUploaded); err != nil {
			srows.Close()
			return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
		}
		src := models.HierarchySource{
			ID:         id,
			Name:       name,
			Type:       sType,
			Path:       path,
			IsUploaded: isUploaded.Valid && isUploaded.Bool,
		}
		if folderID.Valid && folderID.String != "" {
			if parent, ok := folders[folderID.String]; ok {
				parent.sources = append(parent.sources, src)
				continue
			}
		}
		rootSources = append(rootSources, src)
	}
	serr := srows.Err()
	srows.Close()
	if serr != nil {
		return nil, &models.RPCError{Code: errInternal, Message: serr.Error()}
	}

	var materialize func(id string) models.HierarchyNode
	materialize = func(id string) models.HierarchyNode {
		f := folders[id]
		node := models.HierarchyNode{
			ID:       f.id,
			Name:     f.name,
			Type:     "folder",
			Children: make([]models.HierarchyNode, 0, len(f.children)),
			Sources:  f.sources,
		}
		if node.Sources == nil {
			node.Sources = []models.HierarchySource{}
		}
		for _, cid := range f.children {
			node.Children = append(node.Children, materialize(cid))
		}
		return node
	}

	rootChildren := make([]models.HierarchyNode, 0, len(rootFolderIDs))
	for _, id := range rootFolderIDs {
		rootChildren = append(rootChildren, materialize(id))
	}
	if rootSources == nil {
		rootSources = []models.HierarchySource{}
	}

	return models.HierarchyResponse{
		WorkspaceID: workspaceID,
		Root: models.HierarchyNode{
			ID:       "root",
			Name:     "Root",
			Type:     "folder",
			Children: rootChildren,
			Sources:  rootSources,
		},
	}, nil
}

// CreateFolder implements the create_folder RPC method.
func (a *App) CreateFolder(req models.FolderCreateRequest) (any, *models.RPCError) {
	folderID := uuid.NewString()
	var parentID any
	if req.ParentID != nil {
		parentID = *req.ParentID
	}
	if _, err := a.DB.Conn.Exec(
		`INSERT INTO folders (id, workspace_id, name, parent_id) VALUES (?, ?, ?, ?)`,
		folderID, req.WorkspaceID, req.Name, parentID,
	); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	return map[string]any{"status": "success", "folder_id": folderID}, nil
}

// UpdateFolder implements the update_folder RPC method.
func (a *App) UpdateFolder(req models.FolderUpdateRequest) (any, *models.RPCError) {
	if req.Name != nil && *req.Name != "" {
		if _, err := a.DB.Conn.Exec(`UPDATE folders SET name = ? WHERE id = ?`, *req.Name, req.FolderID); err != nil {
			return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
		}
	}
	if req.ParentID != nil {
		var pVal any
		if *req.ParentID != "" {
			pVal = *req.ParentID
		}
		if _, err := a.DB.Conn.Exec(`UPDATE folders SET parent_id = ? WHERE id = ?`, pVal, req.FolderID); err != nil {
			return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
		}
	}
	return map[string]any{"status": "success"}, nil
}

// DeleteFolder implements the delete_folder RPC method.
func (a *App) DeleteFolder(req models.FolderDeleteRequest) (any, *models.RPCError) {
	if _, err := a.DB.Conn.Exec(`UPDATE folders SET parent_id = NULL WHERE parent_id = ?`, req.FolderID); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	if _, err := a.DB.Conn.Exec(`UPDATE log_sources SET folder_id = NULL WHERE folder_id = ?`, req.FolderID); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	if _, err := a.DB.Conn.Exec(`DELETE FROM folders WHERE id = ?`, req.FolderID); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	return map[string]any{"status": "success"}, nil
}

// MoveSource implements the move_source RPC method.
func (a *App) MoveSource(req models.SourceMoveRequest) (any, *models.RPCError) {
	var folderID any
	if req.FolderID != nil && *req.FolderID != "" {
		folderID = *req.FolderID
	}
	if _, err := a.DB.Conn.Exec(`UPDATE log_sources SET folder_id = ? WHERE id = ?`, folderID, req.SourceID); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	return map[string]any{"status": "success"}, nil
}
