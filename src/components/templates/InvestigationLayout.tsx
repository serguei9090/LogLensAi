import type { FilterEntry } from "@/components/molecules/FilterBuilder";
import type { HighlightEntry } from "@/components/molecules/HighlightBuilder";
import { LogDistributionWidget } from "@/components/organisms/LogDistributionWidget";
import { LogToolbar } from "@/components/organisms/LogToolbar";
import type { LogSource } from "@/store/workspaceStore";
import type { ReactNode } from "react";

interface InvestigationLayoutProps {
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
  readonly children: ReactNode;
  readonly sources?: LogSource[];
  readonly activeSourceId?: string | null;
  readonly tailingSourceIds?: Set<string>;
  readonly onSelectSource?: (sourceId: string | null) => void;
  readonly onRemoveSource?: (sourceId: string) => void;
  readonly onEditFusion?: (sourceId: string) => void;
  readonly showDistribution?: boolean;
  readonly workspaceId?: string;
  readonly onDistributionClose?: () => void;
  readonly showAnomalies?: boolean;
  readonly onAnomaliesChange?: (v: boolean) => void;
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
  showDistribution,
  workspaceId,
  onDistributionClose,
  showAnomalies,
  onAnomaliesChange,
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
        showDistribution={showDistribution}
        onDistributionToggle={onDistributionClose ? () => onDistributionClose() : undefined}
        showAnomalies={showAnomalies}
        onAnomaliesToggle={onAnomaliesChange}
      />
      {showDistribution && workspaceId && (
        <LogDistributionWidget
          workspaceId={workspaceId}
          sourceIds={
            activeSourceId && sources && sources.find((s) => s.id === activeSourceId)?.type !== "fusion"
              ? [sources.find((s) => s.id === activeSourceId)!.path]
              : null
          }
          fusionId={
            activeSourceId && sources && sources.find((s) => s.id === activeSourceId)?.type === "fusion"
              ? sources.find((s) => s.id === activeSourceId)!.path
              : undefined
          }
          isTailing={activeSourceId ? tailingSourceIds?.has(activeSourceId) : false}
          filters={activeFilters}
          onClose={onDistributionClose}
        />
      )}
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
