import { StatusDot } from "@/components/atoms/StatusDot";
import { TailSwitch } from "@/components/atoms/TailSwitch";
import { FilterBuilder, type FilterEntry } from "@/components/molecules/FilterBuilder";
import { HighlightBuilder, type HighlightEntry } from "@/components/molecules/HighlightBuilder";
import { SearchBar } from "@/components/molecules/SearchBar";
import { TimeRangePicker } from "@/components/molecules/TimeRangePicker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAiStore } from "@/store/aiStore";
import { useClusteringStore } from "@/store/clusteringStore";
import { useInvestigationStore } from "@/store/investigationStore";
import { useUIStore } from "@/store/uiStore";
import { type LogSource } from "@/store/workspaceStore";
import {
  Columns,
  Cpu,
  Download,
  LayoutTemplate,
  List,
  Plus,
  Sparkles,
  Upload,
  Zap,
  ZapOff,
} from "lucide-react";
import { useEffect, useState } from "react";
import { LoadTemplateModal } from "./LoadTemplateModal";
import { SaveTemplateModal } from "./SaveTemplateModal";

interface LogToolbarProps {
  readonly searchQuery: string;
  readonly onSearch: (q: string) => void;
  readonly activeFilters: FilterEntry[];
  readonly onFilterChange: (f: FilterEntry[]) => void;
  readonly activeHighlights: HighlightEntry[];
  readonly onHighlightChange: (h: HighlightEntry[]) => void;
  readonly isTailing: boolean;
  readonly onTailToggle: (v: boolean) => void;
  readonly status: boolean;
  readonly onImportOpen: () => void;
  readonly onOrchestrateOpen: () => void;
  readonly sources?: LogSource[];
  readonly activeSourceId?: string | null;
  readonly tailingSourceIds?: Set<string>;
  readonly onSelectSource?: (sourceId: string | null) => void;
  readonly onRemoveSource?: (sourceId: string) => void;
  readonly onEditFusion?: (sourceId: string) => void;
  readonly onRenameSource?: (workspaceId: string, sourceId: string, name: string) => void;
  readonly activeWorkspaceId?: string;
  readonly onExport: () => void;
  readonly onEngineSettingsOpen?: () => void;
  readonly searchRef?: React.RefObject<HTMLInputElement | null>;
}

export function LogToolbar({
  searchQuery,
  onSearch,
  activeFilters,
  onFilterChange,
  activeHighlights,
  onHighlightChange,
  isTailing,
  onTailToggle,
  status,
  onImportOpen,
  onOrchestrateOpen,
  sources: _sources = [],
  activeSourceId: _activeSourceId = null,
  tailingSourceIds: _tailingSourceIds,
  onSelectSource: _onSelectSource,
  onRemoveSource: _onRemoveSource,
  onEditFusion: _onEditFusion,
  onRenameSource: _onRenameSource,
  activeWorkspaceId,
  onExport,
  onEngineSettingsOpen,
  searchRef,
}: LogToolbarProps) {
  const { timeRange, setTimeRange } = useInvestigationStore();
  const { isSidebarOpen, setSidebarOpen } = useAiStore();
  const { facetSidebarCollapsed, toggleFacetSidebar } = useUIStore();
  const { status: clusteringStatus, startPolling, stopPolling, setMode } = useClusteringStore();
  const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState(false);
  const [isLoadTemplateModalOpen, setIsLoadTemplateModalOpen] = useState(false);

  useEffect(() => {
    startPolling(activeWorkspaceId);
    return () => stopPolling();
  }, [activeWorkspaceId, startPolling, stopPolling]);

  return (
    <div className="sticky top-0 z-10 flex flex-nowrap items-center gap-3 bg-bg-base/95 backdrop-blur-sm border-b border-border/60 px-4 py-2.5 shadow-sm overflow-x-auto scrollbar-none">
      {/* ... previous buttons ... */}
      <SaveTemplateModal
        isOpen={isSaveTemplateModalOpen}
        onClose={() => setIsSaveTemplateModalOpen(false)}
        workspaceId={activeWorkspaceId ?? ""}
        filters={activeFilters}
        highlights={activeHighlights}
      />
      <LoadTemplateModal
        isOpen={isLoadTemplateModalOpen}
        onClose={() => setIsLoadTemplateModalOpen(false)}
        workspaceId={activeWorkspaceId ?? ""}
        onLoad={(f, h) => {
          onFilterChange(f);
          onHighlightChange(h);
        }}
      />

      {/* Left Group */}
      <div className="flex items-center gap-3 shrink-0">
        <StatusDot active={status} />

        <button
          type="button"
          onClick={onImportOpen}
          className="inline-flex items-center gap-2 rounded-md bg-primary hover:bg-primary/90 active:bg-primary/80 text-bg-app text-xs font-semibold px-3 py-1.5 transition-colors shadow-[0_0_12px_rgba(var(--color-primary-rgb),0.2)] shrink-0"
        >
          <Upload className="h-3.5 w-3.5" />
          Import
        </button>

        <button
          type="button"
          onClick={onExport}
          className="inline-flex items-center gap-2 rounded-md bg-bg-surface hover:bg-bg-hover active:bg-bg-base text-text-secondary text-xs font-semibold px-3 py-1.5 transition-colors border border-border shrink-0"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>

        <button
          type="button"
          onClick={onOrchestrateOpen}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all shadow-sm shrink-0 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 border border-violet-500/20 hover:border-violet-500/40"
        >
          <Cpu className="size-3.5" />
          Orchestrate
        </button>

        <button
          type="button"
          onClick={toggleFacetSidebar}
          className={cn(
            "p-1.5 rounded-md transition-all shrink-0 border",
            facetSidebarCollapsed
              ? "bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.15)]",
          )}
          title={facetSidebarCollapsed ? "Show Facets" : "Hide Facets"}
        >
          <Columns className="size-4" />
        </button>

        <div className="h-5 w-px bg-zinc-800 shrink-0" />

        {/* Tail control moved to left */}
        <div className="flex items-center gap-3 shrink-0">
          <TailSwitch checked={isTailing} onCheckedChange={onTailToggle} />
        </div>

        <div className="h-5 w-px bg-zinc-800 shrink-0" />

        {/* Clustering Status & Controls */}
        <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-zinc-900/50 border border-zinc-800/50">
          <div className="flex flex-col items-start leading-tight pr-1">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
              Clustering
            </span>
            <div className="flex items-center gap-1.5">
              <StatusDot active={!!clusteringStatus?.running} />
              <span className="text-[11px] font-mono text-zinc-400">
                {clusteringStatus?.backlog ?? 0} backlog
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 ml-1 border-l border-zinc-800 pl-2">
            <button
              type="button"
              onClick={() =>
                setMode(clusteringStatus?.mode === "burst" ? "auto" : "burst", activeWorkspaceId)
              }
              className={cn(
                "p-1.5 rounded-md transition-all group shrink-0 border",
                clusteringStatus?.mode === "burst"
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.1)]"
                  : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600",
              )}
              title={
                clusteringStatus?.mode === "burst" ? "Deactivate Burst Mode" : "Activate Burst Mode"
              }
            >
              {clusteringStatus?.mode === "burst" ? (
                <Zap className="size-3.5 fill-current" />
              ) : (
                <ZapOff className="size-3.5" />
              )}
            </button>

            {clusteringStatus?.mode === "manual" ? (
              <button
                type="button"
                onClick={() => setMode("auto", activeWorkspaceId)}
                className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold hover:bg-emerald-500/20 transition-colors"
              >
                AUTO
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setMode("manual", activeWorkspaceId)}
                className="px-2 py-1 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 text-[10px] font-bold hover:bg-zinc-700 transition-colors"
              >
                MANUAL
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Spacer to center search */}
      <div className="flex-1" />

      {/* Middle Group - Search (Centered) */}
      <div className="w-full max-w-sm shrink-0">
        <SearchBar ref={searchRef} value={searchQuery} onChange={onSearch} />
      </div>

      {/* Spacer to center search */}
      <div className="flex-1" />

      {/* Right Group */}
      <div className="flex items-center gap-3 shrink-0">
        <TimeRangePicker value={timeRange} onChange={setTimeRange} />

        <div className="h-5 w-px bg-zinc-800 shrink-0" />

        <div className="flex items-center gap-2">
          <FilterBuilder filters={activeFilters} onChange={onFilterChange} />
          <HighlightBuilder highlights={activeHighlights} onChange={onHighlightChange} />

          <DropdownMenu>
            <DropdownMenuTrigger
              className="p-1.5 rounded-md hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors ml-1"
              title="Template Actions"
            >
              <LayoutTemplate className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-bg-surface border-border-subtle">
              <DropdownMenuItem
                onClick={() => setIsSaveTemplateModalOpen(true)}
                className="gap-2 text-xs py-2"
              >
                <Plus className="size-3.5" />
                Save as Template
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setIsLoadTemplateModalOpen(true)}
                className="gap-2 text-xs py-2"
              >
                <List className="size-3.5" />
                Load Template
              </DropdownMenuItem>
              {onEngineSettingsOpen && (
                <>
                  <div className="h-px bg-border/50 my-1" />
                  <DropdownMenuItem
                    onClick={onEngineSettingsOpen}
                    className="gap-2 text-xs py-2 text-emerald-400 hover:text-emerald-300"
                  >
                    <Cpu className="size-3.5" />
                    Engine Settings
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-5 w-px bg-zinc-800 shrink-0 mx-1" />

          <button
            type="button"
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className={cn(
              "p-1.5 rounded-md transition-all ml-1 group shrink-0 border",
              isSidebarOpen
                ? "bg-violet-500/10 border-violet-500/20 text-violet-400 ring-1 ring-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.1)]"
                : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300",
            )}
            title={isSidebarOpen ? "Close AI Assistant" : "Open AI Assistant"}
          >
            <Sparkles
              className={cn(
                "size-4 transition-transform",
                isSidebarOpen ? "scale-110" : "group-hover:scale-110",
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
