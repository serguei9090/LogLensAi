import { IconButton } from "@/components/atoms/IconButton";
import { LogLevelBadge } from "@/components/atoms/LogLevelBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAiStore } from "@/store/aiStore";
import { useInvestigationStore } from "@/store/investigationStore";
import type { LogEntry } from "@/types/log";
import { Sparkles, StickyNote } from "lucide-react";
import * as React from "react";
import { getClusterStyles } from "../utils/styleUtils";

interface ClusterCellProps {
  readonly log: LogEntry;
  readonly anomalousClusters?: Set<string>;
  readonly onAnalyzeCluster?: (clusterId: string) => void;
}

export function ClusterCell({
  log,
  anomalousClusters,
  onAnalyzeCluster,
}: ClusterCellProps) {
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
              "inline-flex items-center justify-center border h-5 px-1.5 rounded-md text-xs font-bold transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary p-0 min-w-0",
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
            <span className="text-xs text-text-muted/60 font-medium whitespace-nowrap">
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

export function ActionsCell({
  log,
  logSessionMap,
  onToggleView,
}: ActionsCellProps) {
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

export function CustomFacetCell({ log, custom }: CustomFacetCellProps) {
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
      className="px-3 py-2 align-top whitespace-nowrap overflow-hidden text-ellipsis text-xs"
    >
      {cellValue === null ? (
        <span className="text-text-muted/30">—</span>
      ) : (
        <span className={className}>{cellValue}</span>
      )}
    </td>
  );
}

export interface LogTableCellProps {
  readonly colId: string;
  readonly log: LogEntry;
  readonly content: React.ReactNode;
  readonly anomalousClusters?: Set<string>;
  readonly onAnalyzeCluster?: (clusterId: string) => void;
  readonly onToggleView: (id: number) => void;
  readonly logSessionMap: Record<number, string>;
  readonly customColumns: any[];
}

export function LogTableCell({
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
          className="px-3 py-2 text-text-primary/90 align-top whitespace-pre-wrap font-mono text-xs break-words leading-normal min-w-0"
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
      return (
        <ActionsCell
          log={log}
          logSessionMap={logSessionMap}
          onToggleView={onToggleView}
        />
      );
    default: {
      const custom = customColumns.find((c) => c.id === colId);
      if (custom) {
        return <CustomFacetCell log={log} custom={custom} />;
      }
      return null;
    }
  }
}
