import { SearchBar } from "@/components/molecules/SearchBar";
import { FilterBuilder, FilterEntry } from "@/components/molecules/FilterBuilder";
import { HighlightBuilder, HighlightEntry } from "@/components/molecules/HighlightBuilder";
import { WorkspaceTabs } from "@/components/molecules/WorkspaceTabs";
import { TailSwitch } from "@/components/atoms/TailSwitch";
import { StatusDot } from "@/components/atoms/StatusDot";
import { Upload, Cpu } from "lucide-react";
import type { LogSource } from "@/store/workspaceStore";

interface LogToolbarProps {
  onSearch: (q: string) => void;
  activeFilters: FilterEntry[];
  onFilterChange: (f: FilterEntry[]) => void;
  activeHighlights: HighlightEntry[];
  onHighlightChange: (h: HighlightEntry[]) => void;
  isTailing: boolean;
  onTailToggle: (v: boolean) => void;
  status: boolean;
  onImportOpen: () => void;
  onOrchestrateOpen: () => void;
  /** Sources attached to the active workspace (from workspaceStore) */
  sources?: LogSource[];
  /** Currently-active source id */
  activeSourceId?: string | null;
  /** Source IDs that are currently live-tailing */
  tailingSourceIds?: Set<string>;
  /** Called when user clicks a source tab */
  onSelectSource?: (sourceId: string | null) => void;
  /** Called when user removes a source tab */
  onRemoveSource?: (sourceId: string) => void;
  /** Called when user clicks the edit icon on a fusion tab */
  onEditFusion?: (sourceId: string) => void;
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

      {/* Filters & Highlights */}
      <div className="flex items-center gap-2">
        <FilterBuilder filters={activeFilters} onChange={onFilterChange} />
        <div className="h-5 w-px bg-zinc-800" />
        <HighlightBuilder highlights={activeHighlights} onChange={onHighlightChange} />
      </div>

      <div className="flex-1" />

      {/* Live Tail + Status */}
      <div className="flex items-center gap-3 shrink-0">
        <TailSwitch checked={isTailing} onCheckedChange={onTailToggle} />
        <StatusDot active={status} />
      </div>
    </div>
  );
}
