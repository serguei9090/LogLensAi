import { IconButton } from "@/components/atoms/IconButton";
import { type LogLevel, LogLevelBadge } from "@/components/atoms/LogLevelBadge";
import type { HighlightEntry } from "@/components/molecules/HighlightBuilder";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAiStore } from "@/store/aiStore";
import { useInvestigationStore } from "@/store/investigationStore";
import { selectActiveWorkspace, useWorkspaceStore } from "@/store/workspaceStore";
import { type FilterEntry } from "@/components/molecules/FilterBuilder";
import { type VirtualItem, useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Minus,
  Plus,
  Settings2,
  Sparkles,
  StickyNote,
  X,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

export interface LogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  message: string;
  cluster_id: string;
  cluster_percent?: number;
  cluster_template?: string;
  has_comment?: boolean;
  comment?: string;
  raw_text?: string;
}

interface VirtualLogTableProps {
  readonly logs: LogEntry[];
  readonly highlights: HighlightEntry[];
  readonly onAddComment: (id: number, comment: string) => void;
  readonly onSort: (sortBy: string) => void;
  readonly onAnalyzeCluster?: (clusterId: string) => void;
  readonly sortBy: string;
  readonly sortOrder: "asc" | "desc";
  readonly anomalousClusters?: Set<string>;
}

export function VirtualLogTable({
  logs,
  highlights,
  onAddComment,
  onSort,
  onAnalyzeCluster,
  sortBy,
  sortOrder,
  anomalousClusters,
}: VirtualLogTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [commentText, setCommentText] = useState("");
  const [selectionInfo, setSelectionInfo] = useState<{
    text: string;
    x: number;
    y: number;
    field: string;
  } | null>(null);
  const [lastSelectedId, setLastSelectedId] = useState<number | null>(null);

  const {
    filters,
    setFilters,
    selectedLogIds,
    toggleLogSelection,
    clearSelection,
    setSelectedLogIds,
  } = useInvestigationStore();
  const { logSessionMap, fetchMapping } = useAiStore();
  const activeWorkspace = useWorkspaceStore(selectActiveWorkspace);

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
    if (!selection || selection.isCollapsed) {
      setSelectionInfo(null);
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      setSelectionInfo(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Determine the field based on the closest data-field attribute
    let field = "raw_text";
    let node = selection.anchorNode;
    while (node && node.nodeType !== Node.DOCUMENT_NODE) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.dataset.field) {
          field = el.dataset.field;
          break;
        }
      }
      node = node.parentNode;
    }

    setSelectionInfo({
      text,
      x: rect.left + rect.width / 2,
      y: rect.bottom + globalThis.scrollY + 10,
      field,
    });
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

  const rowVirtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
    measureElement: (element) => element?.getBoundingClientRect().height,
  });

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

  const getAriaSort = (field: string): "ascending" | "descending" | "none" => {
    if (sortBy !== field) {
      return "none";
    }
    return sortOrder === "asc" ? "ascending" : "descending";
  };

  return (
    <>
      <section
        ref={parentRef}
        className="h-full w-full overflow-auto bg-bg-base border border-border rounded-xl relative select-text custom-scrollbar focus-visible:ring-1 focus-visible:ring-primary/50 outline-none"
        aria-label="Log Table"
        tabIndex={-1}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          <table className="w-full text-left text-sm whitespace-nowrap table-fixed border-separate border-spacing-0">
            <thead className="sticky top-0 bg-bg-surface border-b border-border z-10 text-text-muted text-[10px] font-bold uppercase tracking-widest h-10 select-none">
              <tr>
                <th
                  className="w-[12px] p-0 transition-colors group/select-all"
                  title={selectedLogIds.length === logs.length ? "Deselect All" : "Select All"}
                >
                  <button
                    type="button"
                    className="w-full h-10 flex items-center justify-center hover:bg-white/5 outline-none focus-visible:bg-white/10"
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
                  </button>
                </th>
                <th className="w-[60px] p-0 text-center" aria-sort={getAriaSort("id")}>
                  <button
                    type="button"
                    className="w-full h-10 px-3 flex items-center justify-center gap-1.5 hover:text-text-primary transition-colors focus-visible:bg-primary/5 outline-none"
                    onClick={() => onSort("id")}
                  >
                    ID {renderSortIcon("id")}
                  </button>
                </th>
                <th className="w-[180px] p-0 text-left" aria-sort={getAriaSort("timestamp")}>
                  <button
                    type="button"
                    className="w-full h-10 px-3 flex items-center gap-1.5 hover:text-text-primary transition-colors focus-visible:bg-primary/5 outline-none"
                    onClick={() => onSort("timestamp")}
                  >
                    Timestamp {renderSortIcon("timestamp")}
                  </button>
                </th>
                <th className="w-[90px] p-0 text-left" aria-sort={getAriaSort("level")}>
                  <button
                    type="button"
                    className="w-full h-10 px-3 flex items-center gap-1.5 hover:text-text-primary transition-colors focus-visible:bg-primary/5 outline-none"
                    onClick={() => onSort("level")}
                  >
                    Level {renderSortIcon("level")}
                  </button>
                </th>
                <th className="px-3 py-1">Message</th>
                <th className="w-[110px] p-0 text-center" aria-sort={getAriaSort("cluster_id")}>
                  <button
                    type="button"
                    className="w-full h-10 px-3 flex items-center justify-center gap-1.5 hover:text-text-primary transition-colors focus-visible:bg-primary/5 outline-none"
                    onClick={() => onSort("cluster_id")}
                  >
                    Cluster {renderSortIcon("cluster_id")}
                  </button>
                </th>
                <th className="w-[100px] p-0 text-center">
                  <div className="w-full h-10 px-3 flex items-center justify-center gap-1.5">
                    Actions
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="font-mono text-[12px] relative z-0">
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
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
                  />
                );
              })}
            </tbody>
          </table>
        </div>

        {expandedRow !== null && (
          <div
            id={`row-details-${expandedRow}`}
            className="sticky bottom-0 left-0 w-full bg-[#111312]/95 border-t border-white/10 p-6 shadow-2xl z-20 animate-in slide-in-from-bottom duration-300 backdrop-blur-xl max-h-[400px]"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-3">
                <div className="bg-primary/10 p-1.5 rounded-lg border border-primary/20">
                  <StickyNote className="h-4 w-4 text-primary" />
                </div>
                Log Entry Annotation
                <span className="text-text-muted font-mono text-[10px] ml-2 opacity-50 bg-white/5 px-2 py-0.5 rounded-full">
                  ID: {expandedRow}
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

      {/* Batch Selection Action Pill */}
      {selectedLogIds.length > 0 && expandedRow === null && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-[#111312] border border-white/10 shadow-2xl rounded-full p-1.5 flex items-center gap-2 backdrop-blur-xl">
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

      {/* Floating Selection Tooltip (for text) */}
      {selectionInfo &&
        createPortal(
          <div
            role="toolbar"
            aria-label="Selection actions"
            className="fixed z-[200] flex items-center gap-1 bg-[#111312] border border-white/10 shadow-2xl rounded-full p-1 animate-in fade-in slide-in-from-bottom-2"
            style={{
              left: selectionInfo.x,
              top: selectionInfo.y,
              transform: "translateX(-50%)",
            }}
            onMouseDown={(e) => e.preventDefault()} // Keep selection
          >
            <button
              type="button"
              onClick={() => handleAddFilter("contains")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors cursor-pointer"
            >
              <Plus className="size-3" /> Include
            </button>
            <div className="w-px h-4 bg-white/10" />
            <button
              type="button"
              onClick={() => handleAddFilter("not_contains")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
            >
              <Minus className="size-3" /> Exclude
            </button>
            <div className="w-px h-4 bg-white/10" />
            <button
              type="button"
              onClick={() => {
                // Future Parse logic
                toast.info("Parser map feature coming soon.");
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-white/5 text-text-muted hover:text-text-primary hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Settings2 className="size-3" /> Map Field
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRowLevelStyles(level: LogLevel): string {
  switch (level) {
    case "ERROR":
      return "bg-error/5 border-l-2 border-error hover:bg-error/10";
    case "WARN":
      return "bg-warning/5 border-l-2 border-warning hover:bg-warning/10";
    case "INFO":
      return "bg-info/3 hover:bg-info/8 text-info/90";
    case "DEBUG":
      return "bg-debug/2 hover:bg-debug/5 text-debug/80";
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

// ─── Components ───────────────────────────────────────────────────────────────

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
}

function LogTableRow({
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
}: LogTableRowProps) {
  const { setSidebarOpen, setSession } = useAiStore();
  const { clearSelection, setSelectedLogIds } = useInvestigationStore();

  return (
    <tr
      ref={measureElement}
      data-index={virtualRow.index}
      tabIndex={0}
      aria-expanded={isExpanded}
      aria-controls={isExpanded ? `row-details-${log.id}` : undefined}
      className={cn(
        "group cursor-pointer transition-all border-b border-border/40 outline-none focus-visible:bg-bg-hover focus-visible:ring-1 focus-visible:ring-primary/30 relative",
        getRowLevelStyles(log.level),
        isSelected && "bg-emerald-500/[0.04] !border-l-emerald-500",
        !isSelected && "border-l-transparent",
        isExpanded && "bg-bg-hover ring-1 ring-primary/20 z-10",
      )}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        transform: `translateY(${virtualRow.start}px)`,
        borderLeftWidth: "3px",
        borderLeftStyle: "solid",
      }}
      onClick={(e) => onSelect(log.id, e)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(log.id, e);
        }
      }}
    >
      <td className="w-[60px] px-3 py-2 text-center text-text-muted/50 select-none group-hover:text-text-secondary align-top font-bold">
        {log.id}
      </td>
      <td className="w-[180px] px-3 py-2 text-text-secondary/70 align-top opacity-80">
        {log.timestamp}
      </td>
      <td className="w-[90px] px-3 py-2 align-top">
        <LogLevelBadge level={log.level} className="scale-75 origin-left" />
      </td>
      <td className="px-3 py-2 text-text-primary/90 overflow-hidden align-top whitespace-normal break-words leading-relaxed">
        {content}
      </td>
      <td className="w-[110px] px-3 py-2 text-center align-top border-x border-border/5">
        {log.cluster_id ? (
          <div
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 group/cluster",
              log.cluster_id !== "unknown" && "animate-in fade-in zoom-in-95 duration-500",
            )}
          >
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center border h-5 px-1.5 rounded-md text-[9px] font-bold transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary",
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
            </button>
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
      <td className="w-[100px] px-3 py-2 text-center relative align-top">
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
              !log.has_comment && "opacity-0 group-hover:opacity-100",
              log.has_comment && "opacity-100 text-primary bg-primary/20",
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
    </tr>
  );
}
