import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Check,
  Database,
  LayoutDashboard,
  Plus,
  Settings,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { useRef, useState } from "react";

import type { Workspace } from "@/store/workspaceStore";

interface SidebarProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onWorkspaceSelect: (id: string) => void;
  onWorkspaceCreate: (name: string) => void;
  onWorkspaceRename?: (id: string, name: string) => void;
  onWorkspaceDelete?: (id: string) => void;
  activeNav: "investigation" | "settings";
  onNavSelect: (nav: "investigation" | "settings") => void;
}

export function Sidebar({
  workspaces,
  activeWorkspaceId,
  onWorkspaceSelect,
  onWorkspaceCreate,
  onWorkspaceRename,
  onWorkspaceDelete,
  activeNav,
  onNavSelect,
}: SidebarProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleStartAdd = () => {
    setIsAdding(true);
    setNewName("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleConfirmAdd = () => {
    const trimmed = newName.trim();
    if (trimmed) onWorkspaceCreate(trimmed);
    setIsAdding(false);
    setNewName("");
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewName("");
  };

  const handleStartRename = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const handleConfirmRename = (id: string) => {
    if (renameValue.trim() && onWorkspaceRename) {
      onWorkspaceRename(id, renameValue.trim());
    }
    setRenamingId(null);
  };

  return (
    <div className="w-60 h-screen bg-[#0a0c0b] border-r border-zinc-800/60 flex flex-col select-none">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-zinc-800/60 flex items-center gap-3">
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-1.5 rounded-lg">
          <Terminal className="h-4 w-4 text-emerald-400" />
        </div>
        <h1 className="font-bold text-[15px] tracking-tight text-zinc-100">
          LogLens<span className="text-emerald-400">Ai</span>
        </h1>
      </div>

      {/* Workspaces section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-4 pb-2 flex justify-between items-center">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Workspaces
          </span>
          <button
            type="button"
            onClick={handleStartAdd}
            aria-label="Add Workspace"
            className="h-5 w-5 rounded flex items-center justify-center text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-2 pb-2 space-y-0.5">
            {workspaces.map((ws) => (
              <div key={ws.id} className="group relative">
                {renamingId === ws.id ? (
                  <div className="flex items-center gap-1 px-2 py-1">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleConfirmRename(ws.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="flex-1 bg-zinc-800 border border-emerald-500/30 rounded px-2 py-0.5 text-xs text-zinc-100 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleConfirmRename(ws.id)}
                      className="text-emerald-400 hover:text-emerald-300"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingId(null)}
                      className="text-zinc-500 hover:text-zinc-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onWorkspaceSelect(ws.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 text-[13px] rounded-md transition-colors text-left",
                      activeWorkspaceId === ws.id
                        ? "bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20"
                        : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 border border-transparent",
                    )}
                  >
                    <Database
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        activeWorkspaceId === ws.id ? "text-emerald-400" : "text-zinc-600",
                      )}
                    />
                    <span className="flex-1 truncate">{ws.name}</span>
                    {/* Action icons on hover */}
                    <span className="hidden group-hover:flex items-center gap-1 shrink-0">
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartRename(ws.id, ws.name);
                        }}
                        onKeyDown={(e) => e.key === "Enter" && handleStartRename(ws.id, ws.name)}
                        className="p-0.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors text-[10px]"
                        aria-label="Rename"
                      >
                        ✏
                      </span>
                      {workspaces.length > 1 && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onWorkspaceDelete?.(ws.id);
                          }}
                          onKeyDown={(e) => e.key === "Enter" && onWorkspaceDelete?.(ws.id)}
                          className="p-0.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </span>
                      )}
                    </span>
                  </button>
                )}
              </div>
            ))}

            {/* Inline add workspace input */}
            {isAdding && (
              <div className="flex items-center gap-1 px-2 py-1">
                <input
                  ref={inputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Workspace name..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirmAdd();
                    if (e.key === "Escape") handleCancelAdd();
                  }}
                  className="flex-1 bg-zinc-800 border border-emerald-500/30 rounded px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-emerald-400"
                />
                <button
                  type="button"
                  onClick={handleConfirmAdd}
                  className="text-emerald-400 hover:text-emerald-300"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleCancelAdd}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Bottom Nav */}
        <div className="px-2 pt-2 pb-4 border-t border-zinc-800/60 space-y-0.5 mt-auto">
          <button
            type="button"
            onClick={() => onNavSelect("investigation")}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 text-[13px] rounded-md transition-colors text-left",
              activeNav === "investigation"
                ? "bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20"
                : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-200 border border-transparent",
            )}
          >
            <Terminal className="h-4 w-4" />
            Investigation
          </button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="w-full flex items-center gap-3 px-3 py-2.5 text-[13px] rounded-md text-zinc-700 cursor-not-allowed border border-transparent">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                  <span className="ml-auto text-[9px] bg-zinc-800 text-zinc-600 rounded px-1.5 py-0.5 font-medium tracking-wide">
                    SOON
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">Coming Soon</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <button
            type="button"
            onClick={() => onNavSelect("settings")}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 text-[13px] rounded-md transition-colors text-left",
              activeNav === "settings"
                ? "bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20"
                : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-200 border border-transparent",
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}
