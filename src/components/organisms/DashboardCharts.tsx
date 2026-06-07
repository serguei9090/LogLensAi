// Assume Role: Frontend Engineer (@frontend)

import type * as echarts from "echarts";
import { History, ZoomIn } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ReactECharts } from "../atoms/ReactECharts";

interface DashboardChartsProps {
  stats: any;
  /** ISO interval string returned by backend, e.g. "1 hour", "15 minutes" */
  bucketInterval?: string;
  /** Min/max of actual data returned by backend for All-Time reset */
  timeBounds?: { min: string; max: string };
  /** Currently active time range on the dashboard */
  timeRange: { start: string; end: string };
  /** Called when user drills into a range (click or drag) */
  onZoom: (start: string, end: string) => void;
  /** Called when user resets to All Time */
  onReset: () => void;
}

const LEVEL_COLORS: Record<string, string> = {
  DEBUG: "#8a949f",
  INFO: "var(--primary)",
  WARN: "var(--warning)",
  ERROR: "var(--error)",
};

const DISPLAY_LEVELS = [
  { key: "DEBUG", label: "DEBUG", color: LEVEL_COLORS.DEBUG },
  { key: "INFO", label: "INFO", color: LEVEL_COLORS.INFO },
  { key: "WARN", label: "WARN", color: LEVEL_COLORS.WARN },
  { key: "ERROR", label: "ERROR", color: LEVEL_COLORS.ERROR },
];

function parseDbDate(str: string): Date {
  const normalized = str.replace("T", " ");
  const [datePart, timePart] = normalized.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const timeSegs = (timePart || "00:00:00").split(":");
  const hour = Number(timeSegs[0] || 0);
  const minute = Number(timeSegs[1] || 0);
  const second = Number(timeSegs[2] || 0);
  return new Date(year, month - 1, day, hour, minute, second);
}

function formatToDbString(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;
}

/** Parses a bucket-format label (e.g. "2023-01-15 14:00") and adds one interval step without timezone shifting. */
function addInterval(label: string, interval: string): string {
  const start = parseDbDate(label);
  const _intervalMs: Record<string, number> = {
    "1 second": 1_000,
    "5 seconds": 5_000,
    "15 seconds": 15_000,
    "1 minute": 60_000,
    "5 minutes": 300_000,
    "15 minutes": 900_000,
    "1 hour": 3_600_000,
    "4 hours": 14_400_000,
    "12 hours": 43_200_000,
    "1 day": 86_400_000,
    "30 days": 2_592_000_000,
  };
  const delta = _intervalMs[interval] ?? 3_600_000;
  const end = new Date(start.getTime() + delta - 1);
  return formatToDbString(end);
}

function padToIso(ts: string): string {
  const n = ts.replace(" ", "T");
  if (n.length === 10) {
    return `${n}T00:00:00`;
  }
  if (n.length === 13) {
    return `${n}:00:00`;
  }
  if (n.length === 16) {
    return `${n}:00`;
  }
  return n;
}

export function DashboardCharts({
  stats,
  bucketInterval = "1 hour",
  timeBounds,
  timeRange,
  onZoom,
  onReset,
}: Readonly<DashboardChartsProps>) {
  const [chartInstance, setChartInstance] = useState<echarts.EChartsType | null>(null);

  const isFiltered = useMemo(() => {
    if (!timeBounds?.min || !timeBounds?.max) {
      return !!(timeRange.start || timeRange.end);
    }
    return (
      (timeRange.start && timeRange.start !== timeBounds.min) ||
      (timeRange.end && timeRange.end !== timeBounds.max)
    );
  }, [timeRange, timeBounds]);

  const levelCounts = stats?.level_counts || {};
  const totalLogs = stats?.total_logs || 0;

  const aggregatedCounts = useMemo(
    () => ({
      DEBUG: levelCounts.DEBUG || levelCounts.debug || 0,
      INFO: levelCounts.INFO || levelCounts.info || 0,
      WARN: (levelCounts.WARN || 0) + (levelCounts.WARNING || 0) + (levelCounts.warn || 0),
      ERROR:
        (levelCounts.ERROR || 0) +
        (levelCounts.FATAL || 0) +
        (levelCounts.CRITICAL || 0) +
        (levelCounts.error || 0),
    }),
    [levelCounts],
  );

  /** Normalise time_series rows to standard severity keys. */
  const chartData = useMemo(() => {
    if (!stats?.time_series) {
      return [];
    }
    return stats.time_series.map((item: any) => ({
      timestamp: item.timestamp,
      DEBUG: item.DEBUG || item.debug || 0,
      INFO: item.INFO || item.info || 0,
      WARN: (item.WARN || 0) + (item.WARNING || 0) + (item.warn || 0),
      ERROR: (item.ERROR || 0) + (item.FATAL || 0) + (item.CRITICAL || 0) + (item.error || 0),
    }));
  }, [stats?.time_series]);

  const xAxisData = useMemo(() => chartData.map((d: any) => d.timestamp), [chartData]);
  const debugData = useMemo(() => chartData.map((d: any) => d.DEBUG), [chartData]);
  const infoData = useMemo(() => chartData.map((d: any) => d.INFO), [chartData]);
  const warnData = useMemo(() => chartData.map((d: any) => d.WARN), [chartData]);
  const errorData = useMemo(() => chartData.map((d: any) => d.ERROR), [chartData]);

  // Keep brush active across updates
  useEffect(() => {
    if (chartInstance && chartData.length > 0) {
      chartInstance.dispatchAction({
        type: "takeBrush",
        brushOption: {
          brushType: "lineX",
          brushMode: "single",
        },
      });
    }
  }, [chartInstance, chartData]);

  // ── Drag-to-zoom & Click Handlers ──────────────────────────────────────────

  const handleBrushSelected = useCallback(
    (params: any) => {
      const brushComponent = params.batch?.[0];
      if (brushComponent?.areas && brushComponent.areas.length > 0) {
        const area = brushComponent.areas[0];
        const coordRange = area.coordRange;
        if (coordRange && coordRange[0] !== undefined && coordRange[1] !== undefined) {
          const startVal = Math.round(coordRange[0]);
          const endVal = Math.round(coordRange[1]);

          const startTimestamp = chartData[startVal]?.timestamp;
          const endTimestamp = chartData[endVal]?.timestamp;

          if (startTimestamp && endTimestamp) {
            let start = startTimestamp;
            let end = endTimestamp;
            if (start > end) {
              [start, end] = [end, start];
            }
            onZoom(padToIso(start), padToIso(addInterval(end, bucketInterval)));
          }
        }
      }
    },
    [chartData, bucketInterval, onZoom],
  );

  const handleChartClick = useCallback(
    (params: any) => {
      if (params.componentType === "series") {
        const dataIndex = params.dataIndex;
        const timestamp = chartData[dataIndex]?.timestamp;
        if (timestamp) {
          onZoom(padToIso(timestamp), addInterval(timestamp, bucketInterval));
        }
      }
    },
    [chartData, bucketInterval, onZoom],
  );

  const onEvents = useMemo(() => {
    return {
      brushSelected: handleBrushSelected,
      click: handleChartClick,
    };
  }, [handleBrushSelected, handleChartClick]);

  // ── ECharts Options Configuration ──────────────────────────────────────────

  const option = useMemo(() => {
    return {
      backgroundColor: "transparent",
      color: [LEVEL_COLORS.DEBUG, LEVEL_COLORS.INFO, LEVEL_COLORS.WARN, LEVEL_COLORS.ERROR],
      tooltip: {
        trigger: "axis" as const,
        axisPointer: {
          type: "shadow" as const,
          shadowStyle: {
            color: "rgba(34, 197, 94, 0.06)",
          },
        },
        backgroundColor: "var(--bg-surface-bright)",
        borderColor: "var(--border)",
        borderWidth: 1,
        borderRadius: 8,
        textStyle: {
          color: "var(--text-primary)",
          fontSize: 10,
          fontFamily: "JetBrains Mono",
        },
        formatter: (params: any) => {
          if (!params || params.length === 0) {
            return "";
          }
          const timestamp = params[0].name;
          const parts = timestamp.split(" ");
          const datePart = parts[0] || "";
          const timePart = parts[1] || "";

          let html = `<div style="font-weight: bold; margin-bottom: 4px; font-family: 'JetBrains Mono', monospace;">`;
          if (datePart) {
            html += `<span style="color: var(--primary); margin-right: 4px;">${datePart}</span>`;
          }
          if (timePart) {
            html += `<span>${timePart}</span>`;
          }
          html += `</div>`;

          let total = 0;
          for (const param of params) {
            const val = param.value || 0;
            total += val;
            html += `<div style="display: flex; justify-content: space-between; gap: 16px; font-family: 'JetBrains Mono', monospace; color: ${param.color};">
              <span>${param.seriesName}</span>
              <span style="font-weight: 600;">${val.toLocaleString()}</span>
            </div>`;
          }
          if (params.length > 1) {
            html += `<div style="display: flex; justify-content: space-between; gap: 16px; margin-top: 4px; border-top: 1px solid var(--border-muted); padding-top: 4px; font-family: 'JetBrains Mono', monospace; color: var(--text-secondary);">
              <span>TOTAL</span>
              <span style="font-weight: 600;">${total.toLocaleString()}</span>
            </div>`;
          }
          return html;
        },
      },
      grid: {
        top: 15,
        right: 10,
        bottom: 25,
        left: 45,
        containLabel: false,
      },
      xAxis: {
        type: "category" as const,
        data: xAxisData,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "var(--text-muted)",
          fontSize: 9,
          fontFamily: "JetBrains Mono",
          formatter: (value: string, index: number) => {
            const parts = value.split(" ");
            const datePart = parts[0] || "";
            let timePart = parts[1] || "";

            if (timePart.includes(":") && timePart.split(":").length === 3) {
              const intervalParts = bucketInterval.split(" ");
              const unit = intervalParts[1]?.toLowerCase();
              if (!unit?.startsWith("second")) {
                const [hh, mm] = timePart.split(":");
                timePart = `${hh}:${mm}`;
              }
            }

            const primaryLabel = timePart || datePart;

            let showDate = false;
            if (index === 0) {
              showDate = true;
            } else {
              const prevItem = chartData[index - 1];
              if (prevItem) {
                const prevDate = prevItem.timestamp.split(" ")[0];
                if (prevDate !== datePart) {
                  showDate = true;
                }
              }
            }

            if (showDate && timePart) {
              return `${primaryLabel}\n{date|${datePart}}`;
            }
            return primaryLabel;
          },
          rich: {
            date: {
              color: "var(--color-primary)",
              fontWeight: "bold" as const,
              fontSize: 8,
              lineHeight: 12,
            },
          },
        },
      },
      yAxis: {
        type: "value" as const,
        splitLine: {
          lineStyle: {
            color: "var(--border-muted)",
            type: "dashed" as const,
          },
        },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "var(--text-muted)",
          fontSize: 9,
          fontFamily: "JetBrains Mono",
        },
      },
      brush: {
        brushType: "lineX" as const,
        brushMode: "single" as const,
        toolbox: [],
        xAxisIndex: 0,
        outOfBrush: {
          colorAlpha: 0.3,
        },
        brushStyle: {
          borderWidth: 1,
          color: "rgba(34, 197, 94, 0.15)",
          borderColor: "var(--primary)",
        },
      },
      series: [
        {
          name: "DEBUG",
          type: "bar" as const,
          stack: "total",
          data: debugData,
          barMaxWidth: 28,
        },
        {
          name: "INFO",
          type: "bar" as const,
          stack: "total",
          data: infoData,
          barMaxWidth: 28,
        },
        {
          name: "WARN",
          type: "bar" as const,
          stack: "total",
          data: warnData,
          barMaxWidth: 28,
        },
        {
          name: "ERROR",
          type: "bar" as const,
          stack: "total",
          data: errorData,
          barMaxWidth: 28,
          itemStyle: {
            borderRadius: [4, 4, 0, 0] as [number, number, number, number],
          },
        },
      ],
    };
  }, [xAxisData, debugData, infoData, warnData, errorData, bucketInterval, chartData]);

  return (
    <div className="w-full">
      <section className="w-full bg-bg-surface/50 border border-border rounded-xl p-6 backdrop-blur-sm relative overflow-hidden h-[340px] flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted">
              Severity Over Time
            </h2>

            <span className="text-[9px] font-mono text-text-muted/50 ml-1 border border-border/30 rounded px-1 py-px">
              {bucketInterval}/bar
            </span>

            {isFiltered && (
              <button
                type="button"
                onClick={onReset}
                className="ml-2 flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-primary hover:text-text-inverse bg-primary/10 hover:bg-primary border border-primary/20 rounded transition-all cursor-pointer"
              >
                <ZoomIn className="size-2.5" />
                Reset Zoom
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-mono">
            {DISPLAY_LEVELS.map((lvl) => {
              const count = aggregatedCounts[lvl.key as keyof typeof aggregatedCounts] || 0;
              const pct = totalLogs > 0 ? ((count / totalLogs) * 100).toFixed(1) : "0.0";
              return (
                <div
                  key={lvl.key}
                  className="flex items-center gap-1.5 text-text-muted hover:text-text-primary transition-colors cursor-default"
                >
                  <span
                    className="size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: lvl.color }}
                  />
                  <span className="font-semibold text-text-primary">{lvl.label}</span>
                  <span className="text-text-primary/95">{count.toLocaleString()}</span>
                  <span className="text-[10px] opacity-60">({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-[9px] font-mono text-text-muted/40 mb-2 -mt-3">
          Click a bar to drill down · Drag to select a range
        </p>

        <div className="flex-1 w-full min-h-0 select-none">
          {!stats ? (
            <div className="h-full w-full flex flex-col justify-end gap-2 animate-pulse px-4">
              <div className="flex-1 flex items-end gap-1 px-2 pb-1 border-b border-white/5">
                {Array.from({ length: 32 }).map((_, idx) => {
                  const h = [25, 45, 15, 60, 30, 80, 45, 10, 55, 35, 70, 25, 50, 90, 15, 40][
                    idx % 16
                  ];
                  return (
                    <div
                      key={idx}
                      className="flex-1 bg-white/5 rounded-t-sm"
                      style={{ height: `${h}%` }}
                    />
                  );
                })}
              </div>
              <div className="h-4 bg-white/5 rounded w-1/3 mx-auto" />
            </div>
          ) : chartData.length > 0 ? (
            <ReactECharts
              option={option}
              onEvents={onEvents}
              onChartInit={setChartInstance}
              style={{ cursor: "pointer" }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-[10px] font-mono text-text-muted uppercase tracking-widest">
              No Time Data Available
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
