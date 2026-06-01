// Assume Role: Frontend Engineer (@frontend)

import { History } from "lucide-react";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface DashboardChartsProps {
  stats: any;
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

/**
 * DashboardCharts organism that encapsulates the main data visualizations.
 */
export function DashboardCharts({ stats }: Readonly<DashboardChartsProps>) {
  const levelCounts = stats?.level_counts || {};
  const totalLogs = stats?.total_logs || 0;

  // Aggregate stats.level_counts to combine variants (e.g. WARNING -> WARN, FATAL -> ERROR)
  const aggregatedCounts = useMemo(() => {
    return {
      DEBUG: levelCounts.DEBUG || levelCounts.debug || 0,
      INFO: levelCounts.INFO || levelCounts.info || 0,
      WARN: (levelCounts.WARN || 0) + (levelCounts.WARNING || 0) + (levelCounts.warn || 0),
      ERROR:
        (levelCounts.ERROR || 0) +
        (levelCounts.FATAL || 0) +
        (levelCounts.CRITICAL || 0) +
        (levelCounts.error || 0),
    };
  }, [levelCounts]);

  // Normalize time-series data to standard severity keys
  const chartData = useMemo(() => {
    if (!stats?.time_series) {
      return [];
    }
    return stats.time_series.map((item: any) => {
      const info = item.INFO || item.info || 0;
      const debug = item.DEBUG || item.debug || 0;
      const warn = (item.WARN || 0) + (item.WARNING || 0) + (item.warn || 0);
      const error =
        (item.ERROR || 0) + (item.FATAL || 0) + (item.CRITICAL || 0) + (item.error || 0);
      return {
        timestamp: item.timestamp,
        DEBUG: debug,
        INFO: info,
        WARN: warn,
        ERROR: error,
      };
    });
  }, [stats?.time_series]);

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
          </div>

          {/* Inline Legend with Totals and Percentages */}
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

        <div className="flex-1 w-full min-h-0">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} maxBarSize={32}>
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
                  tick={{
                    fontSize: 9,
                    fill: "var(--text-muted)",
                    fontFamily: "JetBrains Mono",
                  }}
                  minTickGap={30}
                  tickFormatter={(val) => {
                    if (!val) {
                      return "";
                    }
                    const parts = val.split(" ");
                    return parts.length > 1 ? parts[1] : val;
                  }}
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
                />
                <Bar dataKey="DEBUG" stackId="a" fill={LEVEL_COLORS.DEBUG} radius={[0, 0, 0, 0]} />
                <Bar dataKey="INFO" stackId="a" fill={LEVEL_COLORS.INFO} radius={[0, 0, 0, 0]} />
                <Bar dataKey="WARN" stackId="a" fill={LEVEL_COLORS.WARN} radius={[0, 0, 0, 0]} />
                <Bar dataKey="ERROR" stackId="a" fill={LEVEL_COLORS.ERROR} radius={[4, 4, 0, 0]} />
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
