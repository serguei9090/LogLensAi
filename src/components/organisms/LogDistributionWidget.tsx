// Assume Role: Frontend Engineer (@frontend)
import { X, ZoomIn } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FilterEntry } from "@/components/molecules/FilterBuilder";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { useInvestigationStore } from "@/store/investigationStore";
import { ReactECharts } from "../atoms/ReactECharts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

interface Bucket {
  bucket: string;
  INFO?: number;
  ERROR?: number;
  WARN?: number;
  [key: string]: string | number | undefined;
}

interface Anomaly {
  cluster_id: string;
  timestamp: string;
  z_score: number;
  current_rate: number;
}

interface LogDistributionWidgetProps {
  readonly workspaceId: string;
  readonly sourceIds?: string[] | null;
  readonly fusionId?: string;
  readonly filters?: FilterEntry[];
  readonly query?: string;
  readonly isTailing?: boolean;
  readonly onClose?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LogDistributionWidget({
  workspaceId,
  sourceIds,
  fusionId,
  filters,
  query,
  isTailing,
  onClose,
}: Readonly<LogDistributionWidgetProps>) {
  const { timeRange, setTimeRange, timeRangeBounds, resetTimeRangeToAllTime } =
    useInvestigationStore();
  const [data, setData] = useState<Bucket[]>([]);
  const [bucketInterval, setBucketInterval] = useState<string>("1 hour");
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFiltered = useMemo(() => {
    if (!timeRangeBounds.start || !timeRangeBounds.end) {
      return false;
    }
    return (
      (timeRange.start && timeRange.start !== timeRangeBounds.start) ||
      (timeRange.end && timeRange.end !== timeRangeBounds.end)
    );
  }, [timeRange, timeRangeBounds]);

  useEffect(() => {
    let mounted = true;

    const fetchDistribution = async () => {
      if (!workspaceId) {
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const [distRes, anomalyRes] = await Promise.all([
          callSidecar<{ buckets: Bucket[]; bucket_interval?: string }>({
            method: "get_log_distribution",
            params: {
              workspace_id: workspaceId,
              source_ids: sourceIds,
              fusion_id: fusionId,
              query: query,
              filters: filters,
              start_time: timeRange.start || undefined,
              end_time: timeRange.end || undefined,
            },
          }),
          callSidecar<{ anomalies: Anomaly[] }>({
            method: "get_anomalies",
            params: { workspace_id: workspaceId },
          }),
        ]);

        if (mounted) {
          setData(distRes.buckets || []);
          setBucketInterval(distRes.bucket_interval || "1 hour");
          setAnomalies(anomalyRes.anomalies || []);
        }
      } catch (err) {
        if (mounted) {
          setError("Failed to load log distribution");
          console.error("Distribution fetch error:", err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchDistribution();

    if (isTailing) {
      const interval = setInterval(fetchDistribution, 3000);
      return () => {
        mounted = false;
        clearInterval(interval);
      };
    }
    return () => {
      mounted = false;
    };
  }, [workspaceId, sourceIds, fusionId, filters, query, isTailing, timeRange]);

  const formattedData = useMemo(
    () =>
      data.map((d) => {
        const timeStr = d.bucket;
        const parts = timeStr.split(" ");
        const displayTime = parts.length === 2 ? parts[1] : timeStr;

        const hasAnomaly = anomalies.some((a) => a.timestamp.startsWith(timeStr));

        return {
          ...d,
          displayTime,
          hasAnomaly,
          INFO: d.INFO || 0,
          ERROR: d.ERROR || 0,
          WARN: d.WARN || 0,
        };
      }),
    [data, anomalies],
  );

  const statusOverlay = useMemo(() => {
    if (loading && data.length === 0) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-base/80 z-20">
          <div className="animate-pulse text-text-muted text-xs">
            Synchronizing timeline data...
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-base/80 z-20 px-10 text-center">
          <div className="text-red-400 text-xs mb-2 font-medium">{error}</div>
        </div>
      );
    }

    if (data.length === 0) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-base/80 z-20">
          <div className="text-text-muted/50 text-xs mb-1">
            No logs matching criteria in this range
          </div>
          {isTailing && (
            <div className="text-[10px] text-text-muted/30">Waiting for live data...</div>
          )}
        </div>
      );
    }

    return null;
  }, [loading, error, data.length, isTailing]);

  // ─── Event Handlers ──────────────────────────────────────────────────────────

  const handleChartClick = useCallback(
    (params: any) => {
      if (params.componentType === "series") {
        const dataIndex = params.dataIndex;
        const bucketItem = formattedData[dataIndex];
        if (!bucketItem) {
          return;
        }
        const bucket = bucketItem.bucket;

        const start = parseDbDate(bucket);
        let durationMs = 3600 * 1000;
        if (bucketInterval) {
          const parts = bucketInterval.split(" ");
          const val = Number.parseInt(parts[0], 10);
          const unit = parts[1]?.toLowerCase();
          if (!Number.isNaN(val) && unit) {
            if (unit.startsWith("second")) {
              durationMs = val * 1000;
            } else if (unit.startsWith("minute")) {
              durationMs = val * 60 * 1000;
            } else if (unit.startsWith("hour")) {
              durationMs = val * 3600 * 1000;
            } else if (unit.startsWith("day")) {
              durationMs = val * 24 * 3600 * 1000;
            } else if (unit.startsWith("month")) {
              durationMs = val * 30 * 24 * 3600 * 1000;
            }
          }
        }
        const end = new Date(start.getTime() + durationMs);

        const startStr = formatToDbString(start);
        const endStr = formatToDbString(end);

        const parts = bucket.split(" ");
        const displayTime = parts.length === 2 ? parts[1] : bucket;

        setTimeRange({
          start: startStr,
          end: endStr,
          label: `${displayTime} (Zoomed)`,
        });
      }
    },
    [formattedData, bucketInterval, setTimeRange],
  );

  const onEvents = useMemo(() => {
    return {
      click: handleChartClick,
    };
  }, [handleChartClick]);

  // ─── ECharts Options ─────────────────────────────────────────────────────────

  const infoData = useMemo(() => formattedData.map((d) => d.INFO), [formattedData]);
  const warnData = useMemo(() => formattedData.map((d) => d.WARN), [formattedData]);
  const errorData = useMemo(() => {
    return formattedData.map((d) => {
      if (d.hasAnomaly) {
        return {
          value: d.ERROR,
          itemStyle: {
            borderRadius: [4, 4, 0, 0] as [number, number, number, number],
            borderColor: "var(--color-text-primary)",
            borderWidth: 2,
            borderType: "solid" as const,
          },
        };
      }
      return {
        value: d.ERROR,
        itemStyle: {
          borderRadius: [4, 4, 0, 0] as [number, number, number, number],
        },
      };
    });
  }, [formattedData]);

  const option = useMemo(() => {
    return {
      backgroundColor: "transparent",
      color: ["#38bdf8", "#f59e0b", "#ef4444"],
      tooltip: {
        trigger: "axis" as const,
        axisPointer: {
          type: "shadow" as const,
          shadowStyle: {
            color: "rgba(30, 37, 32, 0.3)",
          },
        },
        backgroundColor: "#111312",
        borderColor: "#1d2420",
        borderWidth: 1,
        borderRadius: 8,
        textStyle: {
          color: "#e8f5ec",
          fontSize: 12,
          fontFamily: "JetBrains Mono",
        },
        formatter: (params: any) => {
          if (!params || params.length === 0) {
            return "";
          }
          const fullDateTime = params[0].name || "";
          const parts = fullDateTime.split(" ");
          const datePart = parts[0] || "";
          const timePart = parts[1] || "";

          let html = `<div style="font-weight: 700; margin-bottom: 6px; font-family: 'JetBrains Mono', monospace;">`;
          if (datePart) {
            html += `<span style="color: var(--color-primary); margin-right: 4px;">${datePart}</span>`;
          }
          if (timePart) {
            html += `<span>${timePart}</span>`;
          }
          if (!timePart && !datePart) {
            html += `<span>${fullDateTime}</span>`;
          }
          html += `</div>`;

          for (const param of params) {
            // value might be an object if customized (anomalous bars)
            const rawVal = param.value;
            const val = typeof rawVal === "object" && rawVal !== null ? rawVal.value : rawVal;
            const displayVal = val || 0;
            html += `<div style="display: flex; justify-content: space-between; gap: 16px; font-family: 'JetBrains Mono', monospace; color: ${param.color};">
              <span>${param.seriesName}</span>
              <span style="font-weight: 600;">${displayVal.toLocaleString()}</span>
            </div>`;
          }

          html += `<div style="margin-top: 6px; font-size: 9px; color: var(--color-text-muted); opacity: 0.6; text-align: center; font-family: 'JetBrains Mono', monospace;">
            Click to zoom into this window
          </div>`;
          return html;
        },
      },
      grid: {
        top: 10,
        right: 10,
        bottom: 25,
        left: 35,
        containLabel: false,
      },
      xAxis: {
        type: "category" as const,
        data: formattedData.map((d) => d.bucket),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#4d6057",
          fontSize: 10,
          fontFamily: "Inter, sans-serif",
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
              const prevItem = formattedData[index - 1];
              if (prevItem) {
                const prevDate = prevItem.bucket.split(" ")[0];
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
              color: "#22c55e",
              fontWeight: "bold" as const,
              fontSize: 9,
              lineHeight: 12,
            },
          },
        },
      },
      yAxis: {
        type: "value" as const,
        splitLine: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#4d6057",
          fontSize: 10,
          fontFamily: "Inter, sans-serif",
        },
      },
      series: [
        {
          name: "INFO",
          type: "bar" as const,
          stack: "total",
          data: infoData,
          itemStyle: {
            borderRadius: [0, 0, 4, 4] as [number, number, number, number],
          },
        },
        {
          name: "WARN",
          type: "bar" as const,
          stack: "total",
          data: warnData,
        },
        {
          name: "ERROR",
          type: "bar" as const,
          stack: "total",
          data: errorData,
        },
      ],
    };
  }, [formattedData, infoData, warnData, errorData, bucketInterval]);

  return (
    <div className="min-h-[220px] h-[220px] w-full bg-bg-base border-b border-border/40 shrink-0 flex flex-col relative group select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-10 border-b border-border/20 bg-bg-base/50">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            Distribution Insights
          </span>
          {isFiltered && (
            <button
              type="button"
              onClick={resetTimeRangeToAllTime}
              className="ml-2 flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-primary hover:text-text-inverse bg-primary/10 hover:bg-primary border border-primary/20 rounded transition-colors duration-200 cursor-pointer"
            >
              <ZoomIn className="size-2.5" />
              Reset Zoom
            </button>
          )}
        </div>

        <div className="flex items-center gap-4">
          {anomalies.length > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 rounded-full border border-red-500/20">
              <div className="size-1.5 bg-red-500 rounded-full animate-ping" />
              <span className="text-[10px] text-red-500 font-bold uppercase">Spike Detected</span>
            </div>
          )}
          {isTailing && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 rounded-full border border-primary/20">
              <div className="size-1.5 bg-primary rounded-full animate-pulse" />
              <span className="text-[10px] text-primary font-bold uppercase">Live Flow</span>
            </div>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-white/10 text-text-muted transition-colors cursor-pointer"
              title="Close Chart"
              type="button"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 p-4 relative overflow-hidden">
        {statusOverlay}

        {formattedData.length > 0 && (
          <ReactECharts option={option} onEvents={onEvents} style={{ cursor: "pointer" }} />
        )}
      </div>
    </div>
  );
}
