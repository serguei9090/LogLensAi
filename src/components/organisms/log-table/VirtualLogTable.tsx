import type { FilterEntry } from "@/components/molecules/FilterBuilder";
import type { HighlightEntry } from "@/components/molecules/HighlightBuilder";
import { Button } from "@/components/ui/button";
import type { IngestionJob } from "@/lib/hooks/useIngestionStatus";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { useAiStore } from "@/store/aiStore";
import { useIngestionStore } from "@/store/ingestion";
import { useInvestigationStore } from "@/store/investigationStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUIStore } from "@/store/uiStore";
import { selectActiveWorkspace, useWorkspaceStore } from "@/store/workspaceStore";
import type { LogEntry } from "@/types/log";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Sparkles, X } from "lucide-react";
import type * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AnnotationDrawer } from "./components/AnnotationDrawer";
import { LogTableRow } from "./components/LogTableRow";
import { SelectionToolbar } from "./components/SelectionToolbar";
import { TableHeader } from "./components/TableHeader";
import { TableOverlays } from "./components/TableOverlays";
import { getHighlightedElements } from "./utils/highlightUtils";
import { type SelectionDetails, getSelectionDetails } from "./utils/selectionUtils";

export interface VirtualLogTableProps {
  readonly logs: LogEntry[];
  readonly highlights: HighlightEntry[];
  readonly onAddComment: (id: number, comment: string) => void;
  readonly onSort: (sortBy: string) => void;
  readonly onAnalyzeCluster?: (clusterId: string) => void;
  readonly onOpenParser?: (sourceId: string, initialConfig: string | null) => void;
  readonly sortBy: string;
  readonly sortOrder: "asc" | "desc";
  readonly anomalousClusters?: Set<string>;
  readonly onImport?: () => void;
  readonly activeJob?: IngestionJob | null;
  readonly isTransitioning?: boolean;
  readonly fetchMoreLogs?: () => void;
  readonly total?: number;
  readonly isFetching?: boolean;
}

export function VirtualLogTable({
  logs,
  highlights,
  onAddComment,
  onSort,
  onAnalyzeCluster,
  onOpenParser,
  sortBy,
  sortOrder,
  anomalousClusters,
  onImport,
  activeJob,
  isTransitioning,
  fetchMoreLogs,
  total,
  isFetching,
}: VirtualLogTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [commentText, setCommentText] = useState("");
  const [selectionInfo, setSelectionInfo] = useState<SelectionDetails | null>(null);
  const [lastSelectedId, setLastSelectedId] = useState<number | null>(null);
  const [selectionAnchorId, setSelectionAnchorId] = useState<number | null>(null);

  const {
    filters,
    setFilters,
    searchQuery,
    setSearchQuery,
    selectedLogIds,
    toggleLogSelection,
    clearSelection: storeClearSelection,
    setSelectedLogIds,
    isTailing,
  } = useInvestigationStore();

  const handleClearSelection = useCallback(() => {
    storeClearSelection();
    setLastSelectedId(null);
    setSelectionAnchorId(null);
  }, [storeClearSelection]);

  const { logSessionMap, fetchMapping } = useAiStore();
  const activeWorkspace = useWorkspaceStore(selectActiveWorkspace);
  const ingestingSourceIds = useIngestionStore((state) => state.ingestingSourceIds);
  const isAnyIngestionProcessing = useIngestionStore((state) =>
    state.jobs.some((j) => j.workspace_id === activeWorkspace?.id && j.status === "processing"),
  );
  const transitioningSourceIds = useIngestionStore((state) => state.transitioningSourceIds);

  const isCurrentlyIngesting = useMemo(() => {
    return !!(
      activeWorkspace?.id &&
      activeWorkspace?.activeSourceId &&
      ingestingSourceIds.includes(activeWorkspace.activeSourceId)
    );
  }, [activeWorkspace, ingestingSourceIds]);

  const { visibleColumns, customColumns, columnOrder, columnWidths, setColumnWidth } = useUIStore();

  const activeVisibleColumns = useMemo(() => {
    return columnOrder.filter((colId) => visibleColumns[colId] ?? false);
  }, [columnOrder, visibleColumns]);

  const gridTemplateColumns = useMemo(() => {
    const widths = activeVisibleColumns.map((colId) => {
      if (colId === "message") {
        return "minmax(200px, 1fr)";
      }
      return columnWidths[colId] || "120px";
    });
    return ["12px", ...widths].filter(Boolean).join(" ");
  }, [activeVisibleColumns, columnWidths]);

  const getColumnLabel = useCallback(
    (colId: string) => {
      switch (colId) {
        case "id":
          return "ID";
        case "timestamp":
          return "Timestamp";
        case "ingest_timestamp":
          return "Ingested";
        case "level":
          return "Level";
        case "message":
          return "Message";
        case "cluster_id":
          return "Cluster";
        case "actions":
          return "Actions";
      }
      const custom = customColumns.find((c) => c.id === colId);
      return custom ? custom.label : colId;
    },
    [customColumns],
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, colId: string) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startWidth = Number.parseInt(columnWidths[colId] || "120px", 10) || 120;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const newWidth = Math.max(50, startWidth + deltaX);
        setColumnWidth(colId, `${newWidth}px`);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [columnWidths, setColumnWidth],
  );

  useEffect(() => {
    if (activeWorkspace?.id) {
      fetchMapping(activeWorkspace.id);
    }
  }, [activeWorkspace?.id, fetchMapping]);

  const addFilter = (f: FilterEntry) => {
    setFilters([...filters, f]);
  };

  const handleSelection = useCallback(() => {
    const selection = globalThis.getSelection();
    if (!selection) {
      setSelectionInfo(null);
      return;
    }
    const details = getSelectionDetails(selection);
    setSelectionInfo(details);
  }, []);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) {
      return;
    }
    el.addEventListener("mouseup", handleSelection);
    return () => {
      el.removeEventListener("mouseup", handleSelection);
    };
  }, [handleSelection]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selectionInfo && parentRef.current && !parentRef.current.contains(e.target as Node)) {
        const isTooltipClick = (e.target as Element).closest('[role="toolbar"]');
        if (!isTooltipClick) {
          setSelectionInfo(null);
          globalThis.getSelection()?.removeAllRanges();
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectionInfo]);

  const handleAddFilter = (operator: "contains" | "not_contains") => {
    if (!selectionInfo) {
      return;
    }
    addFilter({
      id: crypto.randomUUID(),
      field: selectionInfo.field,
      operator,
      value: selectionInfo.text,
    });
    setSelectionInfo(null);
    globalThis.getSelection()?.removeAllRanges();
    toast.success(`Filter added: ${selectionInfo.field} ${operator} "${selectionInfo.text}"`);
  };

  const handleAddFacet = async (useAi: boolean) => {
    if (!selectionInfo) {
      return;
    }

    const { settings, updateSettings } = useSettingsStore.getState();
    let regex = "";

    if (useAi) {
      toast.promise(
        async () => {
          const res = await callSidecar<{ regex: string }>({
            method: "generate_facet_regex",
            params: {
              log_line: selectionInfo.logText,
              selected_text: selectionInfo.text,
            },
          });
          regex = res.regex;

          const currentFacets = settings.facet_extractions || [];
          await updateSettings(
            {
              facet_extractions: [
                ...currentFacets,
                {
                  name: `AI: ${selectionInfo.text.slice(0, 8)}`,
                  regex,
                  group: 1,
                  enabled: true,
                },
              ],
            },
            activeWorkspace?.id,
          );
        },
        {
          loading: "AI is generating extraction pattern...",
          success: "AI Facet extraction created!",
          error: "Failed to generate regex with AI.",
        },
      );
    } else {
      const escaped = selectionInfo.text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
      regex = `(${escaped})`;

      const currentFacets = settings.facet_extractions || [];
      await updateSettings(
        {
          facet_extractions: [
            ...currentFacets,
            {
              name: `Ex: ${selectionInfo.text.slice(0, 10)}${selectionInfo.text.length > 10 ? "..." : ""}`,
              regex,
              group: 1,
              enabled: true,
            },
          ],
        },
        activeWorkspace?.id,
      );
      toast.success(`Literal facet extraction added for "${selectionInfo.text}"`);
    }

    setSelectionInfo(null);
    globalThis.getSelection()?.removeAllRanges();
  };

  const hasMore = logs.length < (total ?? 0);
  const rowCount = hasMore ? logs.length + 1 : logs.length;

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
    getItemKey: useCallback(
      (index: number) => {
        if (index === logs.length) {
          return "loader-row";
        }
        return logs[index]?.id ?? index;
      },
      [logs],
    ),
    measureElement: (element) => element?.getBoundingClientRect().height,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    if (virtualItems.length === 0 || !fetchMoreLogs || isFetching) {
      return;
    }
    const lastItem = virtualItems.at(-1);
    const totalCount = total ?? 0;
    if (lastItem && lastItem.index >= logs.length - 10 && logs.length < totalCount) {
      fetchMoreLogs();
    }
  }, [virtualItems, logs.length, total, isFetching, fetchMoreLogs]);

  const prevLogsLength = useRef(logs.length);

  useEffect(() => {
    const hasNewLogs = logs.length > prevLogsLength.current;
    if ((activeJob || isTailing) && hasNewLogs) {
      if (sortOrder === "asc") {
        rowVirtualizer.scrollToIndex(logs.length - 1, { align: "end", behavior: "smooth" });
      } else if (sortBy === "timestamp" || sortBy === "id") {
        const scrollOffset = parentRef.current?.scrollTop || 0;
        if (scrollOffset < 100) {
          rowVirtualizer.scrollToIndex(0, { align: "start", behavior: "smooth" });
        }
      }
    }
    prevLogsLength.current = logs.length;
  }, [logs.length, sortOrder, sortBy, activeJob, isTailing, rowVirtualizer]);

  const handleToggleView = (id: number) => {
    const row = logs.find((l) => l.id === id);
    if (row && expandedRow !== id) {
      setCommentText(row.comment || "");
    }
    setExpandedRow(expandedRow === id ? null : id);
  };

  const handleSelectRow = (id: number, event: React.MouseEvent | React.KeyboardEvent) => {
    const isShift = event.shiftKey;
    const isMeta = event.metaKey || event.ctrlKey;

    if (isShift) {
      const anchorId = selectionAnchorId !== null ? selectionAnchorId : lastSelectedId;
      if (anchorId !== null) {
        const anchorIndex = logs.findIndex((l) => l.id === anchorId);
        const currentIndex = logs.findIndex((l) => l.id === id);

        if (anchorIndex === -1) {
          setSelectedLogIds([id]);
          setSelectionAnchorId(id);
        } else {
          const [start, end] = [
            Math.min(anchorIndex, currentIndex),
            Math.max(anchorIndex, currentIndex),
          ];
          const rangeIds = logs.slice(start, end + 1).map((l) => l.id);
          const newSelection = isMeta
            ? Array.from(new Set([...selectedLogIds, ...rangeIds]))
            : rangeIds;

          setSelectedLogIds(newSelection);
        }
      } else {
        setSelectedLogIds([id]);
        setSelectionAnchorId(id);
      }
    } else if (isMeta) {
      toggleLogSelection(id);
      setSelectionAnchorId(id);
    } else {
      setSelectedLogIds([id]);
      setSelectionAnchorId(id);
    }
    setLastSelectedId(id);
  };

  // Derive Overlay States
  const source = activeWorkspace?.sources?.find((s) => s.id === activeWorkspace?.activeSourceId);
  const isIngesting = isCurrentlyIngesting || !!(activeJob && activeJob.status !== "queued");
  const isQueued = !!(
    activeJob &&
    (activeJob.status === "queued" || (activeJob.status === "pending" && isAnyIngestionProcessing))
  );
  const showPreparing =
    !activeJob &&
    !!(
      activeWorkspace?.activeSourceId && transitioningSourceIds.has(activeWorkspace.activeSourceId)
    ) &&
    logs.length === 0;

  const isIndexing = !!(
    activeJob &&
    (activeJob.status === "processing" || activeJob.status === "pending")
  );
  const showOverlay =
    !showPreparing && !!(isQueued || isIndexing || (isTransitioning && !isTailing));

  const isRehydrating =
    !showPreparing &&
    !isQueued &&
    !isIndexing &&
    logs.length === 0 &&
    isFetching &&
    (source as any)?.is_uploaded;

  const showHydrating =
    !showPreparing &&
    !showOverlay &&
    (isRehydrating ||
      isTransitioning ||
      (!isIngesting && !isQueued && logs.length === 0 && (isFetching || Boolean(source))));

  const isEmpty =
    logs.length === 0 &&
    !showPreparing &&
    !showOverlay &&
    !showHydrating &&
    !isFetching &&
    !isTransitioning &&
    (total === 0 || !source);

  const hasActiveFilters =
    (filters && filters.length > 0) || Boolean(searchQuery && searchQuery.trim().length > 0);

  return (
    <>
      <section
        ref={parentRef}
        className="h-full w-full overflow-auto bg-bg-base border border-border rounded-xl relative select-text custom-scrollbar focus-visible:ring-1 focus-visible:ring-primary/50 outline-none"
        aria-label="Log Table"
        tabIndex={-1}
      >
        <TableOverlays
          showPreparing={showPreparing}
          showHydrating={showHydrating}
          showOverlay={showOverlay}
          isQueued={isQueued}
          isIndexing={isIndexing}
          activeJob={activeJob}
          isEmpty={isEmpty}
          hasActiveFilters={hasActiveFilters}
          searchQuery={searchQuery}
          onClearFilters={() => {
            setFilters([]);
            setSearchQuery("");
          }}
          onImport={onImport}
        />

        {logs.length > 0 && !showPreparing && !showHydrating && !showOverlay && (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            <table className="w-full text-left text-sm border-separate border-spacing-0 block">
              <TableHeader
                gridTemplateColumns={gridTemplateColumns}
                activeVisibleColumns={activeVisibleColumns}
                selectedLogIds={selectedLogIds}
                totalLogsCount={logs.length}
                onToggleSelectAll={() => {
                  if (selectedLogIds.length === logs.length) {
                    handleClearSelection();
                  } else {
                    setSelectedLogIds(logs.map((l) => l.id));
                  }
                }}
                getColumnLabel={getColumnLabel}
                onSort={onSort}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onResizeStart={handleResizeStart}
              />
              <tbody className="font-mono text-xs relative z-0 block">
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const isLoaderRow = virtualRow.index === logs.length;
                  if (isLoaderRow) {
                    return (
                      <tr
                        key="loader-row"
                        ref={rowVirtualizer.measureElement}
                        data-index={virtualRow.index}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          transform: `translateY(${virtualRow.start}px)`,
                          gridTemplateColumns: "1fr",
                        }}
                        className="flex items-center justify-center border-b border-border/20 text-text-muted text-xs font-mono select-none"
                      >
                        <td className="py-4 flex items-center justify-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                          <span>Loading more records...</span>
                        </td>
                      </tr>
                    );
                  }

                  const log = logs[virtualRow.index];
                  const isExpanded = expandedRow === log.id;
                  const isSelected = selectedLogIds.includes(log.id);

                  return (
                    <LogTableRow
                      key={virtualRow.key}
                      log={log}
                      content={getHighlightedElements(log.message, highlights)}
                      virtualRow={virtualRow}
                      isExpanded={isExpanded}
                      isSelected={isSelected}
                      measureElement={rowVirtualizer.measureElement}
                      onSelect={handleSelectRow}
                      onToggleView={handleToggleView}
                      onAnalyzeCluster={onAnalyzeCluster}
                      anomalousClusters={anomalousClusters}
                      logSessionMap={logSessionMap}
                      activeVisibleColumns={activeVisibleColumns}
                      gridTemplateColumns={gridTemplateColumns}
                      customColumns={customColumns}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {expandedRow !== null && (
          <AnnotationDrawer
            expandedRow={expandedRow}
            logs={logs}
            commentText={commentText}
            setCommentText={setCommentText}
            onAddComment={onAddComment}
            onClose={() => setExpandedRow(null)}
          />
        )}
      </section>

      {/* Floating Selection Bar */}
      {selectedLogIds.length > 0 &&
        expandedRow === null &&
        logs.length > 0 &&
        !isTransitioning &&
        !isFetching && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-4 duration-300 pointer-events-none">
            <div className="bg-bg-tooltip border border-white/10 shadow-2xl rounded-full p-1.5 flex items-center gap-2 backdrop-blur-xl pointer-events-auto">
              <span className="pl-4 pr-2 text-xs font-bold text-text-primary">
                {selectedLogIds.length} selected
              </span>
              <div className="w-px h-4 bg-white/10" />
              <Button
                size="sm"
                className="rounded-full bg-violet-600 hover:bg-violet-500 text-white shadow-lg animate-in fade-in slide-in-from-bottom-5 duration-300"
                onClick={() => useAiStore.getState().setSidebarOpen(true)}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                AI Analysis
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full h-8 w-8 p-0 text-text-muted hover:text-text-primary hover:bg-white/5"
                onClick={handleClearSelection}
                title="Clear Selection"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        )}

      {/* Text Selection Floating Portal */}
      {selectionInfo && (
        <SelectionToolbar
          selectionInfo={selectionInfo}
          onAddFilter={handleAddFilter}
          onAddFacet={handleAddFacet}
          onOpenParser={onOpenParser}
          onClose={() => setSelectionInfo(null)}
        />
      )}
    </>
  );
}
