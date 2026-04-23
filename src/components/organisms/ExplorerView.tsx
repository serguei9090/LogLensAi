import { Button } from "@/components/ui/button";
import { DraggableItem, DroppableArea } from "@/lib/dnd-wrappers";
import { cn } from "@/lib/utils";
import type { HierarchyNode, LogSource } from "@/store/workspaceStore";
import { FileText, Folder, MoreVertical, Plus } from "lucide-react";

interface ExplorerViewProps {
  readonly folderId: string | null;
  readonly hierarchy?: HierarchyNode;
  readonly onSelectFolder: (id: string) => void;
  readonly onSelectSource: (id: string) => void;
  readonly onCreateFolder?: (name: string) => void;
  readonly onImportOpen?: () => void;
}

export function ExplorerView({
  folderId,
  hierarchy,
  onSelectFolder,
  onSelectSource,
  onCreateFolder,
  onImportOpen,
}: ExplorerViewProps) {
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

  if (!currentFolder) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-muted opacity-50">
        <Folder className="size-12 mb-4" />
        <p>Folder not found</p>
      </div>
    );
  }

  return (
    <div className="p-8 h-full overflow-y-auto font-sans">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-text-primary tracking-tight mb-1">
            {folderId ? currentFolder.name : "Workspace Root"}
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
            variant="primary"
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
            id={child.id}
            className="rounded-3xl transition-all"
            activeClassName="ring-2 ring-primary bg-primary/5"
          >
            <button
              type="button"
              onClick={() => onSelectFolder(child.id)}
              className="group w-full flex flex-col p-5 bg-white/[0.02] border border-white/[0.05] rounded-3xl hover:bg-white/[0.05] hover:border-primary/30 transition-all text-left outline-none cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-primary/10 rounded-2xl">
                  <Folder className="size-6 text-primary" />
                </div>
                <MoreVertical className="size-4 text-text-muted opacity-0 group-hover:opacity-40 transition-opacity" />
              </div>
              <h3 className="font-bold text-text-primary mb-1 truncate w-full">{child.name}</h3>
              <p className="text-[10px] text-text-muted uppercase tracking-widest font-semibold opacity-40">
                {child.children.length + child.sources.length} items
              </p>
            </button>
          </DroppableArea>
        ))}

        {currentFolder.sources.map((source) => (
          <DraggableItem key={source.id} id={source.id}>
            <button
              type="button"
              onClick={() => onSelectSource(source.id)}
              className="group w-full flex flex-col p-5 bg-white/[0.02] border border-white/[0.05] rounded-3xl hover:bg-white/[0.05] hover:border-primary/30 transition-all text-left outline-none cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-zinc-400/10 rounded-2xl">
                  <FileText className="size-6 text-zinc-400" />
                </div>
                <MoreVertical className="size-4 text-text-muted opacity-0 group-hover:opacity-40 transition-opacity" />
              </div>
              <h3 className="font-bold text-text-primary mb-1 truncate w-full">{source.name}</h3>
              <p className="text-[10px] text-text-muted uppercase tracking-widest font-semibold opacity-40">
                {source.type} Source
              </p>
            </button>
          </DraggableItem>
        ))}

        {currentFolder.children.length === 0 && currentFolder.sources.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-text-muted opacity-30 border-2 border-dashed border-white/[0.05] rounded-[3rem]">
            <Folder className="size-16 mb-4" />
            <p className="text-sm font-medium">This folder is empty</p>
          </div>
        )}
      </div>
    </div>
  );
}
