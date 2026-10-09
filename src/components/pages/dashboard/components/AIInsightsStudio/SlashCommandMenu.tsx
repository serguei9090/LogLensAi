// Assume Role: Frontend Engineer (@frontend)

import { Check, Database, FileText, Layers, Slash } from "lucide-react";
import { useEffect, useRef } from "react";
import type { LogSource, Workspace } from "@/store/workspaceStore";
import { cn } from "@/lib/utils";

export interface SlashCommandItem {
  id: string;
  type: "catalog" | "workspace" | "action";
  title: string;
  subtitle: string;
  badge?: string;
  data: {
    sourceId?: string;
    sourceName?: string;
    workspaceId?: string;
    actionType?: string;
  };
}

interface SlashCommandMenuProps {
  readonly query: string;
  readonly selectedIndex: number;
  readonly catalogs: LogSource[];
  readonly workspaces: Workspace[];
  readonly currentWorkspaceId: string;
  readonly onSelect: (item: SlashCommandItem) => void;
  readonly onClose: () => void;
}

export function SlashCommandMenu({
  query,
  selectedIndex,
  catalogs,
  workspaces,
  currentWorkspaceId,
  onSelect,
}: SlashCommandMenuProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const filter = query.toLowerCase().trim();

  // Build command suggestions
  const catalogItems: SlashCommandItem[] = catalogs
    .filter((c) => c.name.toLowerCase().includes(filter) || "catalog".includes(filter) || "file".includes(filter))
    .map((c) => ({
      id: `cat-${c.id}`,
      type: "catalog",
      title: c.name,
      subtitle: `Target catalog (${c.type})`,
      badge: "Catalog",
      data: { sourceId: c.id, sourceName: c.name },
    }));

  const workspaceItems: SlashCommandItem[] = workspaces
    .filter((w) => w.id !== currentWorkspaceId && (w.name.toLowerCase().includes(filter) || "workspace".includes(filter)))
    .map((w) => ({
      id: `ws-${w.id}`,
      type: "workspace",
      title: w.name,
      subtitle: `Switch focus workspace`,
      badge: "Workspace",
      data: { workspaceId: w.id },
    }));

  const actionItems: SlashCommandItem[] = ([
    {
      id: "act-all",
      type: "action" as const,
      title: "All Catalogs",
      subtitle: "Remove scope & search across the full workspace",
      badge: "Scope",
      data: { actionType: "clear_scope" },
    },
    {
      id: "act-errors",
      type: "action" as const,
      title: "Errors Only",
      subtitle: "Filter specifically for ERROR / FATAL levels",
      badge: "Filter",
      data: { actionType: "errors_only" },
    },
  ] as SlashCommandItem[]).filter((a) => a.title.toLowerCase().includes(filter) || filter === "");

  const items: SlashCommandItem[] = [...catalogItems, ...actionItems, ...workspaceItems];

  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement | undefined;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="absolute bottom-full mb-2 left-0 right-0 z-50 max-h-72 overflow-y-auto custom-scrollbar rounded-xl border border-border/80 bg-bg-surface/95 backdrop-blur-xl shadow-2xl p-1.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
      <div className="flex items-center justify-between px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted border-b border-border-subtle/40 mb-1">
        <span className="flex items-center gap-1.5">
          <Slash className="size-3 text-primary" />
          <span>Quick Context & Commands</span>
        </span>
        <span>↑↓ Navigate • Enter to select</span>
      </div>

      <div ref={listRef} className="space-y-0.5">
        {items.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors font-mono text-xs select-none",
                isSelected
                  ? "bg-primary/15 text-text-primary border border-primary/30"
                  : "hover:bg-white/5 text-text-secondary border border-transparent",
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={cn(
                    "p-1.5 rounded-md",
                    item.type === "catalog"
                      ? "bg-cyan-500/10 text-cyan-400"
                      : item.type === "workspace"
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-emerald-500/10 text-emerald-400",
                  )}
                >
                  {item.type === "catalog" ? (
                    <FileText className="size-3.5" />
                  ) : item.type === "workspace" ? (
                    <Database className="size-3.5" />
                  ) : (
                    <Layers className="size-3.5" />
                  )}
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold truncate text-text-primary">{item.title}</span>
                    {item.badge && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/5 border border-white/10 text-text-muted">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-text-muted truncate">{item.subtitle}</span>
                </div>
              </div>

              {isSelected && <Check className="size-3.5 text-primary shrink-0 ml-2" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
