import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import * as React from "react";

interface TableHeaderProps {
  readonly gridTemplateColumns: string;
  readonly activeVisibleColumns: string[];
  readonly selectedLogIds: number[];
  readonly totalLogsCount: number;
  readonly onToggleSelectAll: () => void;
  readonly getColumnLabel: (colId: string) => string;
  readonly onSort: (sortBy: string) => void;
  readonly sortBy: string;
  readonly sortOrder: "asc" | "desc";
  readonly onResizeStart: (e: React.MouseEvent, colId: string) => void;
}

export function TableHeader({
  gridTemplateColumns,
  activeVisibleColumns,
  selectedLogIds,
  totalLogsCount,
  onToggleSelectAll,
  getColumnLabel,
  onSort,
  sortBy,
  sortOrder,
  onResizeStart,
}: TableHeaderProps) {
  const isAllSelected = totalLogsCount > 0 && selectedLogIds.length === totalLogsCount;

  const renderSortIcon = (field: string) => {
    if (sortBy !== field) {
      return (
        <ArrowUpDown className="h-3 w-3 opacity-30 group-hover/header:opacity-100 transition-opacity ml-1" />
      );
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="h-3 w-3 text-primary ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 text-primary ml-1" />
    );
  };

  return (
    <thead className="sticky top-0 bg-bg-surface border-b border-border z-10 text-text-muted text-xs font-bold uppercase tracking-widest h-10 select-none block">
      <tr className="grid w-full items-center" style={{ gridTemplateColumns }}>
        <th
          className="p-0 transition-colors group/select-all"
          title={isAllSelected ? "Deselect All" : "Select All"}
        >
          <Button
            variant="ghost"
            className="w-full h-10 flex items-center justify-center hover:bg-white/5 outline-none focus-visible:bg-white/10 rounded-none border-none p-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelectAll();
            }}
            aria-label={isAllSelected ? "Deselect All" : "Select All"}
          >
            <div
              className={cn(
                "w-1 h-4 rounded-full transition-all",
                isAllSelected
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
                  className="w-full h-10 px-3 flex items-center justify-start gap-1.5 hover:text-text-primary transition-colors focus-visible:bg-primary/5 outline-none rounded-none border-none font-bold uppercase tracking-widest text-xs min-w-0"
                  onClick={() => onSort(colId)}
                >
                  <span className="truncate">{label}</span>
                  {renderSortIcon(colId)}
                </Button>
              ) : (
                <div className="w-full h-10 px-3 flex items-center justify-start gap-1.5 font-bold uppercase tracking-widest text-xs text-text-muted min-w-0">
                  <span className="truncate">{label}</span>
                </div>
              )}

              {/* Drag handle for resizing (excluding actions and message) */}
              {colId !== "actions" && colId !== "message" && (
                <button
                  type="button"
                  aria-label={`Resize ${label} column`}
                  className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/50 active:bg-primary transition-colors z-20 group-hover/header:bg-white/10 border-none bg-transparent p-0 outline-none"
                  onMouseDown={(e) => onResizeStart(e, colId)}
                />
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
