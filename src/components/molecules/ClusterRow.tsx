import { motion } from "framer-motion";
import { RefreshCcw } from "lucide-react";
import { useState } from "react";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { cn } from "@/lib/utils";

interface ClusterRowProps {
  index: number;
  template: string;
  count: number;
  total: number;
  type: "error" | "noise";
  clusterId?: string;
  workspaceId?: string;
}

/**
 * ClusterRow component for displaying log pattern clusters.
 * Follows atomic design (Molecule).
 */
export function ClusterRow({
  index,
  template,
  count,
  total,
  type,
  clusterId,
  workspaceId,
}: Readonly<ClusterRowProps>) {
  const [expanded, setExpanded] = useState(false);
  const [samples, setSamples] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const barColor = type === "error" ? "bg-error" : "bg-debug";
  const glow =
    type === "error"
      ? "shadow-[0_0_8px_rgba(239,68,68,0.3)]"
      : "shadow-[0_0_8px_rgba(167,139,250,0.3)]";

  const toggleExpand = async () => {
    if (!clusterId || !workspaceId) {
      return;
    }

    const nextState = !expanded;
    setExpanded(nextState);

    if (nextState && samples.length === 0) {
      setLoading(true);
      try {
        const queryFilters: any[] = [{ field: "cluster_id", operator: "equals", value: clusterId }];

        if (type === "error") {
          // Add error level filters which will be grouped by OR in the backend
          queryFilters.push(
            { field: "level", operator: "equals", value: "ERROR" },
            { field: "level", operator: "equals", value: "FATAL" },
            { field: "level", operator: "equals", value: "CRITICAL" },
          );
        }

        const res = await callSidecar<{ logs: { raw_text: string }[] }>({
          method: "get_logs",
          params: {
            workspace_id: workspaceId,
            filters: queryFilters,
            limit: 10,
            offset: 0,
          },
          silent: true,
        });
        const texts = res.logs?.map((l) => l.raw_text) || [];
        setSamples(texts);
      } catch (err) {
        console.error("Failed to load cluster details:", err);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="group flex flex-col gap-3 p-3 rounded-lg hover:bg-bg-hover transition-[background-color,border-color] duration-200 border border-transparent hover:border-border/50 bg-bg-surface/30 text-left w-full">
      <button
        type="button"
        onClick={toggleExpand}
        className="flex items-start gap-4 text-left w-full cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
      >
        <span className="text-[10px] font-mono text-text-muted py-1 w-6">#{index + 1}</span>
        <div className="flex-1 overflow-hidden">
          <p
            className={cn(
              "text-[11px] font-mono text-text-primary truncate mb-1.5 leading-relaxed group-hover:text-primary transition-colors",
              type === "error" && "text-error opacity-90",
            )}
          >
            {template}
          </p>
          <div className="flex items-center gap-3">
            <div className="h-1 bg-bg-base/50 rounded-full flex-1 overflow-hidden border border-white/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(count / total) * 100}%` }}
                className={cn("h-full rounded-full", barColor, glow)}
              />
            </div>
            <span className="text-[10px] font-mono text-text-muted shrink-0 w-16 text-right">
              {count.toLocaleString()} hits
            </span>
          </div>
        </div>
      </button>

      {expanded && (
        <span className="mt-2 pl-10 pr-2 space-y-2 border-t border-border/20 pt-3 block w-full">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2 flex items-center gap-2">
            <span>Example Logs (Up to 10)</span>
            {loading && <RefreshCcw className="size-3 animate-spin text-primary" />}
          </span>

          {loading && samples.length === 0 && (
            <span className="text-[10px] font-mono text-text-muted py-4 uppercase tracking-widest animate-pulse block">
              Retrieving sample logs...
            </span>
          )}

          {!loading && samples.length === 0 && (
            <span className="text-[10px] font-mono text-text-muted py-2 block">
              No sample logs found.
            </span>
          )}

          {samples.map((text, sIdx) => {
            const key = `${sIdx}-${text.slice(0, 10)}`;
            return (
              <span
                key={key}
                className="p-2.5 rounded bg-bg-base/60 border border-border/30 text-[10px] font-mono text-text-secondary whitespace-pre-wrap break-all leading-normal selection:bg-primary/20 selection:text-text-primary block"
              >
                {text}
              </span>
            );
          })}
        </span>
      )}
    </div>
  );
}
