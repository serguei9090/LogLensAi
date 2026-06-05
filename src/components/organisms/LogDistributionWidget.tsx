// Assume Role: Frontend Engineer (@frontend)
import { X, ZoomIn } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FilterEntry } from "@/components/molecules/FilterBuilder";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { useInvestigationStore } from "@/store/investigationStore";

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
}: LogDistributionWidgetProps) {
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

  // Format the time bucket for display — memoized to avoid recalculation every render
  const formattedData = useMemo(
    () =>
      data.map((d) => {
        const timeStr = d.bucket; // "YYYY-MM-DD HH:MM:SS" or similar
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

  // Memoized status overlay — prevents the "setState during render" error that
  // occurs when an inline function interacts with parent store updates mid-render.
  // The specific error was: "Cannot update SystemDiagnosticConsole while rendering
  // a different component (ForwardRef [ResponsiveContainer])".
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

  const handleBarClick = useCallback(
    (clickData: any) => {
      const bucket =
        clickData?.bucket ||
        clickData?.payload?.bucket ||
        clickData?.activeLabel ||
        clickData?.activePayload?.[0]?.payload?.bucket;
      if (!bucket) {
        return;
      }
      const start = parseDbDate(bucket);
      let durationMs = 3600 * 1000; // default 1 hour
      if (bucketInterval) {
        const parts = bucketInterval.split(" ");
        const val = parseInt(parts[0], 10);
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

      // Extract display label
      const parts = bucket.split(" ");
      const displayTime = parts.length === 2 ? parts[1] : bucket;

      setTimeRange({
        start: startStr,
        end: endStr,
        label: `${displayTime} (Zoomed)`,
      });
    },
    [bucketInterval, setTimeRange],
  );

  const renderXAxisTick = useCallback(
    (props: any) => {
      const { x, y, payload, index } = props;
      if (!payload?.value) {
        return null;
      }

      const bucketStr = payload.value;
      const parts = bucketStr.split(" ");
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
      const secondaryLabel = timePart ? datePart : "";

      // Show date if index is 0, or if the date has changed from the previous item
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

      return (
        <g transform={`translate(${x},${y})`}>
          <text
            x={0}
            y={0}
            dy={10}
            textAnchor="middle"
            fill="var(--color-text-muted)"
            fontSize={10}
          >
            {primaryLabel}
          </text>
          {showDate && secondaryLabel && (
            <text
              x={0}
              y={0}
              dy={22}
              textAnchor="middle"
              fill="var(--color-primary)"
              fontSize={9}
              fontWeight="700"
              opacity={0.9}
            >
              {secondaryLabel}
            </text>
          )}
        </g>
      );
    },
    [bucketInterval, formattedData],
  );

  const CustomTooltip = useCallback(({ active, payload, label }: any) => {
    if (!active || !payload?.length) {
      return null;
    }
    // label === the bucket key from XAxis dataKey
    const fullDateTime = label || "";
    const parts = fullDateTime.split(" ");
    const datePart = parts[0] || "";
    const timePart = parts[1] || "";

    return (
      <div
        style={{
          backgroundColor: "var(--color-bg-tooltip)",
          borderColor: "var(--color-border-subtle)",
          borderWidth: 1,
          borderStyle: "solid",
          borderRadius: 8,
          padding: "8px 12px",
          fontSize: 12,
          minWidth: 140,
        }}
      >
        <div style={{ marginBottom: 6, fontWeight: 700, color: "var(--color-text-primary)" }}>
          {datePart && (
            <span style={{ color: "var(--color-primary)", marginRight: 4 }}>{datePart}</span>
          )}
          {timePart && <span>{timePart}</span>}
          {!timePart && !datePart && <span>{fullDateTime}</span>}
        </div>
        {payload.map((entry: any) => (
          <div
            key={entry.dataKey}
            style={{ display: "flex", justifyContent: "space-between", gap: 16, color: entry.fill }}
          >
            <span>{entry.dataKey}</span>
            <span style={{ fontWeight: 600 }}>{entry.value.toLocaleString()}</span>
          </div>
        ))}
        <div
          style={{
            marginTop: 6,
            fontSize: 9,
            color: "var(--color-text-muted)",
            opacity: 0.6,
            textAlign: "center",
          }}
        >
          Click to zoom into this window
        </div>
      </div>
    );
  }, []);

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
              className="ml-2 flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-primary hover:text-text-inverse bg-primary/10 hover:bg-primary border border-primary/20 rounded transition-all cursor-pointer"
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

      {/*
        Chart container — flex-1 + min-h-0 ensures flexbox resolves to a real
        pixel height before Recharts measures it.  Without min-h-0, a flex child
        inside a fixed-height parent can report -1 to ResponsiveContainer on the
        first paint, triggering the "width(-1) and height(-1)" warning.
      */}
      <div className="flex-1 min-h-0 p-4 relative overflow-hidden">
        {statusOverlay}

        {/*
          Only mount the chart when there is data.
          Skipping it while empty/loading prevents the width(-1)/height(-1)
          Recharts warning that fires when the container hasn't laid out yet.
        */}
        {formattedData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart
              data={formattedData}
              margin={{ top: 0, right: 10, left: -20, bottom: 20 }}
              style={{ cursor: "pointer" }}
            >
              <XAxis dataKey="bucket" tick={renderXAxisTick} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                dx={-5}
              />
              <Tooltip content={CustomTooltip} cursor={{ fill: "var(--color-bg-hover)" }} />
              <Bar
                dataKey="INFO"
                stackId="a"
                fill="var(--color-info)"
                radius={[0, 0, 4, 4]}
                onClick={handleBarClick}
              />
              <Bar
                dataKey="WARN"
                stackId="a"
                fill="var(--color-warning)"
                onClick={handleBarClick}
              />
              <Bar
                dataKey="ERROR"
                stackId="a"
                fill="var(--color-error)"
                radius={[4, 4, 0, 0]}
                onClick={handleBarClick}
              >
                {formattedData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill="var(--color-error)"
                    stroke={entry.hasAnomaly ? "var(--color-text-primary)" : "none"}
                    strokeWidth={entry.hasAnomaly ? 2 : 0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
