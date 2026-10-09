import type * as echarts from "echarts";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { ReactECharts } from "./ReactECharts";

interface A2UIComponent {
  type: string;
  text?: string;
  label?: string;
  children?: A2UIComponent[];
  props?: Record<string, unknown>;
  action?: {
    type: string;
    [key: string]: unknown;
  };
}

interface A2UIRendererProps {
  payload: unknown;
  onAction?: (action: unknown) => void;
}

const getMetricColor = (label: string, query: string, explicitColor?: string) => {
  if (explicitColor) {
    if (explicitColor === "error" || explicitColor === "red") return "text-rose-500";
    if (explicitColor === "warn" || explicitColor === "warning" || explicitColor === "amber") return "text-amber-500";
    if (explicitColor === "info" || explicitColor === "green") return "text-emerald-500";
    if (explicitColor === "debug" || explicitColor === "purple") return "text-purple-400";
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

const LiveMetric = ({
  label,
  query,
  sourceIds,
  color,
}: {
  label: string;
  query: string;
  sourceIds?: string[];
  color?: string;
}) => {
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
};

const LiveDataTable = ({ title, query, sourceIds }: { title: string; query: string; sourceIds?: string[] }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);

  useEffect(() => {
    let active = true;
    const fetchIt = async () => {
      try {
        const res = await callSidecar<{ logs: any[] }>({
          method: "get_logs",
          params: {
            workspace_id: activeWorkspaceId || "default",
            query,
            source_ids: sourceIds && sourceIds.length > 0 ? sourceIds : undefined,
            limit: 5,
          },
        });
        if (active) {
          setLogs(res.logs);
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

  return (
    <Card className="bg-bg-surface/50 border-border/60 mb-4 overflow-hidden">
      <CardHeader className="py-3 px-4 border-b border-border/60">
        <CardTitle className="text-xs font-bold text-text-primary uppercase tracking-widest">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-border/40 hover:bg-bg-surface-bright/30"
                >
                  <td className="p-2 whitespace-nowrap text-text-muted font-mono">
                    {log.timestamp.split(" ")[1]}
                  </td>
                  <td
                    className="p-2 font-bold"
                    style={{ color: `var(--${log.level.toLowerCase()})` }}
                  >
                    {log.level}
                  </td>
                  <td className="p-2 truncate max-w-[200px] text-text-secondary">{log.raw_text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

const LiveChartArea = ({ title, query, sourceIds }: { title: string; query: string; sourceIds?: string[] }) => {
  const [distribution, setDistribution] = useState<any[]>([]);
  const [bucketInterval, setBucketInterval] = useState<string>("auto");
  const [loading, setLoading] = useState(true);
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);

  useEffect(() => {
    let active = true;
    const fetchTimeline = async () => {
      try {
        const res = await callSidecar<{ buckets: any[]; bucket_interval?: string }>({
          method: "get_log_distribution",
          params: {
            workspace_id: activeWorkspaceId || "default",
            query: query || undefined,
            source_ids: sourceIds && sourceIds.length > 0 ? sourceIds : undefined,
          },
        });
        if (active) {
          setDistribution(res.buckets || []);
          if (res.bucket_interval) {
            setBucketInterval(res.bucket_interval);
          }
          setLoading(false);
        }
      } catch (e) {
        console.error("LiveChartArea fetch failed:", e);
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchTimeline();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      fetchTimeline();
    }, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [query, activeWorkspaceId, sourceIds]);

  const cleanTitle = useMemo(() => {
    // Strip hallucinated static bucket mentions from model titles like "(15-MIN BUCKETS)" or "(1-hour buckets)"
    return title.replace(/\s*\(\s*\d+[\s-]*(?:min|minute|sec|second|hr|hour|day)s?\s*buckets?\s*\)/gi, "").trim();
  }, [title]);

  const chartOption: echarts.EChartsOption = useMemo(() => {
    const xLabels = distribution.map((b) => b.bucket);
    const errorData = distribution.map((b) => b.ERROR || 0);
    const warnData = distribution.map((b) => b.WARN || 0);
    const infoData = distribution.map((b) => b.INFO || 0);
    const debugData = distribution.map((b) => b.DEBUG || 0);

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: "rgba(255,255,255,0.03)" } },
        backgroundColor: "#111412",
        borderColor: "#262f29",
        borderWidth: 1,
        borderRadius: 8,
        textStyle: { color: "#f4f4f5", fontSize: 11, fontFamily: "monospace" },
        formatter: (params: any) => {
          if (!params || !Array.isArray(params) || params.length === 0) return "";
          const bucketName = params[0].name || "";
          let totalCount = 0;
          let rowsHtml = "";

          for (const p of params) {
            const val = Number(p.value || 0);
            totalCount += val;
            let levelColor = p.color;
            if (p.seriesName === "ERROR") levelColor = "#ef4444";
            else if (p.seriesName === "WARN") levelColor = "#f59e0b";
            else if (p.seriesName === "INFO") levelColor = "#22c55e";
            else if (p.seriesName === "DEBUG") levelColor = "#a78bfa";

            rowsHtml += `
              <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:2px 0;">
                <span style="display:inline-flex;align-items:center;gap:6px;">
                  <span style="width:8px;height:8px;border-radius:2px;background-color:${levelColor};display:inline-block;"></span>
                  <span style="color:${val > 0 ? '#f4f4f5' : '#71717a'};font-weight:${val > 0 ? '600' : '400'};">${p.seriesName}</span>
                </span>
                <span style="font-weight:700;color:${val > 0 ? levelColor : '#52525b'};font-family:monospace;">${val.toLocaleString()}</span>
              </div>
            `;
          }

          return `
            <div style="padding:2px 4px;min-width:140px;font-family:monospace;">
              <div style="font-size:10px;color:#a1a1aa;margin-bottom:6px;border-bottom:1px solid #27272a;padding-bottom:4px;display:flex;justify-content:space-between;">
                <span>${bucketName}</span>
                <span style="color:#22c55e;font-weight:700;">Total: ${totalCount}</span>
              </div>
              ${rowsHtml}
            </div>
          `;
        },
      },
      legend: {
        data: ["ERROR", "WARN", "INFO", "DEBUG"],
        top: 4,
        right: 8,
        textStyle: { color: "#a1a1aa", fontSize: 10 },
      },
      grid: {
        top: 32,
        left: 40,
        right: 16,
        bottom: 24,
      },
      xAxis: {
        type: "category",
        data: xLabels,
        axisLine: { lineStyle: { color: "#27272a" } },
        axisLabel: {
          color: "#71717a",
          fontSize: 9,
          fontFamily: "monospace",
          formatter: (val: string) => {
            const parts = val.split(" ");
            return parts[1] || val;
          },
        },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "rgba(39, 39, 42, 0.4)" } },
        axisLabel: { color: "#71717a", fontSize: 9, fontFamily: "monospace" },
      },
      series: [
        {
          name: "ERROR",
          type: "bar",
          stack: "total",
          color: "#ef4444",
          data: errorData,
        },
        {
          name: "WARN",
          type: "bar",
          stack: "total",
          color: "#f59e0b",
          data: warnData,
        },
        {
          name: "INFO",
          type: "bar",
          stack: "total",
          color: "#22c55e",
          data: infoData,
        },
        {
          name: "DEBUG",
          type: "bar",
          stack: "total",
          color: "#a78bfa",
          data: debugData,
        },
      ],
    };
  }, [distribution]);

  return (
    <Card className="bg-bg-surface/50 border-border/60 mb-4 overflow-hidden">
      <CardHeader className="py-2.5 px-4 border-b border-border/60 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-xs font-bold text-text-primary uppercase tracking-widest">
            {cleanTitle}
          </CardTitle>
          {bucketInterval && bucketInterval !== "auto" && (
            <span className="text-[10px] font-mono text-text-muted bg-white/5 px-1.5 py-0.2 rounded border border-white/10">
              {bucketInterval} buckets
            </span>
          )}
        </div>
        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
          Distribution Histogram
        </span>
      </CardHeader>
      <CardContent className="p-2">
        {loading && distribution.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-xs text-text-muted font-mono animate-pulse">
            Loading histogram distribution...
          </div>
        ) : distribution.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-xs text-text-muted font-mono">
            No events found for query: {query || "*"}
          </div>
        ) : (
          <div className="h-44 w-full">
            <ReactECharts option={chartOption} className="w-full h-full" />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

function parseSingleTag(statement: string): A2UIComponent | null {
  const trimmed = statement.trim();
  if (!trimmed) {
    return null;
  }

  // Handle Button Tag: button label="Text" action={...}
  if (trimmed.startsWith("button")) {
    const labelMatch = /label=["']([^"']+)["']/.exec(trimmed);
    const actionMatch = /action=\{([^}]+)\}/.exec(trimmed);

    if (labelMatch) {
      let action: { type: string; [key: string]: unknown } | undefined;
      if (actionMatch) {
        try {
          // Wrapped in {} to make it valid JSON
          action = JSON.parse(`{${actionMatch[1]}}`);
        } catch (e) {
          console.warn("Failed to parse action JSON in A2UI markup:", e);
        }
      }

      return {
        type: "button",
        label: labelMatch[1],
        action,
      };
    }
  }

  // Handle Text Tag: text value="..."
  if (trimmed.startsWith("text")) {
    const textMatch = /value=["']([^"']+)["']/.exec(trimmed);
    if (textMatch) {
      return {
        type: "text",
        text: textMatch[1],
      };
    }
  }

  // Handle Metric Tag: metric label="..." query="..." source_id="..." color="..."
  if (trimmed.startsWith("metric")) {
    const labelMatch = /label=["']([^"']+)["']/.exec(trimmed);
    const queryMatch = /query=["']([^"']+)["']/.exec(trimmed);
    const sourceMatch = /source_ids?=["']([^"']+)["']/.exec(trimmed);
    const colorMatch = /color=["']([^"']+)["']/.exec(trimmed);
    if (labelMatch && queryMatch) {
      const sourceIds = sourceMatch
        ? sourceMatch[1]
            .split(",")
            .map((s) => s.replace(/['"]/g, "").trim())
            .filter(Boolean)
        : undefined;
      return {
        type: "metric",
        label: labelMatch[1],
        props: {
          query: queryMatch[1],
          source_ids: sourceIds,
          color: colorMatch ? colorMatch[1] : undefined,
        },
      };
    }
  }

  // Handle Chart Area Tag: chart_area title="..." query="..." source_id="..."
  if (trimmed.startsWith("chart_area")) {
    const titleMatch = /title=["']([^"']+)["']/.exec(trimmed);
    const queryMatch = /query=["']([^"']+)["']/.exec(trimmed);
    const sourceMatch = /source_ids?=["']([^"']+)["']/.exec(trimmed);
    if (titleMatch && queryMatch) {
      const sourceIds = sourceMatch
        ? sourceMatch[1]
            .split(",")
            .map((s) => s.replace(/['"]/g, "").trim())
            .filter(Boolean)
        : undefined;
      return {
        type: "chart_area",
        label: titleMatch[1],
        props: { query: queryMatch[1], source_ids: sourceIds },
      };
    }
  }

  // Handle Data Table Tag: data_table title="..." query="..." source_id="..."
  if (trimmed.startsWith("data_table")) {
    const titleMatch = /title=["']([^"']+)["']/.exec(trimmed);
    const queryMatch = /query=["']([^"']+)["']/.exec(trimmed);
    const sourceMatch = /source_ids?=["']([^"']+)["']/.exec(trimmed);
    if (titleMatch && queryMatch) {
      const sourceIds = sourceMatch
        ? sourceMatch[1]
            .split(",")
            .map((s) => s.replace(/['"]/g, "").trim())
            .filter(Boolean)
        : undefined;
      return {
        type: "data_table",
        label: titleMatch[1],
        props: { query: queryMatch[1], source_ids: sourceIds },
      };
    }
  }

  return null;
}

/**
 * Parses A2UI Markup format (e.g. button label="Text" action={...})
 * Supports multiple tag occurrences or newline-separated tags and returns
 * a JSON object compatible with the standard renderer.
 */
function parseA2UIMarkup(raw: string): A2UIComponent | null {
  const clean = raw.replaceAll("[[A2UI]]", "").replaceAll("[[/A2UI]]", "").trim();

  if (!clean) {
    return null;
  }

  // Match all potential markup tag chunks
  const tagRegex = /(?:metric|button|text|chart_area|data_table)\s+[^[\]\n\r]+/g;
  const matches = clean.match(tagRegex);

  if (matches && matches.length > 0) {
    const components: A2UIComponent[] = [];
    for (const chunk of matches) {
      const parsed = parseSingleTag(chunk);
      if (parsed) {
        components.push(parsed);
      }
    }

    if (components.length === 1) {
      return components[0];
    }
    if (components.length > 1) {
      return {
        type: "surface",
        children: components,
      };
    }
  }

  // Fallback to parsing entire cleaned string as single tag
  return parseSingleTag(clean);
}

/**
 * A2UIRenderer maps A2UI v0.9 specific primitives to project-standard shadcn/ui components.
 * Supports both standard JSON payloads and the compact Markup format.
 */
export const A2UIRenderer: React.FC<A2UIRendererProps> = ({ payload, onAction }) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  // Handle the "markup" wrapper sent by the sidecar
  let resolvedPayload: A2UIComponent | null = null;
  const rawPayload = payload as Record<string, unknown>;

  if (rawPayload.type === "markup" && typeof rawPayload.raw === "string") {
    const parsed = parseA2UIMarkup(rawPayload.raw);
    if (!parsed) {
      return (
        <div className="text-xs text-text-muted italic opacity-80 p-3 border border-border/40 rounded-lg bg-bg-surface-bright/50">
          [Malformed A2UI Blueprint]
        </div>
      );
    }
    resolvedPayload = parsed;
  } else {
    resolvedPayload = payload as A2UIComponent;
  }

  const renderComponent = (comp: A2UIComponent, index: number): React.ReactNode => {
    switch (comp.type) {
      case "text":
        return (
          <p key={index} className="text-text-secondary text-sm leading-relaxed mb-2">
            {comp.text}
          </p>
        );

      case "button":
        return (
          <Button
            key={index}
            variant="outline"
            size="sm"
            aria-label={comp.label ? `Action: ${comp.label}` : "Interactive Action"}
            className="h-8 border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2 mr-2"
            onClick={() => onAction?.(comp.action)}
          >
            {comp.label}
          </Button>
        );

      case "metric":
        return (
          <LiveMetric
            key={index}
            label={comp.label || "Metric"}
            query={(comp.props?.query as string) || ""}
            sourceIds={comp.props?.source_ids as string[] | undefined}
            color={comp.props?.color as string | undefined}
          />
        );

      case "chart_area":
        return (
          <LiveChartArea
            key={index}
            title={comp.label || "Traffic History"}
            query={(comp.props?.query as string) || ""}
            sourceIds={comp.props?.source_ids as string[] | undefined}
          />
        );

      case "data_table":
        return (
          <LiveDataTable
            key={index}
            title={comp.label || "Data Table"}
            query={(comp.props?.query as string) || ""}
            sourceIds={comp.props?.source_ids as string[] | undefined}
          />
        );

      case "card":
        return (
          <Card key={index} className="bg-bg-surface/50 border-border/60 mb-4 overflow-hidden">
            {comp.label && (
              <CardHeader className="py-3 px-4 border-b border-border/60">
                <CardTitle className="text-xs font-bold text-text-primary uppercase tracking-widest">
                  {comp.label}
                </CardTitle>
              </CardHeader>
            )}
            <CardContent className="p-4">
              {comp.children?.map((child, i) => renderComponent(child, i))}
            </CardContent>
          </Card>
        );

      case "stack_v":
        return (
          <div key={index} className="flex flex-col gap-2 mb-4">
            {comp.children?.map((child, i) => renderComponent(child, i))}
          </div>
        );

      case "stack_h":
        return (
          <div key={index} className="flex flex-row flex-wrap gap-2 mb-4">
            {comp.children?.map((child, i) => renderComponent(child, i))}
          </div>
        );

      case "surface":
      case "root":
        return (
          <div
            key={index}
            className="a2ui-surface w-full animate-in fade-in slide-in-from-bottom-2"
          >
            {comp.children?.map((child, i) => renderComponent(child, i))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="a2ui-renderer w-full mt-2">
      {resolvedPayload && renderComponent(resolvedPayload, 0)}
    </div>
  );
};
