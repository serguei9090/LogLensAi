import { Card } from "@/components/ui/card";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useEffect, useState } from "react";

const getMetricColor = (label: string, query: string, explicitColor?: string) => {
  if (explicitColor) {
    if (explicitColor === "error" || explicitColor === "red") {
      return "text-rose-500";
    }
    if (explicitColor === "warn" || explicitColor === "warning" || explicitColor === "amber") {
      return "text-amber-500";
    }
    if (explicitColor === "info" || explicitColor === "green") {
      return "text-emerald-500";
    }
    if (explicitColor === "debug" || explicitColor === "purple") {
      return "text-purple-400";
    }
  }
  const target = `${label} ${query}`.toUpperCase();
  if (target.includes("ERROR") || target.includes("FATAL") || target.includes("CRITICAL")) {
    return "text-rose-500";
  }
  if (target.includes("WARN")) {
    return "text-amber-500";
  }
  if (target.includes("DEBUG") || target.includes("TRACE")) {
    return "text-purple-400";
  }
  return "text-primary";
};

export interface A2UIMetricCardProps {
  readonly label: string;
  readonly query: string;
  readonly sourceIds?: string[];
  readonly color?: string;
}

export function A2UIMetricCard({ label, query, sourceIds, color }: A2UIMetricCardProps) {
  const [total, setTotal] = useState<number | null>(null);
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);

  useEffect(() => {
    let active = true;
    const fetchIt = async () => {
      try {
        const res = await callSidecar<{ total: number }>({
          method: "get_logs",
          params: {
            workspace_id: activeWorkspaceId || "default",
            query,
            source_ids: sourceIds && sourceIds.length > 0 ? sourceIds : undefined,
            limit: 1,
          },
        });
        if (active) {
          setTotal(res.total);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchIt();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      fetchIt();
    }, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [query, activeWorkspaceId, sourceIds]);

  const valueColorClass = getMetricColor(label, query, color);

  return (
    <Card className="bg-bg-surface/50 border-border/60 mb-4 overflow-hidden p-4 flex flex-col items-center justify-center">
      <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest">{label}</h3>
      <div className={cn("text-4xl font-black mt-2 font-mono tracking-tight", valueColorClass)}>
        {total !== null ? total.toLocaleString() : "..."}
      </div>
    </Card>
  );
}
