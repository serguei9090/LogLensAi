import { ReactNode } from "react";
import { LogToolbar } from "@/components/organisms/LogToolbar";
import { FilterEntry } from "@/components/molecules/FilterBuilder";
import { HighlightEntry } from "@/components/molecules/HighlightBuilder";
import type { LogSource } from "@/store/workspaceStore";

interface InvestigationLayoutProps {
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
  children: ReactNode;
  sources?: LogSource[];
  activeSourceId?: string | null;
  tailingSourceIds?: Set<string>;
  onSelectSource?: (sourceId: string | null) => void;
  onRemoveSource?: (sourceId: string) => void;
  onEditFusion?: (sourceId: string) => void;
}

export function InvestigationLayout({
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
  children,
  sources,
  activeSourceId,
  tailingSourceIds,
  onSelectSource,
  onRemoveSource,
  onEditFusion,
}: InvestigationLayoutProps) {
  return (
    <div className="flex flex-col h-full w-full bg-[#0a0c0b]">
      <LogToolbar
        onSearch={onSearch}
        activeFilters={activeFilters}
        onFilterChange={onFilterChange}
        activeHighlights={activeHighlights}
        onHighlightChange={onHighlightChange}
        isTailing={isTailing}
        onTailToggle={onTailToggle}
        status={status}
        onImportOpen={onImportOpen}
        onOrchestrateOpen={onOrchestrateOpen}
        sources={sources}
        activeSourceId={activeSourceId}
        tailingSourceIds={tailingSourceIds}
        onSelectSource={onSelectSource}
        onRemoveSource={onRemoveSource}
        onEditFusion={onEditFusion}
      />
      <div className="flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
