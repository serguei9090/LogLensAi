import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Database,
  Layers,
  RefreshCcw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { A2UIRenderer } from "@/components/atoms/A2UIRenderer";
// Atomic/Molecule Imports
import { StatCard } from "@/components/atoms/StatCard";
import { ClusterRow } from "@/components/molecules/ClusterRow";
import {
  type DashboardMode,
  DashboardModeToggle,
} from "@/components/molecules/DashboardModeToggle";
import { type TimeRange, TimeRangePicker } from "@/components/molecules/TimeRangePicker";
import { AIInvestigationSidebar } from "@/components/organisms/AIInvestigationSidebar";
import { DashboardCharts } from "@/components/organisms/DashboardCharts";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { cn } from "@/lib/utils";
// AI Mode Imports
import { useAiStore } from "@/store/aiStore";
import { useIngestionStore } from "@/store/ingestionStore";
import { selectActiveWorkspace, useWorkspaceStore } from "@/store/workspaceStore";

interface DashboardStats {
  total_logs: number;
  total_clusters: number;
  level_counts: Record<string, number>;
  top_clusters: { template: string; count: number }[];
  top_error_clusters: { template: string; count: number }[];
  time_series: any[];
  source_heatmap: {
    timestamp: string;
    source_id: string;
    source_name: string;
    count: number;
  }[];
  latest_ai_insight: string | null;
  new_patterns_count: number;
  workspace_count: number;
  active_tailers: number;
  bucket_interval?: string;
  time_bounds?: { min: string; max: string };
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
        <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-1 font-mono uppercase italic flex items-center gap-3">
          {title}
          {mode === "ai" && <Sparkles className="size-6 text-primary" />}
        </h1>
        <p className="text-text-muted text-sm">{description}</p>
      </div>
      <Button
        variant="outline"
        size="icon"
        onClick={onRefresh}
        title="Refresh Data"
        className="text-text-muted hover:text-primary"
      >
        <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
      </Button>
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
  timeBounds,
  onResetTime,
}: Readonly<{
  selectedWorkspaceId: string;
  onWorkspaceChange: (v: string) => void;
  workspaces: any[];
  selectedSourceId: string;
  onSourceChange: (v: string) => void;
  sources: any[];
  timeRange: TimeRange;
  onTimeRangeChange: (tr: TimeRange) => void;
  timeBounds: { min: string; max: string } | null;
  onResetTime: () => void;
}>) {
  const selectedWorkspace = workspaces.find((w) => w.id === selectedWorkspaceId);
  const selectedSource = sources.find((s) => s.id === selectedSourceId);

  const isFiltered =
    timeBounds &&
    ((timeRange.start && timeRange.start !== timeBounds.min) ||
      (timeRange.end && timeRange.end !== timeBounds.max));

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
        {isFiltered && (
          <button
            type="button"
            onClick={onResetTime}
            className="text-[10px] h-7 px-2 border border-primary/20 bg-primary/5 text-primary hover:bg-primary hover:text-text-inverse transition-all rounded font-semibold cursor-pointer"
          >
            All Time
          </button>
        )}
        <TimeRangePicker
          value={timeRange}
          onChange={onTimeRangeChange}
          className="h-8 scale-90 origin-left"
        />
      </div>
    </div>
  );
}

function ProcessingHUD({ jobs }: Readonly<{ jobs: any[] }>) {
  const activeJobs = jobs.filter((j) => j.status === "processing" || j.status === "pending");
  if (activeJobs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <RefreshCcw className="size-3 text-primary animate-spin" />
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
              <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded uppercase font-bold">
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
              className="h-full bg-primary shadow-[0_0_10px_var(--primary-glow)]"
              initial={{ width: 0 }}
              animate={{
                width: `${(job.processed_lines / job.total_lines) * 100}%`,
              }}
              transition={{ type: "spring", stiffness: 50 }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function SourceHeatmap({ stats }: Readonly<{ stats: DashboardStats | null }>) {
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
                      className="h-full flex-1 rounded-sm border border-white/5 transition-[transform,background-color] duration-200 hover:scale-115"
                      style={{
                        backgroundColor: `color-mix(in srgb, var(--primary) ${intensity * 100}%, transparent)`,
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
}

function useDashboardData(workspaces: any[], activeWorkspace: any) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [timeBounds, setTimeBounds] = useState<{ min: string; max: string } | null>(null);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  // Filter State
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("all");
  const [selectedSourceId, setSelectedSourceId] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<TimeRange>({ start: "", end: "" });

  // Sync selectedWorkspaceId with activeWorkspace on initial load or deletion fallback
  useEffect(() => {
    const exists = workspaces.some((w) => w.id === selectedWorkspaceId);
    const shouldSync = selectedWorkspaceId === "all" || !exists;
    if (shouldSync) {
      const fallbackId = activeWorkspace?.id ?? workspaces[0]?.id ?? "all";
      if (selectedWorkspaceId !== fallbackId) {
        setSelectedWorkspaceId(fallbackId);
      }
    }
  }, [activeWorkspace, workspaces, selectedWorkspaceId]);

  // Reset selected source to "all" when workspace changes
  useEffect(() => {
    if (selectedWorkspaceId) {
      setSelectedSourceId("all");
    }
  }, [selectedWorkspaceId]);

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
      // Auto-initialize time range from data bounds on first load
      if (res?.time_bounds?.min && res.time_bounds.max) {
        const bounds = { min: res.time_bounds.min, max: res.time_bounds.max };
        setTimeBounds(bounds);
        if (isFirstLoad) {
          setTimeRange({ start: bounds.min, end: bounds.max, label: "All Time" });
          setIsFirstLoad(false);
        }
      }
    } catch (e) {
      console.error("Failed to fetch dashboard stats", e);
    } finally {
      setLoading(false);
    }
  }, [selectedWorkspaceId, selectedSourceId, timeRange, workspaces, isFirstLoad]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    loading,
    stats,
    timeBounds,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    selectedSourceId,
    setSelectedSourceId,
    timeRange,
    setTimeRange,
    setIsFirstLoad,
    fetchStats,
  };
}

function DashboardLoadingView({ mode }: { readonly mode: DashboardMode }) {
  const loadingText = mode === "static" ? "Loading Analytics..." : "Scanning for AI Insights...";
  return (
    <div className="flex-1 flex items-center justify-center bg-bg-base">
      <div className="flex flex-col items-center gap-4">
        <RefreshCcw className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-text-muted font-mono uppercase tracking-widest">{loadingText}</p>
      </div>
    </div>
  );
}

function AIObservationCard({
  stats,
  setMode,
}: {
  readonly stats: DashboardStats;
  readonly setMode: (mode: DashboardMode) => void;
}) {
  if (!stats.latest_ai_insight) {
    return null;
  }
  return (
    <motion.section
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-primary/5 border border-primary/20 rounded-2xl p-6 backdrop-blur-md relative overflow-hidden group"
    >
      <div className="flex items-start justify-between gap-6 relative z-10">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="size-4 text-primary animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
              Latest AI Observation
            </span>
          </div>
          <p className="text-sm font-mono text-text-primary leading-relaxed italic">
            &quot;{stats.latest_ai_insight}&quot;
          </p>
        </div>
        <Button
          onClick={() => setMode("ai")}
          className="shrink-0 text-[10px] uppercase tracking-widest shadow-[0_0_15px_var(--primary-glow)] hover:scale-105"
        >
          Deep Dive
        </Button>
      </div>
      <div className="absolute -top-20 -right-20 size-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
    </motion.section>
  );
}

interface ClustersSectionProps {
  readonly stats: DashboardStats | null;
  readonly selectedWorkspaceId: string;
}

function ErrorClustersSection({ stats, selectedWorkspaceId }: ClustersSectionProps) {
  const hasErrors = stats && stats.top_error_clusters.length > 0;
  return (
    <section className="bg-bg-surface/50 border border-border rounded-xl p-6 backdrop-blur-sm relative overflow-hidden">
      <div className="flex items-center gap-2 mb-6">
        <AlertTriangle className="h-4 w-4 text-error" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted">
          Top Error Clusters
        </h2>
      </div>
      <div className="space-y-2 relative z-10">
        {hasErrors ? (
          stats.top_error_clusters.map((c, idx) => (
            <ClusterRow
              key={c.template}
              index={idx}
              template={c.template}
              count={c.count}
              total={stats.total_logs}
              type="error"
              clusterId={(c as any).cluster_id}
              workspaceId={selectedWorkspaceId}
            />
          ))
        ) : (
          <div className="py-20 text-center text-[10px] font-mono text-text-muted uppercase tracking-widest">
            No Errors Detected
          </div>
        )}
      </div>
    </section>
  );
}

function NoiseClustersSection({ stats, selectedWorkspaceId }: ClustersSectionProps) {
  const hasClusters = stats && stats.top_clusters.length > 0;
  return (
    <section className="bg-bg-surface/50 border border-border rounded-xl p-6 backdrop-blur-sm relative overflow-hidden">
      <div className="flex items-center gap-2 mb-6">
        <AlertCircle className="h-4 w-4 text-debug" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted">
          Top Noise Generators
        </h2>
      </div>
      <div className="space-y-2 relative z-10">
        {hasClusters ? (
          stats.top_clusters.map((c, idx) => (
            <ClusterRow
              key={c.template}
              index={idx}
              template={c.template}
              count={c.count}
              total={stats.total_logs}
              type="noise"
              clusterId={(c as any).cluster_id}
              workspaceId={selectedWorkspaceId}
            />
          ))
        ) : (
          <div className="py-20 text-center text-[10px] font-mono text-text-muted uppercase tracking-widest">
            No Clusters
          </div>
        )}
      </div>
    </section>
  );
}

interface AICanvasViewProps {
  readonly dashboardWidgets: any[];
  readonly isSidebarOpen: boolean;
  readonly setSidebarOpen: (open: boolean) => void;
}

function AICanvasView({ dashboardWidgets, isSidebarOpen, setSidebarOpen }: AICanvasViewProps) {
  const isEmpty = dashboardWidgets.length === 0;
  return (
    <div className="flex h-full w-full gap-4">
      {/* The Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold font-mono tracking-tight flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            AI Dashboard Canvas
          </h2>
          {!isSidebarOpen && (
            <Button variant="outline" size="sm" onClick={() => setSidebarOpen(true)}>
              Open Chat
            </Button>
          )}
        </div>

        {isEmpty ? (
          <div className="flex-1 flex items-center justify-center border border-dashed border-border/60 rounded-xl bg-bg-surface/20 min-h-[400px]">
            <p className="text-sm text-text-muted text-center max-w-sm">
              No widgets pinned yet. Ask the AI to create a dashboard card.
              <br />
              <br />
              Try asking: "Create a metric for ERROR logs"
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-max overflow-y-auto custom-scrollbar pr-2 pb-20">
            {dashboardWidgets.map((widget, i) => {
              const widgetKey = widget.raw || `widget-${i}`;
              return <A2UIRenderer key={widgetKey} payload={widget} />;
            })}
          </div>
        )}
      </div>

      {/* The Chatbox Sidebar */}
      {isSidebarOpen && (
        <div className="w-[450px] shrink-0 border border-border/50 rounded-xl overflow-hidden bg-bg-base/80 backdrop-blur shadow-2xl flex flex-col h-[calc(100vh-150px)]">
          <AIInvestigationSidebar onEngineSettingsOpen={() => {}} />
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  // Global State
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const activeWorkspace = useWorkspaceStore(selectActiveWorkspace);
  const { dashboardWidgets, isSidebarOpen, setSidebarOpen } = useAiStore();
  // Consume shared ingestion store — no independent polling
  const ingestionJobs = useIngestionStore((state) => state.jobs);
  const [mode, setMode] = useState<DashboardMode>("static");

  const {
    loading,
    stats,
    timeBounds,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    selectedSourceId,
    setSelectedSourceId,
    timeRange,
    setTimeRange,
    setIsFirstLoad,
    fetchStats,
  } = useDashboardData(workspaces, activeWorkspace);

  // Handle Mode Change with Sidebar auto-open
  const handleModeChange = (newMode: DashboardMode) => {
    setMode(newMode);
    if (newMode === "ai") {
      setSidebarOpen(true);
    }
  };

  // Derived Options
  const currentWorkspace = useMemo(
    () => workspaces.find((w) => w.id === selectedWorkspaceId),
    [workspaces, selectedWorkspaceId],
  );

  const sources = useMemo(() => currentWorkspace?.sources || [], [currentWorkspace]);

  if (loading && !stats) {
    return <DashboardLoadingView mode={mode} />;
  }

  return (
    <div className="flex-1 bg-bg-base overflow-y-auto p-8 custom-scrollbar pb-48">
      <div
        className={cn(
          "mx-auto flex flex-col h-full transition-all duration-300",
          mode === "ai" ? "max-w-full px-6" : "max-w-6xl w-full",
        )}
      >
        <header className="mb-10">
          <DashboardHeader mode={mode} loading={loading} onRefresh={fetchStats} />
          <DashboardFilters
            selectedWorkspaceId={selectedWorkspaceId}
            onWorkspaceChange={(v) => {
              setSelectedWorkspaceId(v || "all");
              setSelectedSourceId("all");
              setIsFirstLoad(true); // Re-auto-init when workspace changes
            }}
            workspaces={workspaces}
            selectedSourceId={selectedSourceId}
            onSourceChange={(v) => setSelectedSourceId(v || "all")}
            sources={sources}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            timeBounds={timeBounds}
            onResetTime={() => {
              if (timeBounds) {
                setTimeRange({ start: timeBounds.min, end: timeBounds.max, label: "All Time" });
              } else {
                setTimeRange({ start: "", end: "" });
              }
            }}
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
              <ProcessingHUD jobs={ingestionJobs} />

              {/* AI Insight Snippet */}
              {stats && <AIObservationCard stats={stats} setMode={setMode} />}

              {/* Stat Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard
                  icon={<Database className="h-4 w-4 text-primary" />}
                  label="Total Index"
                  value={stats?.total_logs.toLocaleString() ?? "0"}
                  subValue="Records in context"
                />
                <StatCard
                  icon={<Layers className="h-4 w-4 text-debug" />}
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
                  icon={<TrendingUp className="h-4 w-4 text-primary" />}
                  label="Drift"
                  value={stats?.new_patterns_count.toString() ?? "0"}
                  subValue="New Patterns"
                  trend={
                    stats?.new_patterns_count && stats.new_patterns_count > 0 ? "up" : "stable"
                  }
                />
              </div>

              {/* Main Charts Row */}
              <DashboardCharts
                stats={stats}
                bucketInterval={stats?.bucket_interval}
                timeBounds={timeBounds ?? undefined}
                timeRange={timeRange}
                onZoom={(start, end) => setTimeRange({ start, end, label: "Zoomed Range" })}
                onReset={() => {
                  if (timeBounds) {
                    setTimeRange({ start: timeBounds.min, end: timeBounds.max, label: "All Time" });
                  } else {
                    setTimeRange({ start: "", end: "" });
                  }
                }}
              />

              {/* Patterns Row (Stacked) */}
              <div className="flex flex-col gap-8">
                <ErrorClustersSection stats={stats} selectedWorkspaceId={selectedWorkspaceId} />
                <NoiseClustersSection stats={stats} selectedWorkspaceId={selectedWorkspaceId} />
              </div>

              {/* Source Heatmap Row */}
              <section className="bg-bg-surface/50 border border-border rounded-xl p-6 backdrop-blur-sm relative overflow-hidden">
                <div className="flex items-center gap-2 mb-6">
                  <Activity className="h-4 w-4 text-primary" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted">
                    Source Activity Heatmap
                  </h2>
                </div>

                <SourceHeatmap stats={stats} />
                <Activity className="absolute -bottom-4 -right-4 size-32 text-text-muted/5 opacity-5 pointer-events-none" />
              </section>
              {/* Permanent spacer to prevent floating mode button overlap */}
              <div className="h-20" />
            </motion.div>
          ) : (
            <motion.div
              key="ai"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex h-full w-full gap-4"
            >
              <AICanvasView
                dashboardWidgets={dashboardWidgets}
                isSidebarOpen={isSidebarOpen}
                setSidebarOpen={setSidebarOpen}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <DashboardModeToggle mode={mode} onModeChange={handleModeChange} />
      </div>
    </div>
  );
}
