import { StatusDot } from "@/components/atoms/StatusDot";
import { TailSwitch } from "@/components/atoms/TailSwitch";
import { FilterBuilder, type FilterEntry } from "@/components/molecules/FilterBuilder";
import { HighlightBuilder, type HighlightEntry } from "@/components/molecules/HighlightBuilder";
import { SearchBar } from "@/components/molecules/SearchBar";
import { TimeRangePicker } from "@/components/molecules/TimeRangePicker";
import { Button } from "@/components/ui/button";
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
import type { LogSource } from "@/store/workspaceStore";
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
  const { status: clusteringStatus, fetchStatus, setMode } = useClusteringStore();
  const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState(false);
  const [isLoadTemplateModalOpen, setIsLoadTemplateModalOpen] = useState(false);

  // One-shot fetch when workspace changes so the clustering controls render
  // with correct initial state. Ongoing updates are driven by ingestionStore.
  useEffect(() => {
    fetchStatus(activeWorkspaceId);
  }, [activeWorkspaceId, fetchStatus]);

  return (
    <div className="sticky top-0 z-10 flex flex-nowrap items-center gap-3 bg-bg-app/95 backdrop-blur-sm border-b border-border-subtle px-4 py-2.5 shadow-sm overflow-x-auto scrollbar-none">
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

        <Button onClick={onImportOpen} className="gap-2 text-xs font-semibold px-3 py-1.5 shrink-0">
          <Upload className="h-3.5 w-3.5" />
          Import
        </Button>

        <Button
          variant="secondary"
          onClick={onExport}
          className="gap-2 text-xs font-semibold px-3 py-1.5 shrink-0"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>

        <Button
          variant="outline"
          onClick={onOrchestrateOpen}
          className="gap-2 px-3 py-1.5 text-xs font-bold shrink-0 border-violet-500/20 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 hover:border-violet-500/40"
        >
          <Cpu className="size-3.5" />
          Orchestrate
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={toggleFacetSidebar}
          className={cn(
            "size-8 shrink-0",
            facetSidebarCollapsed
              ? "bg-bg-surface-bright/50 border-border-subtle text-text-muted hover:text-text-primary"
              : "bg-primary/10 border-primary/20 text-primary hover:text-primary-hover shadow-[0_0_12px_rgba(var(--color-primary-rgb),0.15)]",
          )}
          title={facetSidebarCollapsed ? "Show Facets" : "Hide Facets"}
        >
          <Columns className="size-4" />
        </Button>

        <div className="h-5 w-px bg-zinc-800 shrink-0" />

        {/* Tail control moved to left */}
        <div className="flex items-center gap-3 shrink-0">
          <TailSwitch checked={isTailing} onCheckedChange={onTailToggle} />
        </div>

        <div className="h-5 w-px bg-zinc-800 shrink-0" />

        {/* Clustering Status & Controls */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-bg-surface-bright/50 border border-border-subtle shrink-0">
          <div
            className="flex items-center gap-2 group cursor-help"
            title="Clustering Engine Status"
          >
            <StatusDot active={!!clusteringStatus?.running && !clusteringStatus?.paused} />
            <span className="text-[11px] font-mono text-text-muted">
              {clusteringStatus?.backlog?.toLocaleString() ?? 0}
            </span>
          </div>

          <div className="w-px h-3 bg-border-subtle mx-1" />

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() =>
              setMode(clusteringStatus?.mode === "burst" ? "auto" : "burst", activeWorkspaceId)
            }
            className={cn(
              "p-1 rounded-md transition-all group shrink-0",
              clusteringStatus?.mode === "burst"
                ? "bg-amber-500/20 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)] border border-amber-500/30"
                : "text-text-muted hover:text-text-primary hover:bg-bg-hover",
            )}
            title={
              clusteringStatus?.mode === "burst"
                ? "Burst Mode Active (High CPU)"
                : "Activate Burst Mode"
            }
          >
            <Zap className={cn("size-3.5", clusteringStatus?.mode === "burst" && "fill-current")} />
          </Button>
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
              className="p-1.5 rounded-md hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors ml-1"
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
                    className="gap-2 text-xs py-2 text-primary hover:text-primary-hover"
                  >
                    <Cpu className="size-3.5" />
                    Engine Settings
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-5 w-px bg-border-subtle shrink-0 mx-1" />

          <Button
            variant="outline"
            size="icon"
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className={cn(
              "size-8 shrink-0",
              isSidebarOpen
                ? "bg-primary/10 border-primary/20 text-primary ring-1 ring-primary/30 shadow-[0_0_12px_rgba(var(--color-primary-rgb),0.1)]"
                : "bg-bg-surface-bright/50 border-border-subtle text-text-muted hover:text-text-primary",
            )}
            title={isSidebarOpen ? "Close AI Assistant" : "Open AI Assistant"}
          >
            <Sparkles
              className={cn(
                "size-4 transition-transform",
                isSidebarOpen ? "scale-110" : "group-hover:scale-110",
              )}
            />
          </Button>
        </div>
      </div>
    </div>
  );
}
