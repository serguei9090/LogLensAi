// Assume Role: Frontend Engineer (@frontend)

import { FileText, Folder, MoreVertical, Plus } from "lucide-react";
import { useState } from "react";
import { ConfirmationDialog } from "@/components/molecules/ConfirmationDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DraggableItem, DroppableArea } from "@/lib/dnd-wrappers";
import type { HierarchyNode } from "@/store/workspaceStore";

interface ExplorerViewProps {
  readonly folderId: string | null;
  readonly hierarchy?: HierarchyNode;
  readonly onSelectFolder: (id: string) => void;
  readonly onSelectSource: (id: string) => void;
  readonly onCreateFolder?: (name: string) => void;
  readonly onImportOpen?: () => void;
  readonly workspaceName?: string;
  readonly onRenameFolder?: (id: string, name: string) => void;
  readonly onDeleteFolder?: (id: string) => void;
  readonly onRenameSource?: (id: string, name: string) => void;
  readonly onDeleteSource?: (id: string) => void;
}

export function ExplorerView({
  folderId,
  hierarchy,
  onSelectFolder,
  onSelectSource,
  onCreateFolder,
  onImportOpen,
  workspaceName,
  onRenameFolder,
  onDeleteFolder,
  onRenameSource,
  onDeleteSource,
}: ExplorerViewProps) {
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingSourceId, setRenamingSourceId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    type: "folder" | "source";
    name: string;
  } | null>(null);

  const findFolder = (node: HierarchyNode, id: string): HierarchyNode | null => {
    if (node.id === id) {
      return node;
    }
    for (const child of node.children) {
      const found = findFolder(child, id);
      if (found) {
        return found;
      }
    }
    return null;
  };

  const currentFolder = hierarchy && folderId ? findFolder(hierarchy, folderId) : hierarchy;

  const handleConfirmDelete = () => {
    if (!deleteTarget) {
      return;
    }
    if (deleteTarget.type === "folder") {
      onDeleteFolder?.(deleteTarget.id);
    } else {
      onDeleteSource?.(deleteTarget.id);
    }
    setDeleteTarget(null);
  };

  if (!currentFolder) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-muted opacity-50">
        <Folder className="size-12 mb-4" />
        <p>Folder not found</p>
      </div>
    );
  }

  const labelCls = "text-[10px] text-text-muted uppercase tracking-widest font-semibold opacity-40";

  return (
    <div className="p-8 h-full overflow-y-auto font-sans">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-text-primary tracking-tight mb-1">
            {folderId ? currentFolder.name : workspaceName || "Workspace"}
          </h1>
          <p className="text-xs text-text-muted opacity-60">
            {currentFolder.children.length} folders, {currentFolder.sources.length} sources
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCreateFolder?.("New Folder")}
            className="rounded-full px-4 h-9 border-primary/20 hover:bg-primary/5 hover:border-primary/40 text-primary"
          >
            <Plus className="size-4 mr-2" />
            New Folder
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onImportOpen}
            className="rounded-full px-5 h-9 font-bold"
          >
            <Plus className="size-4 mr-2" />
            Import Log
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {currentFolder.children.map((child) => (
          <DroppableArea
            key={child.id}
            id={`explorer-folder-${child.id}`}
            className="rounded-3xl transition-all"
            activeClassName="ring-2 ring-primary bg-primary/5"
          >
            <div className="relative group w-full">
              <button
                type="button"
                onClick={() => onSelectFolder(child.id)}
                className="w-full flex flex-col p-5 bg-bg-surface-bright/40 border border-border-subtle rounded-3xl hover:bg-bg-hover hover:border-primary/30 transition-all text-left outline-none cursor-pointer"
              >
                <div className="p-3 bg-primary/10 rounded-2xl mb-4">
                  <Folder className="size-6 text-primary" />
                </div>
                {renamingFolderId === child.id ? (
                  <input
                    type="text"
                    defaultValue={child.name}
                    // biome-ignore lint/a11y/noAutofocus: autoFocus is necessary to focus the inline renaming input instantly when displayed
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                      const newName = e.target.value.trim();
                      if (newName && newName !== child.name) {
                        onRenameFolder?.(child.id, newName);
                      }
                      setRenamingFolderId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const newName = (e.target as HTMLInputElement).value.trim();
                        if (newName && newName !== child.name) {
                          onRenameFolder?.(child.id, newName);
                        }
                        setRenamingFolderId(null);
                      }
                      if (e.key === "Escape") {
                        setRenamingFolderId(null);
                      }
                    }}
                    className="w-full bg-black/40 border border-primary/30 rounded px-2 py-1 text-sm text-text-primary outline-none font-sans"
                  />
                ) : (
                  <>
                    <h3 className="font-bold text-text-primary mb-1 truncate w-full">
                      {child.name}
                    </h3>
                    <p className={labelCls}>{child.children.length + child.sources.length} items</p>
                  </>
                )}
              </button>
              <div className="absolute top-5 right-5 z-10">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="p-1.5 hover:bg-white/5 rounded-xl text-text-muted opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer outline-none flex items-center justify-center"
                  >
                    <MoreVertical className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-bg-surface border-border-subtle">
                    <DropdownMenuItem onClick={() => setRenamingFolderId(child.id)}>
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-error focus:text-error"
                      onClick={() =>
                        setDeleteTarget({ id: child.id, type: "folder", name: child.name })
                      }
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </DroppableArea>
        ))}

        {currentFolder.sources.map((source) => (
          <DraggableItem key={source.id} id={`explorer-source-${source.id}`}>
            <div className="relative group w-full">
              <button
                type="button"
                onClick={() => onSelectSource(source.id)}
                className="w-full flex flex-col p-5 bg-bg-surface-bright/40 border border-border-subtle rounded-3xl hover:bg-bg-hover hover:border-primary/30 transition-all text-left outline-none cursor-pointer select-none"
              >
                <div className="p-3 bg-text-muted/10 rounded-2xl mb-4">
                  <FileText className="size-6 text-text-muted" />
                </div>
                {renamingSourceId === source.id ? (
                  <input
                    type="text"
                    defaultValue={source.name}
                    // biome-ignore lint/a11y/noAutofocus: autoFocus is necessary to focus the inline renaming input instantly when displayed
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                      const newName = e.target.value.trim();
                      if (newName && newName !== source.name) {
                        onRenameSource?.(source.id, newName);
                      }
                      setRenamingSourceId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const newName = (e.target as HTMLInputElement).value.trim();
                        if (newName && newName !== source.name) {
                          onRenameSource?.(source.id, newName);
                        }
                        setRenamingSourceId(null);
                      }
                      if (e.key === "Escape") {
                        setRenamingSourceId(null);
                      }
                    }}
                    className="w-full bg-black/40 border border-primary/30 rounded px-2 py-1 text-sm text-text-primary outline-none font-sans"
                  />
                ) : (
                  <>
                    <h3 className="font-bold text-text-primary mb-1 truncate w-full">
                      {source.name}
                    </h3>
                    <p className={labelCls}>{source.type} Source</p>
                  </>
                )}
              </button>
              <div className="absolute top-5 right-5 z-10">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="p-1.5 hover:bg-white/5 rounded-xl text-text-muted opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer outline-none flex items-center justify-center"
                  >
                    <MoreVertical className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-bg-surface border-border-subtle">
                    <DropdownMenuItem onClick={() => setRenamingSourceId(source.id)}>
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-error focus:text-error"
                      onClick={() =>
                        setDeleteTarget({ id: source.id, type: "source", name: source.name })
                      }
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </DraggableItem>
        ))}

        {currentFolder.children.length === 0 && currentFolder.sources.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-text-muted opacity-30 border-2 border-dashed border-border-subtle rounded-[3rem]">
            <Folder className="size-16 mb-4" />
            <p className="text-sm font-medium">This folder is empty</p>
          </div>
        )}
      </div>

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
