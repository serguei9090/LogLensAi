import { Bookmark, Columns, Cpu, Download, Sparkles, Upload } from "lucide-react";
import { useState } from "react";
import { StatusDot } from "@/components/atoms/StatusDot";
import { TailSwitch } from "@/components/atoms/TailSwitch";
import { FilterBuilder, type FilterEntry } from "@/components/molecules/FilterBuilder";
import { HighlightBuilder, type HighlightEntry } from "@/components/molecules/HighlightBuilder";
import { SearchBar } from "@/components/molecules/SearchBar";
import { TimeRangePicker } from "@/components/molecules/TimeRangePicker";
import { WorkspaceTabs } from "@/components/molecules/WorkspaceTabs";
import { cn } from "@/lib/utils";
import { useAiStore } from "@/store/aiStore";
import { useInvestigationStore } from "@/store/investigationStore";
import { useUIStore } from "@/store/uiStore";
import type { LogSource } from "@/store/workspaceStore";
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
  sources = [],
  activeSourceId = null,
  tailingSourceIds,
  onSelectSource,
  onRemoveSource,
  onEditFusion,
  onRenameSource,
  activeWorkspaceId,
  onExport,
}: LogToolbarProps) {
  const { timeRange, setTimeRange } = useInvestigationStore();
  const { isSidebarOpen, setSidebarOpen } = useAiStore();
  const { facetSidebarCollapsed, toggleFacetSidebar } = useUIStore();
  const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState(false);

  return (
    <div className="sticky top-0 z-10 flex flex-nowrap items-center gap-3 bg-[#0d0f0e]/95 backdrop-blur-sm border-b border-zinc-800/60 px-4 py-2.5 shadow-sm overflow-x-auto scrollbar-none">
      {/* ... previous buttons ... */}
      <SaveTemplateModal
        isOpen={isSaveTemplateModalOpen}
        onClose={() => setIsSaveTemplateModalOpen(false)}
        workspaceId={activeWorkspaceId ?? ""}
        filters={activeFilters}
        highlights={activeHighlights}
      />

      {/* Import button */}
      <button
        type="button"
        onClick={onImportOpen}
        className="inline-flex items-center gap-2 rounded-md bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-[#0a0c0b] text-xs font-semibold px-3 py-1.5 transition-colors shadow-[0_0_12px_rgba(52,211,153,0.2)] shrink-0"
      >
        <Upload className="h-3.5 w-3.5" />
        Import
      </button>

      {/* Export button */}
      <button
        type="button"
        onClick={onExport}
        className="inline-flex items-center gap-2 rounded-md bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-300 text-xs font-semibold px-3 py-1.5 transition-colors border border-zinc-700 shrink-0"
      >
        <Download className="h-3.5 w-3.5" />
        Export
      </button>

      {/* Orchestrate — always visible */}
      <button
        type="button"
        onClick={onOrchestrateOpen}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all shadow-sm shrink-0 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 border border-violet-500/20 hover:border-violet-500/40"
      >
        <Cpu className="size-3.5" />
        Orchestrate
      </button>

      {/* Facet Toggle */}
      <button
        type="button"
        onClick={toggleFacetSidebar}
        className={cn(
          "p-1.5 rounded-md transition-all shrink-0 border",
          !facetSidebarCollapsed
            ? "bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white"
            : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.1)]",
        )}
        title={facetSidebarCollapsed ? "Show Facets" : "Hide Facets"}
      >
        <Columns className="size-4" />
      </button>

      {/* Divider */}
      <div className="h-5 w-px bg-zinc-800 shrink-0" />

      {/* Source tabs */}
      <WorkspaceTabs
        sources={sources}
        activeSourceId={activeSourceId}
        tailingSourceIds={tailingSourceIds}
        onSelectSource={onSelectSource ?? (() => {})}
        onRemoveSource={onRemoveSource}
        onEditFusion={onEditFusion}
        onRenameSource={onRenameSource}
        activeWorkspaceId={activeWorkspaceId ?? ""}
      />

      {/* Search */}
      <div className="flex-1 min-w-[180px] max-w-xs">
        <SearchBar value={searchQuery} onChange={onSearch} />
      </div>

      {/* Global Time Filter */}
      <TimeRangePicker value={timeRange} onChange={setTimeRange} />

      <div className="h-5 w-px bg-zinc-800 shrink-0" />

      {/* Filters & Highlights */}
      <div className="flex items-center gap-2">
        <FilterBuilder filters={activeFilters} onChange={onFilterChange} />
        <HighlightBuilder highlights={activeHighlights} onChange={onHighlightChange} />

        {/* Template Summary Button */}
        <button
          type="button"
          onClick={() => setIsSaveTemplateModalOpen(true)}
          className="p-1.5 rounded-md hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors ml-1"
          title="Save as Template"
        >
          <Bookmark className="size-4" />
        </button>

        <div className="h-5 w-px bg-zinc-800 shrink-0 mx-1" />

        {/* AI Sidebar Toggle */}
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

      <div className="flex-1" />

      {/* Action switches */}
      <div className="flex items-center gap-5 shrink-0 ml-2">
        <div
          className="flex items-center gap-2 group cursor-help"
          title="Toggle real-time log ingestion (Live Tail)"
        >
          <span className="text-[10px] font-bold tracking-widest text-text-muted group-hover:text-emerald-400 transition-colors uppercase">
            Tail
          </span>
          <TailSwitch checked={isTailing} onCheckedChange={onTailToggle} />
        </div>

        <StatusDot active={status} />
      </div>
    </div>
  );
}
