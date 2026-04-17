import { StatusDot } from "@/components/atoms/StatusDot";
import { TailSwitch } from "@/components/atoms/TailSwitch";
import { FilterBuilder, type FilterEntry } from "@/components/molecules/FilterBuilder";
import { HighlightBuilder, type HighlightEntry } from "@/components/molecules/HighlightBuilder";
import { SearchBar } from "@/components/molecules/SearchBar";
import { TimeRangePicker } from "@/components/molecules/TimeRangePicker";
import { WorkspaceTabs } from "@/components/molecules/WorkspaceTabs";
import { useInvestigationStore } from "@/store/investigationStore";
import type { LogSource } from "@/store/workspaceStore";
import { Bookmark, Cpu, Upload } from "lucide-react";
import { toast } from "sonner";

interface LogToolbarProps {
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
}

export function LogToolbar({
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
}: LogToolbarProps) {
  const { timeRange, setTimeRange } = useInvestigationStore();

  return (
    <div className="sticky top-0 z-10 flex flex-nowrap items-center gap-3 bg-[#0d0f0e]/95 backdrop-blur-sm border-b border-zinc-800/60 px-4 py-2.5 shadow-sm overflow-x-auto scrollbar-none">
      {/* Import button */}
      <button
        type="button"
        onClick={onImportOpen}
        className="inline-flex items-center gap-2 rounded-md bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-[#0a0c0b] text-xs font-semibold px-3 py-1.5 transition-colors shadow-[0_0_12px_rgba(52,211,153,0.2)] shrink-0"
      >
        <Upload className="h-3.5 w-3.5" />
        Import
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
      />

      {/* Search */}
      <div className="flex-1 min-w-[180px] max-w-xs">
        <SearchBar value="" onChange={onSearch} />
      </div>

      {/* Global Time Filter */}
      <TimeRangePicker value={timeRange} onChange={setTimeRange} />

      <div className="h-5 w-px bg-zinc-800 shrink-0" />

      {/* Filters & Highlights */}
      <div className="flex items-center gap-2">
        <FilterBuilder filters={activeFilters} onChange={onFilterChange} />
        <div className="h-5 w-px bg-zinc-800" />
        <HighlightBuilder highlights={activeHighlights} onChange={onHighlightChange} />

        {/* Template Summary Button */}
        <button
          type="button"
          onClick={() =>
            toast.info("Template functionality coming soon", {
              description: "Saving complex filter setups as templates is planned.",
            })
          }
          className="p-1.5 rounded-md hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors ml-1"
          title="Save as Template"
        >
          <Bookmark className="size-4" />
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
