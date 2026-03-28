import { SearchBar } from "@/components/molecules/SearchBar";
import { FilterBuilder, FilterEntry } from "@/components/molecules/FilterBuilder";
import { HighlightBuilder, HighlightEntry } from "@/components/molecules/HighlightBuilder";
import { WorkspaceTabs } from "@/components/molecules/WorkspaceTabs";
import { TailSwitch } from "@/components/atoms/TailSwitch";
import { StatusDot } from "@/components/atoms/StatusDot";
import { Upload } from "lucide-react";
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
  /** Sources attached to the active workspace (from workspaceStore) */
  sources?: LogSource[];
  /** Currently-active source id; null = show all sources aggregated */
  activeSourceId?: string | null;
  /** Source IDs that are currently live-tailing */
  tailingSourceIds?: Set<string>;
  /** Called when user clicks a source tab */
  onSelectSource?: (sourceId: string | null) => void;
  /** Called when user removes a source tab */
  onRemoveSource?: (sourceId: string) => void;
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
  sources = [],
  activeSourceId = null,
  tailingSourceIds,
  onSelectSource,
  onRemoveSource,
}: LogToolbarProps) {
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 bg-[#0d0f0e]/95 backdrop-blur-sm border-b border-zinc-800/60 px-4 py-2.5 shadow-sm">
      {/* Import button */}
      <button
        type="button"
        onClick={onImportOpen}
        className="inline-flex items-center gap-2 rounded-md bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-[#0a0c0b] text-xs font-semibold px-3 py-1.5 transition-colors shadow-[0_0_12px_rgba(52,211,153,0.2)] shrink-0"
      >
        <Upload className="h-3.5 w-3.5" />
        Import
      </button>

      {/* Divider */}
      <div className="h-5 w-px bg-zinc-800 shrink-0" />

      {/* Source tabs (rendered only when workspace has ≥1 source) */}
      <WorkspaceTabs
        sources={sources}
        activeSourceId={activeSourceId}
        tailingSourceIds={tailingSourceIds}
        onSelectSource={onSelectSource ?? (() => {})}
        onRemoveSource={onRemoveSource}
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
