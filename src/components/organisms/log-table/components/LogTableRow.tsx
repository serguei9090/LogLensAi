import { cn } from "@/lib/utils";
import type { LogEntry } from "@/types/log";
import type { VirtualItem } from "@tanstack/react-virtual";
import * as React from "react";
import { memo } from "react";
import { getRowLevelStyles } from "../utils/styleUtils";
import { LogTableCell } from "./LogTableCells";

export interface LogTableRowProps {
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

export const LogTableRow = memo(function LogTableRow({
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
