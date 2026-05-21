import type { NavTab } from "@/App";
import { Button } from "@/components/ui/button";
import { DraggableItem, DroppableArea } from "@/lib/dnd-wrappers";
import { cn } from "@/lib/utils";
import { type HierarchyNode, useWorkspaceStore } from "@/store/workspaceStore";
import { ChevronDown, ChevronRight, Folder, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { memo, useState } from "react";
import { ConfirmationDialog } from "../molecules/ConfirmationDialog";
import { SourceItem } from "./SourceItem";

interface HierarchyTreeProps {
  node: HierarchyNode;
  workspaceId: string;
  activeSourceId: string | null;
  activeFolderId: string | null;
  isNavActive: boolean;
  onNavSelect: (nav: NavTab) => void;
}

function HierarchyTreeImpl({
  node,
  workspaceId,
  activeSourceId,
  activeFolderId,
  isNavActive,
  onNavSelect,
}: Readonly<HierarchyTreeProps>) {
  const {
    setActiveSource,
    setActiveFolder,
    createFolder,
    deleteFolder,
    updateFolder,
    removeSource,
    renameSource,
  } = useWorkspaceStore();

  const [isExpanded, setIsExpanded] = useState(true);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");

  // State for renaming folders
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState("");
  const [renamingSourceId, setRenamingSourceId] = useState<string | null>(null);

  // State for deletion confirmation
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    type: "folder" | "source";
    name: string;
  } | null>(null);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    if (deleteTarget.type === "folder") {
      await deleteFolder(deleteTarget.id);
    } else {
      removeSource(workspaceId, deleteTarget.id);
    }
    setDeleteTarget(null);
  };

  const handleRenameFolder = async (id: string) => {
    const trimmed = renameFolderValue.trim();
    if (trimmed) {
      await updateFolder(id, trimmed);
    }
    setRenamingFolderId(null);
  };

  const isRoot = node.id === "root";

  if (isRoot) {
    return (
      <>
        <DroppableArea
          id="sidebar-folder-root"
          className="min-h-[40px] rounded transition-colors duration-200"
          activeClassName="bg-primary/5 ring-1 ring-primary/20"
        >
          <div className="space-y-0.5">
            {node.children?.map((child) => (
              <HierarchyTree
                key={child.id}
                node={child}
                workspaceId={workspaceId}
                activeSourceId={activeSourceId}
                activeFolderId={activeFolderId}
                isNavActive={isNavActive}
                onNavSelect={onNavSelect}
              />
            ))}
            {node.sources?.map((source) => (
              <DraggableItem
                key={source.id}
                id={`sidebar-source-${source.id}`}
                disabled={renamingSourceId === source.id}
              >
                <SourceItem
                  source={source}
                  active={isNavActive && activeSourceId === source.id}
                  onClick={() => {
                    setActiveSource(workspaceId, source.id);
                    onNavSelect("investigation");
                  }}
                  onDelete={() =>
                    setDeleteTarget({ id: source.id, type: "source", name: source.name })
                  }
                  onRename={(newName) => renameSource(workspaceId, source.id, newName)}
                  isRenaming={renamingSourceId === source.id}
                  onRenamingChange={(renaming) => setRenamingSourceId(renaming ? source.id : null)}
                />
              </DraggableItem>
            ))}
            <Button
              variant="ghost"
              onClick={() => setIsAddingFolder(true)}
              className="flex items-center justify-start gap-2 px-2 py-1 h-7 text-[11px] text-text-muted hover:text-primary transition-colors w-full mt-2"
            >
              <FolderPlus className="h-3 w-3" />
              <span>New Folder</span>
            </Button>
            {isAddingFolder && (
              <div className="flex items-center gap-1 px-2 py-1">
                <input
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  onBlur={() => {
                    if (!folderName.trim()) {
                      setIsAddingFolder(false);
                    }
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      await createFolder(workspaceId, folderName);
                      setIsAddingFolder(false);
                      setFolderName("");
                    }
                    if (e.key === "Escape") {
                      setIsAddingFolder(false);
                    }
                  }}
                  className="flex-1 bg-black/20 border border-border-subtle rounded px-1.5 py-0.5 text-[11px] outline-none text-text-primary"
                />
              </div>
            )}
          </div>
        </DroppableArea>
        {deleteTarget && (
          <ConfirmationDialog
            isOpen={!!deleteTarget}
            onOpenChange={(open) => !open && setDeleteTarget(null)}
            onConfirm={handleConfirmDelete}
            title={deleteTarget.type === "folder" ? "Delete Folder?" : "Delete Source?"}
            description={
              deleteTarget.type === "folder"
                ? `This will permanently delete the folder "${deleteTarget.name}" and ALL its subfolders and files. This action cannot be undone.`
                : `This will remove "${deleteTarget.name}" from the workspace. Annotations and parsed data for this source will be deleted.`
            }
            variant="destructive"
            confirmText="Delete"
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-0.5">
      <DroppableArea
        id={`sidebar-folder-${node.id}`}
        className="rounded transition-colors duration-200"
        activeClassName="bg-primary/10 ring-1 ring-primary/30"
      >
        {renamingFolderId === node.id ? (
          <div className="px-2 py-1">
            <input
              value={renameFolderValue}
              onChange={(e) => setRenameFolderValue(e.target.value)}
              onBlur={() => handleRenameFolder(node.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleRenameFolder(node.id);
                }
                if (e.key === "Escape") {
                  setRenamingFolderId(null);
                }
              }}
              className="w-full bg-black/40 border border-primary/30 rounded px-1.5 py-0.5 text-[11px] text-text-primary outline-none"
            />
          </div>
        ) : (
          <div className="group flex items-center gap-1 px-2 py-1 text-[12px] text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded transition-colors">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-white/5 rounded transition-colors shrink-0"
              aria-label={isExpanded ? "Collapse Folder" : "Expand Folder"}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveFolder(workspaceId, node.id);
                onNavSelect("investigation");
              }}
              className={cn(
                "flex items-center gap-1.5 flex-1 overflow-hidden transition-colors py-1 cursor-pointer text-left",
                isNavActive && activeFolderId === node.id ? "text-primary font-medium" : "",
              )}
            >
              <Folder
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  isNavActive && activeFolderId === node.id ? "text-primary" : "text-primary/70",
                )}
              />
              <span className="truncate flex-1 min-w-0">{node.name}</span>
            </button>
            <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setRenamingFolderId(node.id);
                  setRenameFolderValue(node.name);
                }}
                className="h-6 w-6 text-text-muted hover:text-primary transition-colors"
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteTarget({ id: node.id, type: "folder", name: node.name })}
                className="h-6 w-6 text-error/80 hover:text-error transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </DroppableArea>

      {isExpanded && (
        <div className="ml-3 border-l border-border-subtle/20 pl-2">
          {node.children?.map((child) => (
            <HierarchyTree
              key={child.id}
              node={child}
              workspaceId={workspaceId}
              activeSourceId={activeSourceId}
              activeFolderId={activeFolderId}
              isNavActive={isNavActive}
              onNavSelect={onNavSelect}
            />
          ))}
          {node.sources?.map((source) => (
            <DraggableItem
              key={source.id}
              id={`sidebar-source-${source.id}`}
              disabled={renamingSourceId === source.id}
            >
              <SourceItem
                source={source}
                active={isNavActive && activeSourceId === source.id}
                onClick={() => {
                  setActiveSource(workspaceId, source.id);
                  onNavSelect("investigation");
                }}
                onDelete={() =>
                  setDeleteTarget({ id: source.id, type: "source", name: source.name })
                }
                onRename={(newName) => renameSource(workspaceId, source.id, newName)}
                isRenaming={renamingSourceId === source.id}
                onRenamingChange={(renaming) => setRenamingSourceId(renaming ? source.id : null)}
              />
            </DraggableItem>
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmationDialog
          isOpen={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
          title={deleteTarget.type === "folder" ? "Delete Folder?" : "Delete Source?"}
          description={
            deleteTarget.type === "folder"
              ? `This will permanently delete the folder "${deleteTarget.name}" and ALL its subfolders and files. This action cannot be undone.`
              : `This will remove "${deleteTarget.name}" from the workspace. Annotations and parsed data for this source will be deleted.`
          }
          variant="destructive"
          confirmText="Delete"
        />
      )}
    </div>
  );
}

export const HierarchyTree = memo(HierarchyTreeImpl);
