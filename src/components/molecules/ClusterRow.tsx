// Assume Role: Frontend Engineer (@frontend)

import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/uiStore";
import { RefreshCcw, Sparkles } from "lucide-react";
import { useState } from "react";

interface ClusterRowProps {
  index: number;
  template: string;
  count: number;
  total: number;
  type: "error" | "noise";
  clusterId?: string;
  workspaceId?: string;
  category?: string;
  severity?: number;
  isOutage?: boolean;
  confidence?: number;
  ragTag?: string;
  isKnownIssue?: boolean;
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
  category,
  severity,
  isOutage,
  ragTag,
  isKnownIssue,
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
      <div className="flex items-start gap-4 text-left w-full">
        <button
          type="button"
          onClick={toggleExpand}
          className="text-xs font-mono text-text-muted py-1 w-6 cursor-pointer hover:text-text-primary text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
        >
          #{index + 1}
        </button>
        <div className="flex-1 overflow-hidden">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <button
              type="button"
              onClick={toggleExpand}
              className="text-left flex-1 min-w-[200px] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
            >
              <p
                className={cn(
                  "text-xs font-mono text-text-primary truncate leading-relaxed group-hover:text-primary transition-colors",
                  type === "error" && "text-error opacity-90",
                )}
              >
                {template}
              </p>
            </button>
            {category && (
              <span className="text-xs uppercase font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-text-muted">
                {category}
              </span>
            )}
            {severity !== undefined && (
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Sev {severity.toFixed(1)}
              </span>
            )}
            {isOutage && (
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 animate-pulse">
                OUTAGE
              </span>
            )}
            {ragTag && (
              <span
                className={cn(
                  "text-xs font-mono px-1.5 py-0.5 rounded border",
                  isKnownIssue
                    ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                    : "bg-rose-500/10 text-rose-300 border-rose-500/30",
                )}
              >
                {ragTag}
              </span>
            )}
            {clusterId && workspaceId && (
              <button
                type="button"
                onClick={() => useUIStore.getState().openDiagnostic(clusterId, workspaceId)}
                className="text-xs flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors ml-auto cursor-pointer"
                title="Diagnose cluster with AI & RAG Memory"
              >
                <Sparkles className="size-3" />
                Diagnose
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={toggleExpand}
            className="flex items-center gap-3 w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
          >
            <div className="h-1 bg-bg-base/50 rounded-full flex-1 overflow-hidden border border-white/5">
              <div
                style={{ width: `${(count / total) * 100}%` }}
                className={cn(
                  "h-full rounded-full transition-[width] duration-1000 ease-out",
                  barColor,
                  glow,
                )}
              />
            </div>
            <span className="text-xs font-mono text-text-muted shrink-0 w-16 text-right">
              {count.toLocaleString()} hits
            </span>
          </button>
        </div>
      </div>

      {expanded && (
        <span className="mt-2 pl-10 pr-2 space-y-2 border-t border-border/20 pt-3 block w-full">
          <span className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2 flex items-center gap-2">
            <span>Example Logs (Up to 10)</span>
            {loading && <RefreshCcw className="size-3 animate-spin text-primary" />}
          </span>

          {loading && samples.length === 0 && (
            <span className="text-xs font-mono text-text-muted py-4 uppercase tracking-widest animate-pulse block">
              Retrieving sample logs...
            </span>
          )}

          {!loading && samples.length === 0 && (
            <span className="text-xs font-mono text-text-muted py-2 block">
              No sample logs found.
            </span>
          )}

          {samples.map((text, sIdx) => {
            const key = `${sIdx}-${text.slice(0, 10)}`;
            return (
              <span
                key={key}
                className="p-2.5 rounded bg-bg-base/60 border border-border/30 text-xs font-mono text-text-secondary whitespace-pre-wrap break-all leading-normal selection:bg-primary/20 selection:text-text-primary block"
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
