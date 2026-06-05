// Assume Role: Frontend Engineer (@frontend)

import { History, ZoomIn } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

/**
 * DashboardCharts organism — Kibana-style severity histogram.
 *
 * Supports:
 * - Single bar click → drilldown into that exact bucket's time range.
 * - Mouse drag → marquee selection across multiple bars.
 * - "Reset Zoom" button when a filter is active.
 * - Tooltip showing exact count per level.
 */
export function DashboardCharts({
  stats,
  bucketInterval = "1 hour",
  timeBounds,
  timeRange,
  onZoom,
  onReset,
}: Readonly<DashboardChartsProps>) {
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [_hoveredBucket, _setHoveredBucket] = useState<string | null>(null);

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

  // ── Drag-to-zoom handlers ──────────────────────────────────────────────────

  const handleMouseDown = useCallback((e: any) => {
    if (e?.activeLabel) {
      setRefAreaLeft(e.activeLabel);
      setIsDragging(false);
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: any) => {
      if (refAreaLeft && e?.activeLabel) {
        setRefAreaRight(e.activeLabel);
        setIsDragging(true);
      }
    },
    [refAreaLeft],
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging && refAreaLeft && refAreaRight) {
      let start = refAreaLeft;
      let end = refAreaRight;
      if (start > end) {
        [start, end] = [end, start];
      }
      onZoom(padToIso(start), padToIso(addInterval(end, bucketInterval)));
    }
    setRefAreaLeft(null);
    setRefAreaRight(null);
    setIsDragging(false);
  }, [isDragging, refAreaLeft, refAreaRight, bucketInterval, onZoom]);

  // ── Single-click drilldown ─────────────────────────────────────────────────

  const handleBarClick = useCallback(
    (data: any) => {
      if (isDragging) {
        return; // Don't fire click if user was dragging
      }
      const bucket = data?.activeLabel || data?.activePayload?.[0]?.payload?.timestamp;
      if (!bucket) {
        return;
      }
      const bucketStart = padToIso(bucket);
      const bucketEnd = addInterval(bucket, bucketInterval);
      onZoom(bucketStart, bucketEnd);
    },
    [isDragging, bucketInterval, onZoom],
  );

  // ── X-axis tick renderer ───────────────────────────────────────────────────

  const renderXAxisTick = (props: any) => {
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
      const prevItem = chartData[index - 1];
      if (prevItem) {
        const prevDate = prevItem.timestamp.split(" ")[0];
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
          fill="var(--text-muted)"
          fontSize={9}
          fontFamily="JetBrains Mono"
        >
          {primaryLabel}
        </text>
        {showDate && secondaryLabel && (
          <text
            x={0}
            y={0}
            dy={20}
            textAnchor="middle"
            fill="var(--text-muted)"
            fontSize={8}
            fontFamily="JetBrains Mono"
            fontWeight="600"
            opacity={0.8}
          >
            {secondaryLabel}
          </text>
        )}
      </g>
    );
  };

  return (
    <div className="w-full">
      {/* Combined Severity Timeline Panel */}
      <section className="w-full bg-bg-surface/50 border border-border rounded-xl p-6 backdrop-blur-sm relative overflow-hidden h-[340px] flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted">
              Severity Over Time
            </h2>

            {/* Bucket indicator */}
            <span className="text-[9px] font-mono text-text-muted/50 ml-1 border border-border/30 rounded px-1 py-px">
              {bucketInterval}/bar
            </span>

            {/* Reset Zoom button — visible when a filter is active */}
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

          {/* Inline Legend */}
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

        {/* Drag hint */}
        <p className="text-[9px] font-mono text-text-muted/40 mb-2 -mt-3">
          Click a bar to drill down · Drag to select a range
        </p>

        <div className="flex-1 w-full min-h-0 select-none">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart
                data={chartData}
                maxBarSize={28}
                barCategoryGap="2%"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onClick={handleBarClick}
                style={{ cursor: isDragging ? "col-resize" : "pointer" }}
                margin={{ bottom: 20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--border-muted)"
                />
                <XAxis
                  dataKey="timestamp"
                  axisLine={false}
                  tickLine={false}
                  padding={{ left: 10, right: 10 }}
                  tick={renderXAxisTick}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fontSize: 9,
                    fill: "var(--text-muted)",
                    fontFamily: "JetBrains Mono",
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-surface-bright)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "10px",
                    fontFamily: "JetBrains Mono",
                  }}
                  labelStyle={{ fontWeight: "bold", color: "var(--text-primary)" }}
                  cursor={{ fill: "var(--primary)", fillOpacity: 0.06 }}
                />
                <Bar
                  dataKey="DEBUG"
                  stackId="a"
                  fill={LEVEL_COLORS.DEBUG}
                  radius={[0, 0, 0, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="INFO"
                  stackId="a"
                  fill={LEVEL_COLORS.INFO}
                  radius={[0, 0, 0, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="WARN"
                  stackId="a"
                  fill={LEVEL_COLORS.WARN}
                  radius={[0, 0, 0, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="ERROR"
                  stackId="a"
                  fill={LEVEL_COLORS.ERROR}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />

                {/* Drag-selection highlight */}
                {refAreaLeft && refAreaRight && (
                  <ReferenceArea
                    x1={refAreaLeft}
                    x2={refAreaRight}
                    strokeOpacity={0.4}
                    fill="var(--primary)"
                    fillOpacity={0.15}
                    stroke="var(--primary)"
                    strokeDasharray="4 2"
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
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
