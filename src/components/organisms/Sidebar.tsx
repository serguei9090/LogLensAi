import type { NavTab } from "@/App";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/uiStore";
import type { Workspace } from "@/store/workspaceStore";
import { motion } from "framer-motion";
import {
  Check,
  Database,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Settings,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { useRef, useState } from "react";

interface SidebarProps {
  readonly workspaces: readonly Workspace[];
  readonly activeWorkspaceId: string;
  readonly onWorkspaceSelect: (id: string) => void;
  readonly onWorkspaceCreate: (name: string) => void;
  readonly onWorkspaceRename?: (id: string, name: string) => void;
  readonly onWorkspaceDelete?: (id: string) => void;
  readonly activeNav: NavTab;
  readonly onNavSelect: (nav: NavTab) => void;
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
    if (trimmed) {
      onWorkspaceCreate(trimmed);
    }
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
      className="h-screen bg-bg-sidebar border-r border-border-subtle flex flex-col select-none overflow-hidden relative"
    >
      {/* Logo Section */}
      <div className="h-16 border-b border-border-subtle flex items-center px-4 shrink-0 overflow-hidden">
        <div className="bg-primary/10 border border-primary/20 p-1.5 rounded-lg shrink-0 flex items-center justify-center">
          <Terminal className="h-5 w-5 text-primary" />
        </div>
        {!sidebarCollapsed && (
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="ml-3 font-bold text-[15px] tracking-tight text-text-primary whitespace-nowrap"
          >
            LogLens<span className="text-primary">Ai</span>
          </motion.h1>
        )}
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div
          className={cn(
            "pt-5 pb-2 flex items-center transition-all overflow-hidden px-4",
            sidebarCollapsed && "justify-center px-0",
          )}
        >
          {sidebarCollapsed ? (
            <div className="h-px w-5 bg-border-subtle" />
          ) : (
            <>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted whitespace-nowrap">
                Workspaces
              </span>
              <button
                type="button"
                onClick={handleStartAdd}
                className="text-text-muted hover:text-primary transition-colors"
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
                    className={cn(
                      "group w-full flex items-center px-1 py-1 text-[13px] rounded-md transition-all text-left outline-none overflow-hidden",
                      activeWorkspaceId === ws.id && activeNav !== "settings"
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-bg-hover",
                      sidebarCollapsed && "justify-center",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onWorkspaceSelect(ws.id)}
                      className={cn(
                        "flex flex-1 items-center px-2 py-1.5 rounded transition-all text-left outline-none overflow-hidden border-none bg-transparent cursor-pointer",
                        activeWorkspaceId === ws.id && activeNav !== "settings"
                          ? "text-primary font-medium"
                          : "text-text-secondary group-hover:text-text-primary",
                        sidebarCollapsed && "justify-center px-0",
                      )}
                    >
                      <Database
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          activeWorkspaceId === ws.id && activeNav !== "settings"
                            ? "text-primary"
                            : "text-text-muted",
                        )}
                      />
                      {!sidebarCollapsed && (
                        <span className="flex-1 truncate ml-3 font-medium">{ws.name}</span>
                      )}
                    </button>
                    {!sidebarCollapsed && (
                      <div className="hidden group-hover:flex items-center gap-1 shrink-0 pr-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingId(ws.id);
                            setRenameValue(ws.name);
                          }}
                          className="p-1 rounded text-text-muted hover:text-primary border-none bg-transparent transition-colors"
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
                            className="p-1 rounded text-error/90 hover:text-error border-none bg-transparent transition-colors"
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
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleConfirmRename(ws.id);
                          }
                          if (e.key === "Escape") {
                            setRenamingId(null);
                          }
                        }}
                        className="flex-1 bg-black/40 border border-primary/30 rounded px-2 py-0.5 text-xs text-text-primary outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleConfirmRename(ws.id)}
                        className="text-primary border-none bg-transparent"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                } else if (sidebarCollapsed) {
                  finalItem = (
                    <Tooltip>
                      <TooltipTrigger className="w-full">{WorkspaceItem}</TooltipTrigger>
                      <TooltipContent
                        side="right"
                        className="bg-bg-surface-bright border-border text-text-primary"
                      >
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
                    if (e.key === "Enter") {
                      handleConfirmAdd();
                    }
                    if (e.key === "Escape") {
                      handleCancelAdd();
                    }
                  }}
                  className="w-full bg-black/40 border border-primary/30 rounded px-2 py-1 text-xs text-text-primary outline-none"
                />
                <button type="button" onClick={handleConfirmAdd} className="text-primary">
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={handleCancelAdd} className="text-text-muted">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="mt-auto border-t border-border-subtle bg-bg-sidebar px-2 py-4 space-y-1 overflow-hidden shrink-0">
          <TooltipProvider delay={0}>
            <SidebarNavItem
              icon={<LayoutDashboard className="h-4 w-4" />}
              label="Dashboard"
              active={activeNav === "dashboard"}
              collapsed={sidebarCollapsed}
              onClick={() => onNavSelect("dashboard")}
            />

            <SidebarNavItem
              icon={<Settings className="h-4 w-4" />}
              label="Settings"
              active={activeNav === "settings"}
              collapsed={sidebarCollapsed}
              onClick={() => onNavSelect("settings")}
            />

            <div className="pt-2 border-t border-border-subtle/40 mt-1">
              <SidebarNavItem
                icon={
                  sidebarCollapsed ? (
                    <PanelLeftOpen className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )
                }
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

function SidebarNavItem({
  icon,
  label,
  active,
  collapsed,
  onClick,
  disabled,
  badge,
  className,
}: Readonly<SidebarNavItemProps>) {
  const navContent = (
    <button
      type="button"
      disabled={disabled || active}
      onClick={disabled ? undefined : onClick}
      className={cn(
        "flex items-center px-3 py-2.5 text-[13px] rounded-md transition-all text-left outline-none overflow-hidden border-none bg-transparent w-full",
        active
          ? "bg-primary/10 text-primary font-medium border border-primary/20 cursor-default"
          : "text-text-secondary hover:bg-bg-hover hover:text-text-primary cursor-pointer",
        disabled && "opacity-40 cursor-not-allowed",
        collapsed ? "justify-center" : "gap-3",
        className,
      )}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && <span className="flex-1 whitespace-nowrap truncate">{label}</span>}
      {!collapsed && badge && (
        <span className="ml-auto text-[8px] bg-bg-surface-bright text-text-muted border border-border px-1 rounded">
          {badge}
        </span>
      )}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger className="w-full">{navContent}</TooltipTrigger>
        <TooltipContent side="right" className="bg-bg-surface-bright border-border text-text-primary">
          {label} {badge && `(${badge})`}
        </TooltipContent>
      </Tooltip>
    );
  }

  return navContent;
}
