import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/uiStore";
import { motion } from "framer-motion";
import {
  Check,
  Database,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Terminal,
  Trash2,
  Pencil,
  X,
} from "lucide-react";
import { useRef, useState } from "react";

import type { Workspace } from "@/store/workspaceStore";

interface SidebarProps {
  readonly workspaces: readonly Workspace[];
  readonly activeWorkspaceId: string;
  readonly onWorkspaceSelect: (id: string) => void;
  readonly onWorkspaceCreate: (name: string) => void;
  readonly onWorkspaceRename?: (id: string, name: string) => void;
  readonly onWorkspaceDelete?: (id: string) => void;
  readonly activeNav: "investigation" | "settings";
  readonly onNavSelect: (nav: "investigation" | "settings") => void;
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
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
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

  const handleConfirmRename = (id: string) => {
    if (renameValue.trim() && onWorkspaceRename) {
      onWorkspaceRename(id, renameValue.trim());
    }
    setRenamingId(null);
  };

  return (
    <motion.div
      initial={false}
      animate={{ width: sidebarCollapsed ? 60 : 240 }}
      transition={{ type: "spring", stiffness: 400, damping: 40 }}
      className="h-screen bg-[#0a0c0b] border-r border-[#1D2420] flex flex-col select-none overflow-hidden relative"
    >
      {/* Logo Section */}
      <div className="h-16 border-b border-[#1D2420] flex items-center px-4 shrink-0 overflow-hidden">
        <div className="bg-[#22C55E10] border border-[#22C55E20] p-1.5 rounded-lg shrink-0 flex items-center justify-center">
          <Terminal className="h-5 w-5 text-[#22C55E]" />
        </div>
        {!sidebarCollapsed && (
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="ml-3 font-bold text-[15px] tracking-tight text-[#E8F5EC] whitespace-nowrap"
          >
            LogLens<span className="text-[#22C55E]">Ai</span>
          </motion.h1>
        )}
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className={cn(
          "pt-5 pb-2 flex items-center transition-all overflow-hidden px-4",
          sidebarCollapsed && "justify-center px-0"
        )}>
          {sidebarCollapsed ? (
             <div className="h-px w-5 bg-[#1D2420]" />
          ) : (
            <>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#4D6057] whitespace-nowrap">
                Workspaces
              </span>
              <button
                type="button"
                onClick={handleStartAdd}
                className="text-[#4D6057] hover:text-[#22C55E] transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="pb-2 space-y-1 px-2">
            <TooltipProvider delay={0}>
              {workspaces.map((ws) => {
                const isRenaming = renamingId === ws.id;
                const WorkspaceItem = (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onWorkspaceSelect(ws.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onWorkspaceSelect(ws.id);
                      }
                    }}
                    className={cn(
                      "group w-full flex items-center px-3 py-2.5 text-[13px] rounded-md transition-all text-left outline-none overflow-hidden border-none bg-transparent cursor-pointer",
                      activeWorkspaceId === ws.id
                        ? "bg-[#22C55E10] text-[#22C55E] font-medium border border-[#22C55E20]"
                        : "text-[#8FA898] hover:bg-[#1E2520] hover:text-[#E8F5EC]",
                      sidebarCollapsed && "justify-center"
                    )}
                  >
                    <Database
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        activeWorkspaceId === ws.id ? "text-[#22C55E]" : "text-[#4D6057]",
                      )}
                    />
                    {!sidebarCollapsed && (
                      <span className="flex-1 truncate ml-3 font-medium">
                        {ws.name}
                      </span>
                    )}
                    {!sidebarCollapsed && (
                      <div className="hidden group-hover:flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingId(ws.id);
                            setRenameValue(ws.name);
                          }}
                          className="p-0.5 rounded text-[#4D6057] hover:text-[#22C55E] border-none bg-transparent"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {workspaces.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onWorkspaceDelete?.(ws.id);
                            }}
                            className="p-0.5 rounded text-[#EF444490] hover:text-[#EF4444] border-none bg-transparent"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );

                let finalItem = WorkspaceItem;
                if (isRenaming) {
                  finalItem = (
                    <div className="px-1 py-1 flex items-center gap-1">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleConfirmRename(ws.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="flex-1 bg-black/40 border border-[#22C55E30] rounded px-2 py-0.5 text-xs text-[#E8F5EC] outline-none"
                      />
                      <button type="button" onClick={() => handleConfirmRename(ws.id)} className="text-[#22C55E] border-none bg-transparent">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                } else if (sidebarCollapsed) {
                  finalItem = (
                    <Tooltip>
                      <TooltipTrigger className="w-full">
                        {WorkspaceItem}
                      </TooltipTrigger>
                      <TooltipContent side="right" className="bg-[#1A1F1C] border-[#2A3430] text-[#E8F5EC]">
                        {ws.name}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return (
                  <div key={ws.id} className="w-full">
                    {finalItem}
                  </div>
                );
              })}
            </TooltipProvider>

            {isAdding && !sidebarCollapsed && (
              <div className="px-2 pt-1 flex items-center gap-1">
                <input
                  ref={inputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Workspace..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirmAdd();
                    if (e.key === "Escape") handleCancelAdd();
                  }}
                  className="w-full bg-black/40 border border-[#22C55E30] rounded px-2 py-1 text-xs text-[#E8F5EC] outline-none"
                />
                <button type="button" onClick={handleConfirmAdd} className="text-[#22C55E]">
                   <Check className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={handleCancelAdd} className="text-[#4D6057]">
                   <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="mt-auto border-t border-[#1D2420] bg-[#0a0c0b] px-2 py-4 space-y-1 overflow-hidden shrink-0">
          <TooltipProvider delay={0}>
            <SidebarNavItem
              icon={<Terminal className="h-4 w-4" />}
              label="Investigation"
              active={activeNav === "investigation"}
              collapsed={sidebarCollapsed}
              onClick={() => onNavSelect("investigation")}
            />

            <SidebarNavItem
              icon={<LayoutDashboard className="h-4 w-4" />}
              label="Dashboard"
              active={false}
              collapsed={sidebarCollapsed}
              disabled
              badge="SOON"
            />

            <SidebarNavItem
              icon={<Settings className="h-4 w-4" />}
              label="Settings"
              active={activeNav === "settings"}
              collapsed={sidebarCollapsed}
              onClick={() => onNavSelect("settings")}
            />

            <div className="pt-2 border-t border-[#1D2420]/40 mt-1">
              <SidebarNavItem
                icon={sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                label={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                active={false}
                collapsed={sidebarCollapsed}
                onClick={toggleSidebar}
                className="opacity-50 hover:opacity-100"
              />
            </div>
          </TooltipProvider>
        </div>
      </div>
    </motion.div>
  );
}

interface SidebarNavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
  disabled?: boolean;
  badge?: string;
  className?: string;
}

function SidebarNavItem({ icon, label, active, collapsed, onClick, disabled, badge, className }: Readonly<SidebarNavItemProps>) {
  const navContent = (
    <button
      type="button"
      disabled={disabled || active}
      onClick={disabled ? undefined : onClick}
      className={cn(
        "flex items-center px-3 py-2.5 text-[13px] rounded-md transition-all text-left outline-none overflow-hidden border-none bg-transparent w-full",
        active
          ? "bg-[#22C55E10] text-[#22C55E] font-medium border border-[#22C55E20] cursor-default"
          : "text-[#8FA898] hover:bg-[#1E2520] hover:text-[#E8F5EC] cursor-pointer",
        disabled && "opacity-40 cursor-not-allowed",
        collapsed ? "justify-center" : "gap-3",
        className
      )}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && (
        <span className="flex-1 whitespace-nowrap truncate">
          {label}
        </span>
      )}
      {!collapsed && badge && (
        <span className="ml-auto text-[8px] bg-[#1A1F1C] text-[#4D6057] border border-[#2A3430] px-1 rounded">
          {badge}
        </span>
      )}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger className="w-full">{navContent}</TooltipTrigger>
        <TooltipContent side="right" className="bg-[#1A1F1C] border-[#2A3430] text-[#E8F5EC]">
          {label} {badge && `(${badge})`}
        </TooltipContent>
      </Tooltip>
    );
  }

  return navContent;
}
