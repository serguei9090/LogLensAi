// Assume Role: Frontend Engineer (@frontend)

import { Check, Database, FileText, Layers, Search } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Workspace } from "@/store/workspaceStore";
import { cn } from "@/lib/utils";

export interface AtMentionItem {
  id: string;
  type: "catalog" | "workspace" | "action";
  title: string;
  subtitle: string;
  workspaceName?: string;
  badge?: string;
  data: {
    sourceId?: string;
    sourceName?: string;
    workspaceId?: string;
    actionType?: string;
  };
}

interface AtMentionMenuProps {
  readonly query: string;
  readonly selectedIndex: number;
  readonly workspaces: Workspace[];
  readonly currentWorkspaceId: string;
  readonly onSelect: (item: AtMentionItem) => void;
  readonly onClose: () => void;
}

export function AtMentionMenu({
  query,
  selectedIndex,
  workspaces,
  currentWorkspaceId,
  onSelect,
}: AtMentionMenuProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const filter = query.toLowerCase().trim();

  // 1. Gather all catalogs across ALL workspaces, tagging each catalog with its workspace
  const allCatalogItems: AtMentionItem[] = [];
  for (const ws of workspaces) {
    const isCurrent = ws.id === currentWorkspaceId;
    for (const src of ws.sources || []) {
      const matchesFilter =
        filter === "" ||
        src.name.toLowerCase().includes(filter) ||
        ws.name.toLowerCase().includes(filter) ||
        "catalog".includes(filter) ||
        "file".includes(filter);

      if (matchesFilter) {
        allCatalogItems.push({
          id: `cat-${ws.id}-${src.id}`,
          type: "catalog",
          title: src.name,
          subtitle: `${ws.name} • ${src.type}`,
          workspaceName: ws.name,
          badge: isCurrent ? "Current WS" : ws.name,
          data: {
            sourceId: src.id,
            sourceName: src.name,
            workspaceId: ws.id,
          },
        });
      }
    }
  }

  // 2. Full Workspace search items
  const workspaceItems: AtMentionItem[] = workspaces
    .filter(
      (w) =>
        filter === "" ||
        w.name.toLowerCase().includes(filter) ||
        "workspace".includes(filter) ||
        "scope".includes(filter),
    )
    .map((w) => {
      const isCurrent = w.id === currentWorkspaceId;
      const count = w.sources?.length ?? 0;
      return {
        id: `ws-${w.id}`,
        type: "workspace",
        title: w.name,
        subtitle: isCurrent
          ? `Current workspace (${count} catalog${count === 1 ? "" : "s"})`
          : `Switch workspace focus (${count} catalog${count === 1 ? "" : "s"})`,
        badge: isCurrent ? "Active" : "Workspace",
        data: { workspaceId: w.id },
      };
    });

  // 3. Global quick action items
  const actionItems: AtMentionItem[] = ([
    {
      id: "act-all",
      type: "action" as const,
      title: "All Catalogs (Full Workspace)",
      subtitle: "Scope across all log catalogs in this workspace",
      badge: "All",
      data: { actionType: "all_catalogs" },
    },
  ] as AtMentionItem[]).filter(
    (a) =>
      filter === "" ||
      a.title.toLowerCase().includes(filter) ||
      a.subtitle.toLowerCase().includes(filter),
  );

  const items: AtMentionItem[] = [...allCatalogItems, ...workspaceItems, ...actionItems];

  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement | undefined;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  if (items.length === 0) {
    return (
      <div className="absolute bottom-full mb-3 left-0 right-0 z-50 rounded-xl border border-border/80 bg-bg-surface/95 backdrop-blur-2xl shadow-2xl p-4 text-center text-xs font-mono text-text-muted animate-in fade-in slide-in-from-bottom-2 duration-150">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Search className="size-4 text-text-muted/60" />
          <span>No catalogs or workspaces matching &ldquo;{query}&rdquo;</span>
        </div>
        <p className="text-[11px] text-text-muted/60">Type a filename or workspace name to search</p>
      </div>
    );
  }

  return (
    <div className="absolute bottom-full mb-3 left-0 right-0 z-50 max-h-80 overflow-y-auto custom-scrollbar rounded-2xl border border-white/15 bg-[#101311]/98 backdrop-blur-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] p-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
      {/* Top Header */}
      <div className="flex items-center justify-between px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted border-b border-white/5 mb-1.5">
        <span className="flex items-center gap-1.5 text-cyan-400">
          <span className="font-bold text-xs">@</span>
          <span className="text-text-secondary">Attach Catalog or Workspace</span>
        </span>
        <span className="text-[10px] text-text-muted/70">
          {items.length} options • ↑↓ Navigate • Enter
        </span>
      </div>

      <div ref={listRef} className="space-y-1">
        {items.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all font-mono text-xs select-none group",
                isSelected
                  ? "bg-white/10 text-text-primary shadow-sm ring-1 ring-white/15"
                  : "hover:bg-white/5 text-text-secondary",
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    "p-2 rounded-lg shrink-0 transition-transform group-hover:scale-105",
                    item.type === "catalog"
                      ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                      : item.type === "workspace"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                  )}
                >
                  {item.type === "catalog" ? (
                    <FileText className="size-4" />
                  ) : item.type === "workspace" ? (
                    <Database className="size-4" />
                  ) : (
                    <Layers className="size-4" />
                  )}
                </div>

                <div className="flex flex-col min-w-0 gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate text-text-primary text-[13px]">
                      {item.title}
                    </span>
                    {item.badge && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-text-muted shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-text-muted truncate">
                    {item.subtitle}
                  </span>
                </div>
              </div>

              {isSelected && (
                <div className="shrink-0 ml-2 p-1 rounded-md bg-primary/20 text-primary">
                  <Check className="size-3.5" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
