import {
  type DashboardMode,
  DashboardModeToggle,
} from "@/components/molecules/DashboardModeToggle";
import { type TimeRange, TimeRangePicker } from "@/components/molecules/TimeRangePicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { cn } from "@/lib/utils";
import { selectActiveWorkspace, useWorkspaceStore } from "@/store/workspaceStore";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Database,
  History,
  Layers,
  RefreshCcw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface DashboardStats {
  total_logs: number;
  total_clusters: number;
  level_counts: Record<string, number>;
  top_clusters: { template: string; count: number }[];
  top_error_clusters: { template: string; count: number }[];
  time_series: any[];
  source_heatmap: { timestamp: string; source_id: string; source_name: string; count: number }[];
  latest_ai_insight: string | null;
  new_patterns_count: number;
  workspace_count: number;
  active_tailers: number;
}

interface IngestionJob {
  id: number;
  workspace_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  total_lines: number;
  processed_lines: number;
  created_at: string;
}

/**
 * Renders the dashboard header with title and mode descriptions.
 */
function DashboardHeader({
  mode,
  loading,
  onRefresh,
}: Readonly<{ mode: DashboardMode; loading: boolean; onRefresh: () => void }>) {
  const title = mode === "static" ? "Dashboard" : "AI Insights";
  const description =
    mode === "static"
      ? "High-velocity log analytics and system health overview."
      : "Heuristic pattern analysis and anomaly detection.";

  return (
    <div className="flex justify-between items-start mb-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-text-base mb-1 font-mono uppercase italic flex items-center gap-3">
          {title}
          {mode === "ai" && <Sparkles className="size-6 text-primary-green" />}
        </h1>
        <p className="text-text-muted text-sm">{description}</p>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        className="p-2 rounded-lg bg-bg-surface border border-border hover:bg-bg-elevated transition-colors text-text-muted hover:text-primary-green"
        title="Refresh Data"
      >
        <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
      </button>
    </div>
  );
}

/**
 * Renders the filter controls for the dashboard.
 */
function DashboardFilters({
  selectedWorkspaceId,
  onWorkspaceChange,
  workspaces,
  selectedSourceId,
  onSourceChange,
  sources,
  timeRange,
  onTimeRangeChange,
}: Readonly<{
  selectedWorkspaceId: string;
  onWorkspaceChange: (v: string) => void;
  workspaces: any[];
  selectedSourceId: string;
  onSourceChange: (v: string) => void;
  sources: any[];
  timeRange: TimeRange;
  onTimeRangeChange: (tr: TimeRange) => void;
}>) {
  const selectedWorkspace = workspaces.find((w) => w.id === selectedWorkspaceId);
  const selectedSource = sources.find((s) => s.id === selectedSourceId);

  return (
    <div className="flex flex-wrap items-center gap-3 bg-bg-surface/30 p-2 rounded-xl border border-border/50 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-2">
          Context:
        </span>

        <Select value={selectedWorkspaceId} onValueChange={(val) => val && onWorkspaceChange(val)}>
          <SelectTrigger className="w-[180px] h-8 text-[11px] bg-bg-base/40 border-white/5 hover:border-white/10 transition-all font-medium">
            <SelectValue placeholder="Select Workspace">{selectedWorkspace?.name}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {workspaces.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedSourceId}
          onValueChange={(val) => val && onSourceChange(val)}
          disabled={selectedWorkspaceId === "all"}
        >
          <SelectTrigger className="w-[180px] h-8 text-[11px] bg-bg-base/40 border-white/5 hover:border-white/10 transition-all font-medium">
            <SelectValue placeholder="Log Source">
              {selectedSourceId === "all" ? "Entire Workspace" : selectedSource?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Entire Workspace</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="h-4 w-px bg-border/50 mx-1" />

      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
          Time:
        </span>
        <TimeRangePicker
          value={timeRange}
          onChange={onTimeRangeChange}
          className="h-8 scale-90 origin-left"
        />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  // Global State
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const activeWorkspace = useWorkspaceStore(selectActiveWorkspace);

  // Local State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [ingestionJobs, setIngestionJobs] = useState<IngestionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<DashboardMode>("static");

  // Filter State
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("all");
  const [selectedSourceId, setSelectedSourceId] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<TimeRange>({ start: "", end: "" });

  // Sync selectedWorkspaceId with activeWorkspace on initial load
  useEffect(() => {
    if (activeWorkspace && selectedWorkspaceId === "all") {
      setSelectedWorkspaceId(activeWorkspace.id);
    } else if (!activeWorkspace && workspaces.length > 0 && selectedWorkspaceId === "all") {
      setSelectedWorkspaceId(workspaces[0].id);
    }
  }, [activeWorkspace, workspaces, selectedWorkspaceId]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await callSidecar<DashboardStats>({
        method: "get_dashboard_stats",
        params: {
          workspace_id: selectedWorkspaceId === "all" ? undefined : selectedWorkspaceId,
          source_id: selectedSourceId === "all" ? undefined : selectedSourceId,
          start_time: timeRange.start || undefined,
          end_time: timeRange.end || undefined,
          active_workspace_ids: workspaces.map((w) => w.id),
        },
        silent: true,
      });
      setStats(res);
    } catch (e) {
      console.error("Failed to fetch dashboard stats", e);
    } finally {
      setLoading(false);
    }
  }, [selectedWorkspaceId, selectedSourceId, timeRange, workspaces]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Polling for Ingestion Jobs
  const fetchJobs = useCallback(async () => {
    try {
      const res = await callSidecar<IngestionJob[]>({
        method: "get_ingestion_jobs",
        params: {
          workspace_id: selectedWorkspaceId === "all" ? undefined : selectedWorkspaceId,
        },
        silent: true,
      });
      setIngestionJobs(res || []);
    } catch (e) {
      console.error("Failed to fetch ingestion jobs", e);
    }
  }, [selectedWorkspaceId]);

  useEffect(() => {
    const timer = setInterval(fetchJobs, 3000);
    fetchJobs(); // Initial fetch
    return () => clearInterval(timer);
  }, [fetchJobs]);

  // Derived Options
  const currentWorkspace = useMemo(
    () => workspaces.find((w) => w.id === selectedWorkspaceId),
    [workspaces, selectedWorkspaceId],
  );

  const sources = useMemo(() => currentWorkspace?.sources || [], [currentWorkspace]);

  /**
   * Renders the background processing progress indicators.
   */
  const renderProcessingHUD = () => {
    const activeJobs = ingestionJobs.filter(
      (j) => j.status === "processing" || j.status === "pending",
    );
    if (activeJobs.length === 0) {
      return null;
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <RefreshCcw className="size-3 text-primary-green animate-spin" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            Background Processing
          </span>
        </div>
        {activeJobs.map((job) => (
          <motion.div
            key={job.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="bg-bg-surface/40 border border-border/50 rounded-xl p-4 backdrop-blur-sm"
          >
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-primary-green bg-primary-green/10 px-1.5 py-0.5 rounded uppercase font-bold">
                  Job #{job.id}
                </span>
                <span className="text-[11px] font-medium text-text-primary uppercase tracking-tight">
                  Clustering Patterns...
                </span>
              </div>
              <span className="text-[10px] font-mono text-text-muted">
                {job.processed_lines.toLocaleString()} / {job.total_lines.toLocaleString()} lines
              </span>
            </div>
            <div className="h-1.5 bg-bg-base/50 rounded-full overflow-hidden border border-white/5">
              <motion.div
                className="h-full bg-primary-green shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                initial={{ width: 0 }}
                animate={{ width: `${(job.processed_lines / job.total_lines) * 100}%` }}
                transition={{ type: "spring", stiffness: 50 }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    );
  };

  /**
   * Renders the main analytics charts.
   */
  const renderMainCharts = () => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Ingestion Timeline */}
        <section className="lg:col-span-2 bg-bg-surface/50 border border-border rounded-xl p-6 backdrop-blur-sm relative overflow-hidden h-[300px] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary-green" />
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
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(255,255,255,0.05)"
                  />
                  <XAxis
                    dataKey="timestamp"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 9,
                      fill: "rgba(255,255,255,0.4)",
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
                      fill: "rgba(255,255,255,0.4)",
                      fontFamily: "JetBrains Mono",
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#111",
                      border: "1px solid #333",
                      fontSize: "10px",
                      fontFamily: "JetBrains Mono",
                    }}
                    itemStyle={{ color: "#10b981" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="INFO"
                    stackId="1"
                    stroke="#10b981"
                    fillOpacity={1}
                    fill="url(#colorIngest)"
                  />
                  <Area
                    type="monotone"
                    dataKey="WARN"
                    stackId="1"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.1}
                  />
                  <Area
                    type="monotone"
                    dataKey="ERROR"
                    stackId="1"
                    stroke="#ef4444"
                    fill="#ef4444"
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
            <BarChart3 className="h-4 w-4 text-primary-green" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted">
              Severity Distribution
            </h2>
          </div>
          <div className="space-y-4 relative z-10 overflow-y-auto pr-2 custom-scrollbar">
            {stats && Object.keys(stats.level_counts).length > 0 ? (
              Object.entries(stats.level_counts)
                .sort((a, b) => b[1] - a[1])
                .map(([level, count]) => (
                  <LevelBar key={level} level={level} count={count} total={stats.total_logs} />
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
  };

  /**
   * Renders the source activity heatmap grid.
   */
  const renderSourceHeatmap = () => {
    if (!stats || stats.source_heatmap.length === 0) {
      return (
        <div className="py-20 text-center text-[10px] font-mono text-text-muted uppercase tracking-widest">
          Insufficient Source Data
        </div>
      );
    }

    const uniqueSources = Array.from(new Set(stats.source_heatmap.map((d) => d.source_name)));

    return (
      <div className="relative z-10">
        <div className="flex flex-col gap-4">
          {uniqueSources.map((sourceName) => {
            const sourceData = stats.source_heatmap.filter((d) => d.source_name === sourceName);
            const maxCount = Math.max(...sourceData.map((d) => d.count));

            return (
              <div key={sourceName} className="flex items-center gap-4">
                <span className="text-[10px] font-mono text-text-muted w-32 truncate">
                  {sourceName}
                </span>
                <div className="flex-1 flex gap-1 h-4">
                  {sourceData.slice(-50).map((d) => {
                    const intensity = maxCount > 0 ? d.count / maxCount : 0;
                    return (
                      <div
                        key={`${d.source_name}-${d.timestamp}`}
                        className="h-full flex-1 rounded-sm border border-white/5 transition-all hover:scale-110"
                        style={{
                          backgroundColor: `rgba(16, 185, 129, ${0.1 + intensity * 0.9})`,
                          minWidth: "4px",
                        }}
                        title={`${d.timestamp}: ${d.count} logs`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading && !stats) {
    const loadingText = mode === "static" ? "Loading Analytics..." : "Scanning for AI Insights...";
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-base">
        <div className="flex flex-col items-center gap-4">
          <RefreshCcw className="h-8 w-8 text-primary-green animate-spin" />
          <p className="text-sm text-text-muted font-mono uppercase tracking-widest">
            {loadingText}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-bg-base overflow-y-auto p-8 custom-scrollbar pb-32">
      <header className="mb-10">
        <DashboardHeader mode={mode} loading={loading} onRefresh={fetchStats} />
        <DashboardFilters
          selectedWorkspaceId={selectedWorkspaceId}
          onWorkspaceChange={(v) => {
            setSelectedWorkspaceId(v || "all");
            setSelectedSourceId("all");
          }}
          workspaces={workspaces}
          selectedSourceId={selectedSourceId}
          onSourceChange={(v) => setSelectedSourceId(v || "all")}
          sources={sources}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
        />
      </header>

      <AnimatePresence mode="wait">
        {mode === "static" ? (
          <motion.div
            key="static"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-10"
          >
            {/* Processing HUD */}
            {renderProcessingHUD()}

            {/* AI Insight Snippet */}
            {stats?.latest_ai_insight && (
              <motion.section
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-primary-green/5 border border-primary-green/20 rounded-2xl p-6 backdrop-blur-md relative overflow-hidden group"
              >
                <div className="flex items-start justify-between gap-6 relative z-10">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="size-4 text-primary-green animate-pulse" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary-green">
                        Latest AI Observation
                      </span>
                    </div>
                    <p className="text-sm font-mono text-text-primary leading-relaxed italic">
                      &quot;{stats.latest_ai_insight}&quot;
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMode("ai")}
                    className="shrink-0 px-4 py-2 bg-primary-green text-bg-base text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-primary-green/90 transition-all hover:scale-105 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                  >
                    Deep Dive
                  </button>
                </div>
                <div className="absolute -top-20 -right-20 size-64 bg-primary-green/10 rounded-full blur-[80px] pointer-events-none" />
              </motion.section>
            )}

            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard
                icon={<Database className="h-4 w-4 text-primary" />}
                label="Total Index"
                value={stats?.total_logs.toLocaleString() ?? "0"}
                subValue="Records in context"
              />
              <StatCard
                icon={<Layers className="h-4 w-4 text-accent-violet" />}
                label="Patterns"
                value={stats?.total_clusters.toLocaleString() ?? "0"}
                subValue="Drain3 Templates"
              />
              <StatCard
                icon={<Activity className="h-4 w-4 text-primary" />}
                label="Live Streams"
                value={stats?.active_tailers.toString() ?? "0"}
                subValue="Active ingestion"
              />
              <StatCard
                icon={<Database className="h-4 w-4 text-info" />}
                label="Catalogs"
                value={stats?.workspace_count.toString() ?? "0"}
                subValue="Active workspaces"
              />
              <StatCard
                icon={<TrendingUp className="h-4 w-4 text-primary-green" />}
                label="Drift"
                value={stats?.new_patterns_count.toString() ?? "0"}
                subValue="New Patterns"
                trend={stats?.new_patterns_count && stats.new_patterns_count > 0 ? "up" : "stable"}
              />
            </div>

            {/* Main Charts Row */}
            {renderMainCharts()}

            {/* Patterns Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Critical Clusters */}
              <section className="bg-bg-surface/50 border border-border rounded-xl p-6 backdrop-blur-sm relative overflow-hidden">
                <div className="flex items-center gap-2 mb-6">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted">
                    Top Error Clusters
                  </h2>
                </div>
                <div className="space-y-2 relative z-10">
                  {stats && stats.top_error_clusters.length > 0 ? (
                    stats.top_error_clusters.map((c) => (
                      <ClusterRow
                        key={c.template}
                        index={stats.top_error_clusters.indexOf(c)}
                        template={c.template}
                        count={c.count}
                        total={stats.total_logs}
                        type="error"
                      />
                    ))
                  ) : (
                    <div className="py-20 text-center text-[10px] font-mono text-text-muted uppercase tracking-widest">
                      No Errors Detected
                    </div>
                  )}
                </div>
              </section>

              {/* General Clusters */}
              <section className="bg-bg-surface/50 border border-border rounded-xl p-6 backdrop-blur-sm relative overflow-hidden">
                <div className="flex items-center gap-2 mb-6">
                  <AlertCircle className="h-4 w-4 text-violet-400" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted">
                    Top Noise Generators
                  </h2>
                </div>
                <div className="space-y-2 relative z-10">
                  {stats && stats.top_clusters.length > 0 ? (
                    stats.top_clusters.map((c) => (
                      <ClusterRow
                        key={c.template}
                        index={stats.top_clusters.indexOf(c)}
                        template={c.template}
                        count={c.count}
                        total={stats.total_logs}
                        type="noise"
                      />
                    ))
                  ) : (
                    <div className="py-20 text-center text-[10px] font-mono text-text-muted uppercase tracking-widest">
                      No Clusters
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Source Heatmap Row */}
            <section className="bg-bg-surface/50 border border-border rounded-xl p-6 backdrop-blur-sm relative overflow-hidden">
              <div className="flex items-center gap-2 mb-6">
                <Activity className="h-4 w-4 text-primary" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted">
                  Source Activity Heatmap
                </h2>
              </div>

              {renderSourceHeatmap()}
              <Activity className="absolute -bottom-4 -right-4 size-32 text-text-muted/5 opacity-5 pointer-events-none" />
            </section>
          </motion.div>
        ) : (
          <motion.div
            key="ai"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex flex-col items-center justify-center py-20 bg-bg-surface/20 rounded-3xl border border-dashed border-border/50"
          >
            <div className="size-20 bg-primary-green/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
              <Sparkles className="size-10 text-primary-green" />
            </div>
            <h3 className="text-lg font-bold text-text-base mb-2 font-mono uppercase">
              AI Insight Engine
            </h3>
            <p className="text-text-muted text-sm max-w-md text-center px-6 font-mono leading-relaxed">
              Heuristic engine is warming up. This mode will automatically identify anomalous
              patterns and root cause correlations in the current filter window.
            </p>
            <div className="mt-8 flex gap-3">
              <div className="px-4 py-2 bg-bg-base border border-border rounded-lg text-[10px] font-bold text-text-muted uppercase tracking-widest">
                Anomaly Detection: STANDBY
              </div>
              <div className="px-4 py-2 bg-bg-base border border-border rounded-lg text-[10px] font-bold text-text-muted uppercase tracking-widest">
                Root Cause: OFFLINE
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DashboardModeToggle mode={mode} onModeChange={setMode} />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  subValue,
  trend,
}: Readonly<{
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue: string;
  trend?: "up" | "down" | "stable";
}>) {
  let trendColor = "text-text-muted opacity-40";
  if (trend === "up") {
    trendColor = "text-red-400";
  } else if (trend === "down") {
    trendColor = "text-green-400";
  }
  let trendSymbol = "•";
  if (trend === "up") {
    trendSymbol = "↑";
  } else if (trend === "down") {
    trendSymbol = "↓";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-bg-surface/40 border border-white/5 rounded-xl p-4 relative overflow-hidden group hover:border-primary/20 transition-all hover:bg-bg-surface/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
            {label}
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl font-mono font-bold text-text-primary tracking-tight">
              {value}
            </h3>
            {trend && (
              <span className={cn("text-[10px] font-bold", trendColor)}>{trendSymbol}</span>
            )}
          </div>
          <p className="text-[9px] text-text-muted mt-1 font-medium opacity-60 group-hover:opacity-100 transition-opacity uppercase tracking-tighter">
            {subValue}
          </p>
        </div>
        <div className="p-2 rounded-lg bg-bg-base/50 border border-white/5 group-hover:border-primary/10 transition-colors">
          {icon}
        </div>
      </div>

      {/* Subtle accent line */}
      <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-primary group-hover:w-full transition-all duration-500 opacity-30" />
    </motion.div>
  );
}

function LevelBar({
  level,
  count,
  total,
}: Readonly<{ level: string; count: number; total: number }>) {
  const colors: Record<string, string> = {
    ERROR: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]",
    WARN: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]",
    INFO: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]",
    DEBUG: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]",
    FATAL: "bg-red-700 shadow-[0_0_8px_rgba(185,28,28,0.3)]",
    CRITICAL: "bg-purple-600 shadow-[0_0_8px_rgba(147,51,234,0.3)]",
  };

  const pct = total > 0 ? (count / total) * 100 : 0;
  const color = colors[level.toUpperCase()] || "bg-zinc-500";

  return (
    <div className="group">
      <div className="flex justify-between items-end mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-tight text-text-base group-hover:text-primary-green transition-colors">
          {level}
        </span>
        <span className="text-[10px] font-mono text-text-muted bg-bg-base/50 px-1.5 py-0.5 rounded border border-border/30">
          {count.toLocaleString()}
        </span>
      </div>
      <div className="h-2 bg-bg-elevated rounded-full overflow-hidden border border-white/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full ${color} rounded-full`}
        />
      </div>
    </div>
  );
}

function ClusterRow({
  index,
  template,
  count,
  total,
  type,
}: Readonly<{
  index: number;
  template: string;
  count: number;
  total: number;
  type: "error" | "noise";
}>) {
  const barColor = type === "error" ? "bg-red-500" : "bg-violet-500";
  const glow =
    type === "error"
      ? "shadow-[0_0_8px_rgba(239,68,68,0.3)]"
      : "shadow-[0_0_8px_rgba(139,92,246,0.3)]";

  return (
    <div className="group flex items-start gap-4 p-3 rounded-lg hover:bg-bg-elevated transition-all border border-transparent hover:border-border/50 bg-bg-base/30">
      <span className="text-[10px] font-mono text-text-muted py-1 w-6">#{index + 1}</span>
      <div className="flex-1 overflow-hidden">
        <p
          className={cn(
            "text-[11px] font-mono text-text-base truncate mb-1.5 leading-relaxed group-hover:text-primary-green transition-colors",
            type === "error" && "text-red-400/90",
          )}
        >
          {template}
        </p>
        <div className="flex items-center gap-3">
          <div className="h-1 bg-white/5 rounded-full flex-1 overflow-hidden border border-white/5">
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
    </div>
  );
}
