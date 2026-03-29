import { IconButton } from "@/components/atoms/IconButton";
import { type LogLevel, LogLevelBadge } from "@/components/atoms/LogLevelBadge";
import type { HighlightEntry } from "@/components/molecules/HighlightBuilder";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useInvestigationStore } from "@/store/investigationStore";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  MessageSquarePlus,
  Minus,
  Plus,
  Settings2,
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

  const { filters, setFilters } = useInvestigationStore();
  const addFilter = (f: any) => setFilters([...filters, f]);

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
    if (!el) return;

    el.addEventListener("mouseup", handleSelection);
    return () => el.removeEventListener("mouseup", handleSelection);
  }, [handleSelection]);

  const handleAddFilter = (operator: "contains" | "not_contains") => {
    if (!selectionInfo) return;
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

  const getHighlightedElements = (text: string) => {
    if (!highlights || highlights.length === 0 || !text) return <>{text}</>;

    const terms: string[] = [];
    highlights.forEach((h) => {
      if (h.term) {
        terms.push(h.term.replaceAll(/[-[\]{}()*+?.,\\^$|#\s]/g, String.raw`\$&`));
      }
    });

    if (terms.length === 0) return <>{text}</>;

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
  };

  const toggleRow = (id: number) => {
    const row = logs.find((l) => l.id === id);
    if (row && expandedRow !== id) {
      setCommentText(row.comment || "");
    }
    setExpandedRow(expandedRow === id ? null : id);
  };

  const renderSortIcon = (field: string) => {
    if (sortBy !== field) return <ArrowUpDown className="h-3 w-3 opacity-20" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="h-3 w-3 text-primary animate-in zoom-in-50" />
    ) : (
      <ArrowDown className="h-3 w-3 text-primary animate-in zoom-in-50" />
    );
  };

  const getAriaSort = (field: string): "ascending" | "descending" | "none" => {
    if (sortBy !== field) return "none";
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
          <table className="w-full text-left text-sm whitespace-nowrap table-fixed">
            <thead className="sticky top-0 bg-bg-surface border-b border-border z-10 text-text-muted text-[10px] font-bold uppercase tracking-widest h-10 select-none">
              <tr>
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
                <th className="w-[90px] p-0 text-center" aria-sort={getAriaSort("has_comment")}>
                  <button
                    type="button"
                    className="w-full h-10 px-3 flex items-center justify-center gap-1.5 hover:text-text-primary transition-colors focus-visible:bg-primary/5 outline-none"
                    onClick={() => onSort("has_comment")}
                  >
                    Note {renderSortIcon("has_comment")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="font-mono text-[12px] relative z-0">
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const log = logs[virtualRow.index];
                const isExpanded = expandedRow === log.id;

                let rowStyle = "hover:bg-bg-hover";
                if (log.level === "ERROR") {
                  rowStyle = "bg-error/5 border-l-2 border-error hover:bg-error/10";
                } else if (log.level === "WARN") {
                  rowStyle = "bg-warning/5 border-l-2 border-warning hover:bg-warning/10";
                } else if (log.level === "INFO") {
                  rowStyle = "bg-info/3 hover:bg-info/8 text-info/90";
                } else if (log.level === "DEBUG") {
                  rowStyle = "bg-debug/2 hover:bg-debug/5 text-debug/80";
                }

                return (
                  <tr
                    key={virtualRow.key}
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualRow.index}
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    aria-controls={isExpanded ? `row-details-${log.id}` : undefined}
                    className={cn(
                      "group cursor-pointer transition-all border-b border-border/40 outline-none focus-visible:bg-bg-hover focus-visible:ring-1 focus-visible:ring-primary/30",
                      rowStyle,
                      isExpanded && "bg-bg-hover ring-1 ring-primary/20 z-10",
                    )}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    onClick={() => toggleRow(log.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleRow(log.id);
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
                      {getHighlightedElements(log.message)}
                    </td>
                    <td className="w-[110px] px-3 py-2 text-center align-top border-x border-border/5">
                      {log.cluster_id ? (
                        <div className="flex flex-col items-center justify-center gap-0.5 group/cluster">
                          <button
                            type="button"
                            className={cn(
                              "inline-flex items-center justify-center text-primary border h-5 px-1.5 rounded-md text-[9px] font-bold transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary",
                              anomalousClusters?.has(log.cluster_id)
                                ? "bg-orange-500/20 border-orange-500/40 text-orange-400 hover:bg-orange-500/30"
                                : "bg-primary/10 border-primary/20 hover:bg-primary/20",
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
                    <td
                      className="w-[90px] px-3 py-2 text-center relative align-top"
                      data-field="has_comment"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <IconButton
                          icon={
                            <MessageSquarePlus
                              className={cn(
                                "h-3.5 w-3.5",
                                log.has_comment && "text-primary fill-primary/20",
                              )}
                            />
                          }
                          label={log.has_comment ? "View Note" : "Annotate"}
                          onClick={() => toggleRow(log.id)}
                          className={cn(
                            "transition-all h-7 w-7 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10",
                            !log.has_comment && "opacity-0 group-hover:opacity-100",
                            log.has_comment && "opacity-100 text-primary bg-primary/5",
                          )}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {expandedRow !== null && (
          <div
            id={`row-details-${expandedRow}`}
            className="sticky bottom-0 left-0 w-full bg-bg-surface border-t border-border p-6 shadow-2xl z-20 animate-in slide-in-from-bottom duration-300 backdrop-blur-md bg-white/5 max-h-[500px] overflow-y-auto"
            data-field="raw_text"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-3">
                <div className="bg-primary/10 p-1.5 rounded-lg">
                  <ChevronDown className="h-4 w-4 text-primary" />
                </div>
                Detailed Entry Analysis{" "}
                <span className="text-text-muted font-normal text-xs ml-2 opacity-60">
                  ID: {expandedRow}
                </span>
              </h3>
              <div className="flex items-center gap-2">
                {logs.find((l) => l.id === expandedRow)?.has_comment && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-[10px] font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors uppercase tracking-wider"
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
                  className="h-8 text-[10px] font-bold uppercase tracking-wider border-primary/20 hover:bg-primary/5 hover:text-primary transition-all"
                  onClick={() => {
                    if (expandedRow !== null) {
                      onAddComment(expandedRow, commentText);
                      toast.success("Note updated");
                    }
                  }}
                >
                  Save Note
                </Button>
                <IconButton
                  icon={<X className="h-4 w-4" />}
                  label="Close Details"
                  onClick={() => setExpandedRow(null)}
                  className="text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label
                  htmlFor={`raw-data-${expandedRow}`}
                  className="text-[10px] font-bold uppercase tracking-widest text-text-muted opacity-60"
                >
                  Raw Data
                </label>
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-transparent rounded-xl blur opacity-20 group-hover:opacity-30 transition duration-1000" />
                  <pre
                    id={`raw-data-${expandedRow}`}
                    className="relative text-[11px] font-mono leading-relaxed text-text-secondary bg-bg-base/80 p-5 rounded-xl border border-border/50 overflow-x-auto h-[200px] select-text whitespace-pre-wrap scrollbar-thin"
                  >
                    {logs.find((l) => l.id === expandedRow)?.raw_text ||
                      logs.find((l) => l.id === expandedRow)?.message ||
                      "No contextual raw data available."}
                  </pre>
                </div>
              </div>

              <div className="space-y-3">
                <label
                  htmlFor={`note-editor-${expandedRow}`}
                  className="text-[10px] font-bold uppercase tracking-widest text-text-muted opacity-60"
                >
                  Notes & Actions
                </label>
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/10 to-transparent rounded-xl blur opacity-10 group-hover:opacity-20 transition duration-1000" />
                  <textarea
                    id={`note-editor-${expandedRow}`}
                    className="relative w-full h-[200px] text-[12px] font-sans leading-relaxed text-text-primary bg-bg-base/80 p-5 rounded-xl border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none placeholder:text-text-muted/30"
                    placeholder="Add investigation notes, root causes, or pending actions for this log entry..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Floating Action Pill */}
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
