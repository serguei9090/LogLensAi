import { ReactECharts } from "@/components/atoms/ReactECharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type * as echarts from "echarts";
import { useEffect, useMemo, useState } from "react";

export interface A2UIChartAreaProps {
  readonly title: string;
  readonly query: string;
  readonly sourceIds?: string[];
}

export function A2UIChartArea({ title, query, sourceIds }: A2UIChartAreaProps) {
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
    return title
      .replace(/\s*\(\s*\d+[\s-]*(?:min|minute|sec|second|hr|hour|day)s?\s*buckets?\s*\)/gi, "")
      .trim();
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
          if (!params || !Array.isArray(params) || params.length === 0) {
            return "";
          }
          const bucketName = params[0].name || "";
          let totalCount = 0;
          let rowsHtml = "";

          for (const p of params) {
            const val = Number(p.value || 0);
            totalCount += val;
            let levelColor = p.color;
            if (p.seriesName === "ERROR") {
              levelColor = "#ef4444";
            } else if (p.seriesName === "WARN") {
              levelColor = "#f59e0b";
            } else if (p.seriesName === "INFO") {
              levelColor = "#22c55e";
            } else if (p.seriesName === "DEBUG") {
              levelColor = "#a78bfa";
            }

            rowsHtml += `
              <div style="display:flex; justify-content:space-between; align-items:center; gap:16px; margin-top:2px;">
                <span style="display:flex; align-items:center; gap:6px;">
                  <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background-color:${levelColor};"></span>
                  <span style="color:#a1a1aa;">${p.seriesName}</span>
                </span>
                <span style="font-weight:700; color:#f4f4f5;">${val.toLocaleString()}</span>
              </div>
            `;
          }

          return `
            <div style="min-width: 140px; padding: 2px;">
              <div style="font-weight:700; border-bottom:1px solid #27272a; padding-bottom:4px; margin-bottom:6px; color:#e4e4e7;">
                ${bucketName}
              </div>
              <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-weight:700;">
                <span style="color:#a1a1aa;">Total Logs:</span>
                <span style="color:#22c55e;">${totalCount.toLocaleString()}</span>
              </div>
              ${rowsHtml}
            </div>
          `;
        },
      },
      grid: { left: 40, right: 16, top: 28, bottom: 24, containLabel: false },
      xAxis: {
        type: "category",
        data: xLabels,
        axisLine: { lineStyle: { color: "#27272a" } },
        axisLabel: {
          color: "#71717a",
          fontSize: 10,
          fontFamily: "monospace",
          formatter: (val: string) => {
            const parts = val.split(" ");
            return parts.length > 1 ? parts[1].substring(0, 5) : val.substring(0, 5);
          },
        },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "#27272a", type: "dashed" } },
        axisLabel: { color: "#71717a", fontSize: 10, fontFamily: "monospace" },
      },
      series: [
        {
          name: "ERROR",
          type: "bar",
          stack: "total",
          data: errorData,
          itemStyle: { color: "#ef4444" },
          barMaxWidth: 16,
        },
        {
          name: "WARN",
          type: "bar",
          stack: "total",
          data: warnData,
          itemStyle: { color: "#f59e0b" },
          barMaxWidth: 16,
        },
        {
          name: "INFO",
          type: "bar",
          stack: "total",
          data: infoData,
          itemStyle: { color: "#22c55e" },
          barMaxWidth: 16,
        },
        {
          name: "DEBUG",
          type: "bar",
          stack: "total",
          data: debugData,
          itemStyle: { color: "#a78bfa" },
          barMaxWidth: 16,
        },
      ],
    };
  }, [distribution]);

  return (
    <Card className="bg-bg-surface/50 border-border/60 mb-4 overflow-hidden">
      <CardHeader className="py-2.5 px-4 border-b border-border/60 flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-bold text-text-primary uppercase tracking-widest flex items-center gap-2">
          <span>{cleanTitle}</span>
          {bucketInterval && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-bg-surface-bright/50 border border-border/40 text-text-muted">
              Resolution: {bucketInterval}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        {loading ? (
          <div className="h-44 flex items-center justify-center text-xs text-text-muted font-mono">
            Loading histogram...
          </div>
        ) : distribution.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-xs text-text-muted font-mono">
            No events found for this filter
          </div>
        ) : (
          <ReactECharts option={chartOption} style={{ height: "176px", width: "100%" }} />
        )}
      </CardContent>
    </Card>
  );
}
