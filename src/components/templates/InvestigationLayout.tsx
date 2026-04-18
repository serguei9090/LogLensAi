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
  readonly onRenameSource?: (workspaceId: string, sourceId: string, name: string) => void;
  readonly showDistribution?: boolean;
  readonly workspaceId?: string;
  readonly onDistributionClose?: () => void;
  readonly onEngineSettingsOpen?: () => void;
  readonly rightPanel?: ReactNode;
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
  onRenameSource,
  showDistribution,
  workspaceId,
  onDistributionClose,
  onEngineSettingsOpen,
  rightPanel,
}: InvestigationLayoutProps) {
  const activeSource = sources?.find((s) => s.id === activeSourceId);

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0c0b] overflow-hidden">
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
        onRenameSource={onRenameSource}
        activeWorkspaceId={workspaceId}
        onEngineSettingsOpen={onEngineSettingsOpen}
      />
      {showDistribution && workspaceId && (
        <LogDistributionWidget
          workspaceId={workspaceId}
          sourceIds={activeSource && activeSource.type !== "fusion" ? [activeSource.path] : null}
          fusionId={activeSource && activeSource.type === "fusion" ? activeSource.path : undefined}
          isTailing={activeSourceId ? tailingSourceIds?.has(activeSourceId) : false}
          filters={activeFilters}
          onClose={onDistributionClose}
        />
      )}
      <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">{children}</div>
        {rightPanel}
      </div>
    </div>
  );
}
