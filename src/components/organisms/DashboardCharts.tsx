import { LevelBar } from "@/components/molecules/LevelBar";
import { BarChart3, History } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface DashboardChartsProps {
  stats: any;
}

/**
 * DashboardCharts organism that encapsulates the main data visualizations.
 */
export function DashboardCharts({ stats }: Readonly<DashboardChartsProps>) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Ingestion Timeline */}
      <section className="lg:col-span-2 bg-bg-surface/50 border border-border rounded-xl p-6 backdrop-blur-sm relative overflow-hidden h-[300px] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted">
              Ingestion Volume
            </h2>
          </div>
        </div>
        <div className="flex-1 w-full min-h-0">
          {stats && stats.time_series.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.time_series}>
                <defs>
                  <linearGradient id="colorIngest" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--border-muted)"
                />
                <XAxis
                  dataKey="timestamp"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fontSize: 9,
                    fill: "var(--text-muted)",
                    fontFamily: "JetBrains Mono",
                  }}
                  minTickGap={30}
                  tickFormatter={(val) => val.split(" ")[1]}
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
                    fontSize: "10px",
                    fontFamily: "JetBrains Mono",
                  }}
                  itemStyle={{ color: "var(--primary)" }}
                />
                <Area
                  type="monotone"
                  dataKey="INFO"
                  stackId="1"
                  stroke="var(--primary)"
                  fillOpacity={1}
                  fill="url(#colorIngest)"
                />
                <Area
                  type="monotone"
                  dataKey="WARN"
                  stackId="1"
                  stroke="var(--warning)"
                  fill="var(--warning)"
                  fillOpacity={0.1}
                />
                <Area
                  type="monotone"
                  dataKey="ERROR"
                  stackId="1"
                  stroke="var(--error)"
                  fill="var(--error)"
                  fillOpacity={0.1}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-[10px] font-mono text-text-muted uppercase tracking-widest">
              No Time Data
            </div>
          )}
        </div>
      </section>

      {/* Severity Summary */}
      <section className="lg:col-span-1 bg-bg-surface/50 border border-border rounded-xl p-6 backdrop-blur-sm relative overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted">
            Severity Distribution
          </h2>
        </div>
        <div className="space-y-4 relative z-10 overflow-y-auto pr-2 custom-scrollbar">
          {stats && Object.keys(stats.level_counts).length > 0 ? (
            Object.entries(stats.level_counts)
              .sort((a, b) => (b[1] as number) - (a[1] as number))
              .map(([level, count]) => (
                <LevelBar
                  key={level}
                  level={level}
                  count={count as number}
                  total={stats.total_logs}
                />
              ))
          ) : (
            <div className="py-10 text-center text-[10px] font-mono text-text-muted uppercase tracking-widest">
              No Data
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
