import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  FileUp,
  Minus,
  Plus,
  Rocket,
  Settings2,
  Sparkles,
  StickyNote,
  X,
} from "lucide-react";
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { IconButton } from "@/components/atoms/IconButton";
import { LogLevelBadge } from "@/components/atoms/LogLevelBadge";
import type { FilterEntry } from "@/components/molecules/FilterBuilder";
import type { HighlightEntry } from "@/components/molecules/HighlightBuilder";
import { Button } from "@/components/ui/button";
import type { IngestionJob } from "@/lib/hooks/useIngestionStatus";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { cn } from "@/lib/utils";
import { useAiStore } from "@/store/aiStore";
import { useIngestionStore } from "@/store/ingestionStore";
import { useInvestigationStore } from "@/store/investigationStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUIStore } from "@/store/uiStore";
import { selectActiveWorkspace, useWorkspaceStore } from "@/store/workspaceStore";
import type { LogEntry, LogLevel } from "@/types/log";

interface VirtualLogTableProps {
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
  const [selectionInfo, setSelectionInfo] = useState<{
    text: string;
    x: number;
    y: number;
    field: string;
    logText: string;
    sourceId: string;
  } | null>(null);
  const [lastSelectedId, setLastSelectedId] = useState<number | null>(null);

  const {
    filters,
    setFilters,
    selectedLogIds,
    toggleLogSelection,
    clearSelection,
    setSelectedLogIds,
    isTailing,
  } = useInvestigationStore();
  const { logSessionMap, fetchMapping } = useAiStore();
  const activeWorkspace = useWorkspaceStore(selectActiveWorkspace);
  const ingestingSourceIds = useIngestionStore((state) => state.ingestingSourceIds);
  // Reactive subscription — NOT a getState() snapshot — so isQueued derives correctly on every tick
  const isAnyIngestionProcessing = useIngestionStore((state) =>
    state.jobs.some(
      (j) => j.workspace_id === activeWorkspace?.id && j.status === "processing"
    )
  );
  // Reactive transitioning set so showPreparing updates without getState snapshots
  const transitioningSourceIds = useIngestionStore((state) => state.transitioningSourceIds);
  const isCurrentlyIngesting = useMemo(() => {
    return !!(
      activeWorkspace?.id &&
      activeWorkspace?.activeSourceId &&
      ingestingSourceIds.includes(activeWorkspace.activeSourceId)
    );
  }, [activeWorkspace, ingestingSourceIds]);
  const { visibleColumns, customColumns, columnOrder, columnWidths, setColumnWidth } = useUIStore();


  // Active visible columns ordered by store order
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
      // Escape special regex characters for a literal match
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

  // Scroll threshold detection for infinite pagination
  useEffect(() => {
    if (virtualItems.length === 0 || !fetchMoreLogs || isFetching) {
      return;
    }
    const lastItem = virtualItems.at(-1);
    const totalCount = total ?? 0;
    // Trigger fetch if we scroll within 10 rows of the current batch end
    if (lastItem && lastItem.index >= logs.length - 10 && logs.length < totalCount) {
      fetchMoreLogs();
    }
  }, [virtualItems, logs.length, total, isFetching, fetchMoreLogs]);

  const prevLogsLength = useRef(logs.length);

  // Auto-scroll logic for Tailing / Streaming mode
  useEffect(() => {
    const hasNewLogs = logs.length > prevLogsLength.current;
    if ((activeJob || isTailing) && hasNewLogs) {
      if (sortOrder === "asc") {
        // Scroll to bottom if we are at the end of the file
        rowVirtualizer.scrollToIndex(logs.length - 1, { align: "end", behavior: "smooth" });
      } else if (sortBy === "timestamp" || sortBy === "id") {
        // If newest are at top, ensure we stay at top to see them
        // But only if we were already near the top
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

    if (isShift && lastSelectedId !== null) {
      const lastIndex = logs.findIndex((l) => l.id === lastSelectedId);
      const currentIndex = logs.findIndex((l) => l.id === id);

      if (lastIndex === -1) {
        // Fallback if lastSelectedId is no longer in the visible set
        setSelectedLogIds([id]);
      } else {
        const [start, end] = [Math.min(lastIndex, currentIndex), Math.max(lastIndex, currentIndex)];
        const rangeIds = logs.slice(start, end + 1).map((l) => l.id);

        // If meta is pressed, add range to existing selection; otherwise replace
        const newSelection = isMeta
          ? Array.from(new Set([...selectedLogIds, ...rangeIds]))
          : rangeIds;

        setSelectedLogIds(newSelection);
      }
    } else if (isMeta) {
      toggleLogSelection(id);
    } else {
      // Standard click: select only this item and clear others
      setSelectedLogIds([id]);
    }
    setLastSelectedId(id);
  };

  const renderSortIcon = (field: string) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="h-3 w-3 opacity-20" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="h-3 w-3 text-primary animate-in zoom-in-50" />
    ) : (
      <ArrowDown className="h-3 w-3 text-primary animate-in zoom-in-50" />
    );
  };

  return (
    <>
      <section
        ref={parentRef}
        className="h-full w-full overflow-auto bg-bg-base border border-border rounded-xl relative select-text custom-scrollbar focus-visible:ring-1 focus-visible:ring-primary/50 outline-none"
        aria-label="Log Table"
        tabIndex={-1}
      >
        {/* ─── State Management Overlays ────────────────────────────────────── */}
        {(() => {
          const source = activeWorkspace?.sources?.find((s) => s.id === activeWorkspace?.activeSourceId);
          // Check if any job in the workspace is currently processing.
          // If a job is processing, other newly queued/pending jobs will show a Queue Screen.

          const isIngesting =
            isCurrentlyIngesting || !!(activeJob && activeJob.status !== "queued");
          const isQueued = !!(
            activeJob &&
            (activeJob.status === "queued" ||
              (activeJob.status === "pending" && isAnyIngestionProcessing))
          );
          const showOverlay = (isIngesting || isQueued || (isTransitioning && !isTailing)) && logs.length === 0;

          const showPreparing = !activeJob && !!(
            activeWorkspace?.activeSourceId &&
            transitioningSourceIds.has(activeWorkspace.activeSourceId)
          ) && logs.length === 0;
          
          // Rehydrating screen: source is created, but no logs loaded yet and is_uploaded is true
          const isRehydrating =
            !isIngesting &&
            !isQueued &&
            logs.length === 0 &&
            isFetching &&
            (source as any)?.is_uploaded;
            
          const showHydrating = !showPreparing && (isRehydrating || (!isIngesting && !isQueued && logs.length === 0 && isFetching));

          const isEmpty =
            logs.length === 0 &&
            !isIngesting &&
            !isQueued &&
            !showPreparing &&
            !showHydrating &&
            !isTransitioning &&
            !isFetching;

          if (showPreparing) {
            return (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-500 bg-bg-base/50 backdrop-blur-sm z-50">
                <div className="flex flex-col items-center gap-6 max-w-md w-full">
                  <div className="relative">
                    <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl animate-pulse" />
                    <div className="relative bg-bg-surface border border-border shadow-2xl rounded-2xl p-6">
                      <Sparkles className="size-12 text-primary animate-pulse" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-text-primary animate-pulse">Preparing Ingestion...</h3>
                    <p className="text-sm text-text-muted leading-relaxed">
                      Initializing storage buffers and checking queue status.
                    </p>
                  </div>
                </div>
              </div>
            );
          }

          if (showHydrating) {
            return (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-500 bg-bg-base/50 backdrop-blur-sm z-50">
                <div className="flex flex-col items-center gap-6 max-w-md w-full">
                  <div className="relative">
                    <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl animate-pulse" />
                    <div className="relative bg-bg-surface border border-border shadow-2xl rounded-2xl p-6">
                      <Sparkles className="size-12 text-primary animate-pulse" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-text-primary animate-pulse">Retrieving logs...</h3>
                    <p className="text-sm text-text-muted leading-relaxed">
                      Hydrating log records from storage.
                    </p>
                  </div>
                </div>
              </div>
            );
          }

          if (showOverlay && !showPreparing && !showHydrating) {
            return (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-500 bg-bg-base/50 backdrop-blur-sm z-50">
                <div className="flex flex-col items-center gap-6 max-w-md w-full">
                  {/* Queued state: show amber wait banner instead of the indexing spinner */}
                  {isQueued && activeJob ? (
                    <>
                      <div className="relative">
                        <div className="absolute -inset-4 bg-amber-500/20 rounded-full blur-2xl animate-pulse" />
                        <div className="relative bg-bg-surface border border-amber-500/30 shadow-2xl rounded-2xl p-6">
                          <span className="text-4xl">⏳</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold text-amber-400">Queued for Processing</h3>
                        <p className="text-sm text-text-muted leading-relaxed">
                          {activeJob.queue_position > 1
                            ? `This file is position #${activeJob.queue_position} in the queue. The system processes one file at a time to ensure maximum throughput and data integrity.`
                            : "This file is next in line. Processing will begin momentarily."}
                        </p>
                      </div>
                      <div className="w-full space-y-2">
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 relative">
                          <div className="h-full w-full bg-gradient-to-r from-transparent via-amber-500/60 to-transparent animate-shimmer absolute inset-0" />
                        </div>
                        <p className="text-[10px] text-amber-400/60 font-bold uppercase tracking-widest text-center">
                          {activeJob.total_lines > 0
                            ? `${activeJob.total_lines.toLocaleString()} lines ready to index`
                            : "Counting lines..."}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="relative">
                        <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl animate-pulse" />
                        <div className="relative bg-bg-surface border border-border shadow-2xl rounded-2xl p-6">
                          <Sparkles className="size-12 text-primary animate-pulse" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold text-text-primary">
                          {isIngesting ? "Indexing Dataset..." : "Retrieving Logs..."}
                        </h3>
                        <p className="text-sm text-text-muted leading-relaxed">
                          {isIngesting
                            ? "Building database indices and mapping patterns for the complete file. Almost ready."
                            : "Hydrating log records from storage and applying active filters."}
                        </p>
                      </div>
                      {isIngesting && (
                        <div className="w-full space-y-3">
                          {activeJob ? (
                            <>
                              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-text-muted">
                                <span>
                                  {activeJob.processed_lines.toLocaleString()} /{" "}
                                  {activeJob.total_lines.toLocaleString()} lines
                                </span>
                                <span className="text-primary">
                                  {Math.round(
                                    (activeJob.processed_lines / activeJob.total_lines) * 100,
                                  )}
                                  %
                                </span>
                              </div>
                              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                                <div
                                  className="h-full bg-primary transition-all duration-500 ease-out shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                                  style={{
                                    width: `${(activeJob.processed_lines / activeJob.total_lines) * 100}%`,
                                  }}
                                />
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-text-muted">
                                <span>Preparing Ingestion...</span>
                              </div>
                              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 relative">
                                <div className="h-full w-full bg-gradient-to-r from-transparent via-primary/80 to-transparent animate-shimmer absolute inset-0" />
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="mt-12 flex items-center gap-6 text-[10px] font-bold uppercase tracking-widest text-text-muted/30">
                  <div className="flex items-center gap-1.5">
                    <Download className="size-3" /> local files
                  </div>
                  <div className="w-1 h-1 rounded-full bg-current" />
                  <div className="flex items-center gap-1.5">
                    <Rocket className="size-3" /> live streams
                  </div>
                  <div className="w-1 h-1 rounded-full bg-current" />
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="size-3" /> ssh tailing
                  </div>
                </div>
              </div>
            );
          }

          if (isEmpty) {
            return (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-500">
                <div className="relative mb-6">
                  <div className="absolute -inset-4 bg-primary/10 rounded-full blur-2xl animate-pulse" />
                  <div className="relative bg-bg-surface border border-border shadow-2xl rounded-2xl p-6">
                    <FileUp className="size-12 text-primary" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-text-primary">No logs detected</h3>
                <p className="text-sm text-text-muted mt-2 max-w-[280px] leading-relaxed">
                  This workspace is currently empty. Connect a data source or upload a log file to
                  begin analysis.
                </p>
                <Button
                  onClick={onImport}
                  className="mt-8 px-8 py-6 rounded-2xl bg-primary hover:bg-primary-hover text-white font-bold shadow-xl shadow-primary/20 transition-all active:scale-95 group"
                >
                  <Rocket className="size-5 mr-2 group-hover:animate-bounce" />
                  Import First Log
                </Button>
                <div className="mt-12 flex items-center gap-6 text-[10px] font-bold uppercase tracking-widest text-text-muted/30">
                  <div className="flex items-center gap-1.5">
                    <Download className="size-3" /> local files
                  </div>
                  <div className="w-1 h-1 rounded-full bg-current" />
                  <div className="flex items-center gap-1.5">
                    <Rocket className="size-3" /> live streams
                  </div>
                  <div className="w-1 h-1 rounded-full bg-current" />
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="size-3" /> ssh tailing
                  </div>
                </div>
              </div>
            );
          }

          return (
            logs.length > 0 && (
              <>


                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative",
                  }}
                >
                  <table className="w-full text-left text-sm border-separate border-spacing-0 block">
                    <thead className="sticky top-0 bg-bg-surface border-b border-border z-10 text-text-muted text-[10px] font-bold uppercase tracking-widest h-10 select-none block">
                      <tr className="grid w-full items-center" style={{ gridTemplateColumns }}>
                        <th
                          className="p-0 transition-colors group/select-all"
                          title={
                            selectedLogIds.length === logs.length ? "Deselect All" : "Select All"
                          }
                        >
                          <Button
                            variant="ghost"
                            className="w-full h-10 flex items-center justify-center hover:bg-white/5 outline-none focus-visible:bg-white/10 rounded-none border-none p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (selectedLogIds.length === logs.length) {
                                clearSelection();
                              } else {
                                setSelectedLogIds(logs.map((l) => l.id));
                              }
                            }}
                            aria-label={
                              selectedLogIds.length === logs.length ? "Deselect All" : "Select All"
                            }
                          >
                            <div
                              className={cn(
                                "w-1 h-4 rounded-full transition-all",
                                selectedLogIds.length === logs.length
                                  ? "bg-emerald-500"
                                  : "bg-white/10 group-hover/select-all:bg-white/30",
                              )}
                            />
                          </Button>
                        </th>
                        {activeVisibleColumns.map((colId) => {
                          const isSortable = [
                            "id",
                            "timestamp",
                            "ingest_timestamp",
                            "level",
                            "cluster_id",
                          ].includes(colId);
                          const label = getColumnLabel(colId);

                          return (
                            <th
                              key={colId}
                              className="p-0 text-left flex items-center relative group/header min-w-0"
                            >
                              {isSortable ? (
                                <Button
                                  variant="ghost"
                                  className="w-full h-10 px-3 flex items-center justify-start gap-1.5 hover:text-text-primary transition-colors focus-visible:bg-primary/5 outline-none rounded-none border-none font-bold uppercase tracking-widest text-[10px] min-w-0"
                                  onClick={() => onSort(colId)}
                                >
                                  <span className="truncate">{label}</span>
                                  {renderSortIcon(colId)}
                                </Button>
                              ) : (
                                <div className="w-full h-10 px-3 flex items-center justify-start gap-1.5 font-bold uppercase tracking-widest text-[10px] text-text-muted min-w-0">
                                  <span className="truncate">{label}</span>
                                </div>
                              )}

                              {/* Drag handle for resizing (excluding actions and message) */}
                              {colId !== "actions" && colId !== "message" && (
                                <button
                                  type="button"
                                  aria-label={`Resize ${label} column`}
                                  className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/50 active:bg-primary transition-colors z-20 group-hover/header:bg-white/10 border-none bg-transparent p-0 outline-none"
                                  onMouseDown={(e) => handleResizeStart(e, colId)}
                                />
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="font-mono text-[12px] relative z-0 block">
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
                              <td className="w-full text-center py-3 flex items-center justify-center gap-2">
                                <span className="inline-block w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                Loading more records ({logs.length} / {total?.toLocaleString()})...
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
              </>
            )
          );
        })()}

        {expandedRow !== null && (
          <div
            id={`row-details-${expandedRow}`}
            className="sticky bottom-0 left-0 w-full bg-bg-tooltip/95 border-t border-white/10 p-6 shadow-2xl z-20 animate-in slide-in-from-bottom duration-300 backdrop-blur-xl max-h-[400px]"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-3">
                <div className="bg-primary/10 p-1.5 rounded-lg border border-primary/20">
                  <StickyNote className="h-4 w-4 text-primary" />
                </div>
                Log Entry Annotation
                <span className="text-text-muted font-mono text-[10px] ml-2 opacity-50 bg-white/5 px-2 py-0.5 rounded-full">
                  Line: {(logs.find((l) => l.id === expandedRow)?.line_id ?? -1) + 1 || expandedRow}
                </span>
              </h3>
              <div className="flex items-center gap-3">
                {logs.find((l) => l.id === expandedRow)?.has_comment && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-4 text-[11px] font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors uppercase tracking-widest"
                    onClick={() => {
                      if (expandedRow !== null) {
                        onAddComment(expandedRow, "");
                        setCommentText("");
                        toast.success("Note cleared");
                      }
                    }}
                  >
                    Delete Note
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-6 text-[11px] font-bold uppercase tracking-widest border-primary/20 bg-primary/5 hover:bg-primary/10 hover:text-primary transition-all rounded-lg"
                  onClick={() => {
                    if (expandedRow !== null) {
                      onAddComment(expandedRow, commentText);
                      toast.success("Note saved");
                    }
                  }}
                >
                  Save Note
                </Button>
                <div className="w-px h-6 bg-white/10 mx-1" />
                <IconButton
                  icon={<X className="h-4 w-4" />}
                  label="Close Annotation"
                  onClick={() => setExpandedRow(null)}
                  className="text-text-muted hover:text-text-primary hover:bg-white/10 transition-colors bg-white/5 rounded-lg h-9 w-9"
                />
              </div>
            </div>

            <div className="relative group max-w-4xl mx-auto">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 via-transparent to-primary/10 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity duration-1000" />
              <textarea
                id={`note-editor-${expandedRow}`}
                className="relative w-full h-[180px] text-[13px] font-sans leading-relaxed text-text-primary bg-bg-base/60 p-6 rounded-2xl border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none placeholder:text-text-muted/20 scrollbar-thin"
                placeholder="Add investigation details, identified causes, or diagnostic insights for this log entry..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
            </div>
          </div>
        )}
      </section>
      {selectedLogIds.length > 0 && expandedRow === null && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-bg-tooltip border border-white/10 shadow-2xl rounded-full p-1.5 flex items-center gap-2 backdrop-blur-xl">
            <span className="pl-4 pr-2 text-xs font-bold text-text-primary">
              {selectedLogIds.length} lines selected
            </span>
            <div className="w-px h-4 bg-white/10" />
            <Button
              size="sm"
              className="rounded-full bg-violet-600 hover:bg-violet-500 text-white shadow-lg animate-in fade-in slide-in-from-bottom-5 duration-300"
              onClick={() => useAiStore.getState().setSidebarOpen(true)}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Batch AI Analysis ({selectedLogIds.length})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full h-8 w-8 p-0 text-text-muted hover:text-text-primary hover:bg-white/5"
              onClick={clearSelection}
              title="Clear Selection"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      )}
      {selectionInfo &&
        createPortal(
          <div
            role="toolbar"
            aria-label="Selection actions"
            className="fixed z-[200] flex items-center gap-1 bg-bg-tooltip border border-white/10 shadow-2xl rounded-full p-1 animate-in fade-in slide-in-from-bottom-2"
            style={{
              left: selectionInfo.x,
              top: selectionInfo.y,
              transform: "translateX(-50%)",
            }}
            onMouseDown={(e) => e.preventDefault()} // Keep selection
          >
            <Button
              variant="ghost"
              size="xs"
              onClick={() => handleAddFilter("contains")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors cursor-pointer border-none"
            >
              <Plus className="size-3" /> Include
            </Button>
            <div className="w-px h-4 bg-white/10" />
            <Button
              variant="ghost"
              size="xs"
              onClick={() => handleAddFilter("not_contains")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer border-none"
            >
              <Minus className="size-3" /> Exclude
            </Button>
            <div className="w-px h-4 bg-white/10" />
            <Button
              variant="ghost"
              size="xs"
              onClick={() => handleAddFacet(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer border-none"
              title="Use AI to generate a smart extraction regex"
            >
              <Sparkles className="size-3" /> AI Facet
            </Button>
            <div className="w-px h-4 bg-white/10" />
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                if (selectionInfo?.sourceId && onOpenParser) {
                  onOpenParser(selectionInfo.sourceId, null);
                  setSelectionInfo(null);
                  globalThis.getSelection()?.removeAllRanges();
                } else {
                  toast.info("Select a specific log source to use the parser map.");
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-white/5 text-text-muted hover:text-text-primary hover:bg-white/10 transition-colors cursor-pointer border-none"
            >
              <Settings2 className="size-3" /> Map Field
            </Button>
          </div>,
          document.body,
        )}
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRowLevelStyles(level: LogLevel): string {
  switch (level) {
    case "FATAL":
    case "CRITICAL":
    case "ERROR":
      return "bg-error/5 border-l-2 border-error hover:bg-error/10";
    case "WARN":
      return "bg-warning/5 border-l-2 border-warning hover:bg-warning/10";
    case "INFO":
      return "bg-info/3 hover:bg-info/8 text-info/90";
    case "DEBUG":
      return "bg-debug/2 hover:bg-debug/5 text-debug/80";
    case "TRACE":
    case "VERBOSE":
      return "bg-primary-muted/5 border-l-2 border-primary-muted/30 hover:bg-primary-muted/10";
    default:
      return "hover:bg-bg-hover";
  }
}

function getClusterStyles(clusterId: string, anomalousClusters?: Set<string>): string {
  if (clusterId === "unknown") {
    return "bg-zinc-800/50 border-zinc-700/30 text-zinc-500";
  }

  if (anomalousClusters?.has(clusterId)) {
    return "bg-orange-500/20 border-orange-500/40 text-orange-400 hover:bg-orange-500/30";
  }

  return "bg-primary/10 border-primary/20 text-primary hover:bg-primary/20";
}

function getHighlightedElements(text: string, highlights: HighlightEntry[]) {
  if (!highlights || highlights.length === 0 || !text) {
    return <>{text}</>;
  }

  const terms: string[] = [];
  for (const h of highlights) {
    if (h.term) {
      terms.push(h.term.replaceAll(/[-[\]{}()*+?.,\\^$|#\s]/g, String.raw`\$&`));
    }
  }

  if (terms.length === 0) {
    return <>{text}</>;
  }

  const regex = new RegExp(`(${terms.join("|")})`, "gi");
  const parts = text.split(regex);

  let currentPos = 0;
  return (
    <>
      {parts.map((part) => {
        const startPos = currentPos;
        currentPos += part.length;

        const match = highlights.find((h) => h.term?.toLowerCase() === part.toLowerCase());

        if (match) {
          return (
            <mark
              key={`${match.id}-${startPos}`}
              className="px-0.5 rounded-sm font-bold transition-all transition-duration-300"
              style={{
                backgroundColor: `${match.color}25`,
                color: match.color,
                border: `1px solid ${match.color}40`,
                boxShadow: `0 0 8px ${match.color}15`,
              }}
            >
              {part}
            </mark>
          );
        }
        return <Fragment key={`text-${startPos}`}>{part}</Fragment>;
      })}
    </>
  );
}

// ─── Helpers & Components ──────────────────────────────────────────────────────

function findFieldAndSource(anchorNode: Node | null): { field: string; sourceId: string } {
  let field = "raw_text";
  let sourceId = "";
  let node = anchorNode;
  while (node && node.nodeType !== Node.DOCUMENT_NODE) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.dataset.field) {
        field = el.dataset.field;
      }
      if (el.dataset.sourceId) {
        sourceId = el.dataset.sourceId;
      }
      if (field !== "raw_text" && sourceId) {
        break;
      }
    }
    node = node.parentNode;
  }
  return { field, sourceId };
}

function getSelectionDetails(selection: Selection) {
  if (selection.isCollapsed) {
    return null;
  }
  const text = selection.toString().trim();
  if (!text) {
    return null;
  }
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const { field, sourceId } = findFieldAndSource(selection.anchorNode);
  const logText = selection.anchorNode?.parentElement?.innerText || "";

  return {
    text,
    x: rect.left + rect.width / 2,
    y: rect.bottom + globalThis.scrollY + 10,
    field,
    logText,
    sourceId,
  };
}

interface LogTableRowProps {
  readonly log: LogEntry;
  readonly content: React.ReactNode;
  readonly virtualRow: VirtualItem;
  readonly isExpanded: boolean;
  readonly isSelected: boolean;
  readonly measureElement: (el: HTMLElement | null) => void;
  readonly onSelect: (id: number, e: React.MouseEvent | React.KeyboardEvent) => void;
  readonly onToggleView: (id: number) => void;
  readonly onAnalyzeCluster?: (clusterId: string) => void;
  readonly anomalousClusters?: Set<string>;
  readonly logSessionMap: Record<number, string>;
  readonly activeVisibleColumns: string[];
  readonly gridTemplateColumns: string;
  readonly customColumns: Array<{ id: string; label: string; source?: string; regex?: string }>;
}

interface LogTableCellProps {
  readonly colId: string;
  readonly log: LogEntry;
  readonly content: React.ReactNode;
  readonly anomalousClusters?: Set<string>;
  readonly onAnalyzeCluster?: (clusterId: string) => void;
  readonly onToggleView: (id: number) => void;
  readonly logSessionMap: Record<number, string>;
  readonly customColumns: any[];
}

interface ClusterCellProps {
  readonly log: LogEntry;
  readonly anomalousClusters?: Set<string>;
  readonly onAnalyzeCluster?: (clusterId: string) => void;
}
function ClusterCell({ log, anomalousClusters, onAnalyzeCluster }: ClusterCellProps) {
  return (
    <td
      key="cluster_id"
      className="px-3 py-2 text-center align-top flex flex-col items-center justify-start"
    >
      {log.cluster_id ? (
        <div className="flex flex-col items-center justify-center gap-0.5 group/cluster">
          <Button
            variant="ghost"
            className={cn(
              "inline-flex items-center justify-center border h-5 px-1.5 rounded-md text-[9px] font-bold transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary p-0 min-w-0",
              getClusterStyles(log.cluster_id, anomalousClusters),
            )}
            title={log.cluster_template || "Click to analyze with AI"}
            onClick={(e) => {
              if (log.cluster_id && onAnalyzeCluster) {
                e.stopPropagation();
                onAnalyzeCluster(log.cluster_id);
              }
            }}
          >
            #{log.cluster_id}
          </Button>
          {log.cluster_percent !== undefined && (
            <span className="text-[8px] text-text-muted/60 font-medium whitespace-nowrap">
              {Number(log.cluster_percent).toFixed(1)}%
            </span>
          )}
        </div>
      ) : (
        <span className="opacity-10">—</span>
      )}
    </td>
  );
}

interface ActionsCellProps {
  readonly log: LogEntry;
  readonly logSessionMap: Record<number, string>;
  readonly onToggleView: (id: number) => void;
}
function ActionsCell({ log, logSessionMap, onToggleView }: ActionsCellProps) {
  const { setSidebarOpen, setSession } = useAiStore();
  const { clearSelection, setSelectedLogIds } = useInvestigationStore();

  return (
    <td
      key="actions"
      className="px-3 py-2 text-center relative align-top flex items-start justify-center"
    >
      <div className="flex items-center justify-center gap-1">
        <IconButton
          icon={
            <StickyNote
              className={cn("h-3.5 w-3.5", log.has_comment && "text-primary fill-primary/20")}
            />
          }
          label={log.has_comment ? "View Note" : "Add Note"}
          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            onToggleView(log.id);
          }}
          className={cn(
            "transition-all h-7 w-7 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10",
            log.has_comment
              ? "opacity-100 text-primary bg-primary/20"
              : "opacity-0 group-hover:opacity-100",
          )}
        />
        <IconButton
          icon={
            <Sparkles
              className={cn(
                "h-3.5 w-3.5 transition-all",
                logSessionMap[log.id] && "text-violet-400 fill-violet-400/20",
              )}
            />
          }
          label={logSessionMap[log.id] ? "View AI Investigation" : "Start AI Analysis"}
          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            const existingSessionId = logSessionMap[log.id];

            if (existingSessionId) {
              setSession(existingSessionId);
            } else {
              setSession(null);
              clearSelection();
              setSelectedLogIds([log.id]);
            }
            setSidebarOpen(true);
          }}
          className={cn(
            "transition-all h-7 w-7 rounded-lg",
            logSessionMap[log.id]
              ? "opacity-100 bg-violet-500/10 border border-violet-500/20 text-violet-400"
              : "text-text-muted hover:text-violet-400 hover:bg-violet-500/10 opacity-0 group-hover:opacity-100",
          )}
        />
      </div>
    </td>
  );
}

interface CustomFacetCellProps {
  readonly log: LogEntry;
  readonly custom: any;
}
function CustomFacetCell({ log, custom }: CustomFacetCellProps) {
  let cellValue: string | null = null;
  if (custom.source === "auto") {
    cellValue = log.facets?.[custom.id] ?? null;
  } else if (custom.regex) {
    try {
      const m = new RegExp(custom.regex).exec(log.raw_text ?? log.message);
      cellValue = m?.[1] ?? m?.[0] ?? null;
    } catch {
      cellValue = null;
    }
  }

  // Color-code HTTP status values
  const isStatus = custom.id === "http_status" && cellValue;
  const statusCode = isStatus ? Number.parseInt(cellValue ?? "0", 10) : 0;

  let statusColor = "text-primary";
  if (statusCode >= 500) {
    statusColor = "text-red-400";
  } else if (statusCode >= 400) {
    statusColor = "text-yellow-400";
  } else if (statusCode >= 300) {
    statusColor = "text-blue-400";
  }

  const className = cn(
    "font-mono font-semibold",
    isStatus ? statusColor : "text-text-secondary/80",
  );

  return (
    <td
      key={custom.id}
      className="px-3 py-2 align-top whitespace-nowrap overflow-hidden text-ellipsis text-[11px]"
    >
      {cellValue === null ? (
        <span className="text-text-muted/30">—</span>
      ) : (
        <span className={className}>{cellValue}</span>
      )}
    </td>
  );
}

function LogTableCell({
  colId,
  log,
  content,
  anomalousClusters,
  onAnalyzeCluster,
  onToggleView,
  logSessionMap,
  customColumns,
}: Readonly<LogTableCellProps>) {
  switch (colId) {
    case "id":
      return (
        <td
          key="id"
          className="px-3 py-2 text-center text-text-muted/50 select-none group-hover:text-text-secondary align-top font-bold"
        >
          {log.line_id + 1}
        </td>
      );
    case "timestamp":
      return (
        <td
          key="timestamp"
          className="px-3 py-2 text-text-secondary/70 align-top opacity-80 break-all whitespace-pre-wrap leading-tight"
        >
          {log.timestamp}
        </td>
      );
    case "ingest_timestamp":
      return (
        <td
          key="ingest_timestamp"
          className="px-3 py-2 text-text-secondary/70 align-top opacity-80 break-all whitespace-pre-wrap leading-tight"
        >
          {log.ingest_timestamp || log.timestamp}
        </td>
      );
    case "level":
      return (
        <td key="level" className="px-3 py-2 align-top flex items-start">
          <LogLevelBadge level={log.level} className="scale-75 origin-left" />
        </td>
      );
    case "message":
      return (
        <td
          key="message"
          className="px-3 py-2 text-text-primary/90 align-top whitespace-pre-wrap font-mono text-[11px] break-words leading-normal min-w-0"
        >
          <div className="max-w-full overflow-hidden">{content}</div>
        </td>
      );
    case "cluster_id":
      return (
        <ClusterCell
          log={log}
          anomalousClusters={anomalousClusters}
          onAnalyzeCluster={onAnalyzeCluster}
        />
      );
    case "actions":
      return <ActionsCell log={log} logSessionMap={logSessionMap} onToggleView={onToggleView} />;
    default: {
      const custom = customColumns.find((c) => c.id === colId);
      if (custom) {
        return <CustomFacetCell log={log} custom={custom} />;
      }
      return null;
    }
  }
}

const LogTableRow = memo(function LogTableRow({
  log,
  content,
  virtualRow,
  isExpanded,
  isSelected,
  measureElement,
  onSelect,
  onToggleView,
  onAnalyzeCluster,
  anomalousClusters,
  logSessionMap,
  activeVisibleColumns,
  gridTemplateColumns,
  customColumns,
}: LogTableRowProps) {
  return (
    <tr
      ref={measureElement}
      data-index={virtualRow.index}
      data-source-id={log.source_id}
      tabIndex={0}
      aria-expanded={isExpanded}
      aria-controls={isExpanded ? `row-details-${log.id}` : undefined}
      className={cn(
        "group cursor-pointer transition-colors border-b border-border/40 outline-none focus-visible:bg-bg-hover focus-visible:ring-1 focus-visible:ring-primary/30 relative",
        "grid items-stretch",
        getRowLevelStyles(log.level),
        isSelected && "bg-emerald-500/[0.04]",
        isExpanded && "bg-bg-hover ring-1 ring-primary/20 z-10",
      )}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        transform: `translateY(${virtualRow.start}px)`,
        gridTemplateColumns,
      }}
      onClick={(e) => onSelect(log.id, e)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(log.id, e);
        }
      }}
    >
      <td className="p-0 relative select-none flex items-center justify-center">
        <div className="w-full h-full flex items-center justify-center min-h-[32px]">
          {isSelected && (
            <div className="absolute inset-y-1.5 left-0 w-1 bg-emerald-500 rounded-r-full shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
          )}
        </div>
      </td>
      {activeVisibleColumns.map((colId) => (
        <LogTableCell
          key={colId}
          colId={colId}
          log={log}
          content={content}
          anomalousClusters={anomalousClusters}
          onAnalyzeCluster={onAnalyzeCluster}
          onToggleView={onToggleView}
          logSessionMap={logSessionMap}
          customColumns={customColumns}
        />
      ))}
    </tr>
  );
});
