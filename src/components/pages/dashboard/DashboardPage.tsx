// Assume Role: Frontend Engineer (@frontend)

import { Activity, Database, Layers, TrendingUp } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { StatCard } from "@/components/atoms/StatCard";
import type { DashboardMode } from "@/components/molecules/DashboardModeToggle";
import { useInView } from "@/lib/hooks/useInView";
import { cn } from "@/lib/utils";
import { selectActiveWorkspace, useWorkspaceStore } from "@/store/workspaceStore";
import { AIInsightsStudio } from "./components/AIInsightsStudio";
import { AIObservationCard } from "./components/AIObservationCard";
import { ErrorClustersSection, NoiseClustersSection } from "./components/ClustersSections";
import { DashboardFilters } from "./components/DashboardFilters";
import { DashboardHeader } from "./components/DashboardHeader";
import { SourceHeatmap } from "./components/SourceHeatmap";
import { useDashboardData } from "./hooks/useDashboardData";

const DashboardCharts = lazy(() =>
  import("@/components/organisms/DashboardCharts").then((m) => ({ default: m.DashboardCharts })),
);

export function DashboardPage() {
  const [patternsRef, patternsInView] = useInView<HTMLDivElement>({
    rootMargin: "200px",
    triggerOnce: true,
  });
  const [heatmapRef, heatmapInView] = useInView<HTMLElement>({
    rootMargin: "200px",
    triggerOnce: true,
  });

  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const activeWorkspace = useWorkspaceStore(selectActiveWorkspace);
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

  const handleModeChange = (newMode: DashboardMode) => {
    setMode(newMode);
  };

  const currentWorkspace = useMemo(
    () => workspaces.find((w) => w.id === selectedWorkspaceId),
    [workspaces, selectedWorkspaceId],
  );

  const sources = useMemo(() => currentWorkspace?.sources || [], [currentWorkspace]);

  return (
    <div className="flex-1 bg-bg-base relative flex flex-col h-full overflow-hidden">
      <div
        className={cn(
          "flex-1 custom-scrollbar",
          mode === "ai" ? "flex flex-col p-6 overflow-hidden min-h-0" : "overflow-y-auto p-8 pb-48",
        )}
      >
        <div
          className={cn(
            "mx-auto flex flex-col h-full transition-[max-width] duration-300",
            mode === "ai" ? "max-w-full w-full min-h-0 flex-1" : "max-w-6xl w-full",
          )}
        >
          <header className={cn(mode === "ai" ? "mb-4 shrink-0" : "mb-10")}>
            <DashboardHeader
              mode={mode}
              loading={loading}
              onRefresh={fetchStats}
              onModeChange={handleModeChange}
            />
            <DashboardFilters
              selectedWorkspaceId={selectedWorkspaceId}
              onWorkspaceChange={(v) => {
                setSelectedWorkspaceId(v || "all");
                setSelectedSourceId("all");
                setIsFirstLoad(true);
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
              loading={loading}
              onRefresh={fetchStats}
            />
          </header>

          {mode === "static" ? (
            <div key="static" className="space-y-10 animate-fade-in-up">
              {/* AI Insight Snippet */}
              {stats && <AIObservationCard stats={stats} setMode={setMode} />}

              {/* Stat Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard
                  icon={<Database className="h-4 w-4 text-primary" />}
                  label="Total Index"
                  value={stats?.total_logs.toLocaleString() ?? "0"}
                  subValue="Records in context"
                  loading={!stats}
                />
                <StatCard
                  icon={<Layers className="h-4 w-4 text-debug" />}
                  label="Patterns"
                  value={stats?.total_clusters.toLocaleString() ?? "0"}
                  subValue="Drain3 Templates"
                  loading={!stats}
                />
                <StatCard
                  icon={<Activity className="h-4 w-4 text-primary" />}
                  label="Live Streams"
                  value={stats?.active_tailers.toString() ?? "0"}
                  subValue="Active ingestion"
                  loading={!stats}
                />
                <StatCard
                  icon={<Database className="h-4 w-4 text-info" />}
                  label="Catalogs"
                  value={stats?.workspace_count.toString() ?? "0"}
                  subValue="Active workspaces"
                  loading={!stats}
                />
                <StatCard
                  icon={<TrendingUp className="h-4 w-4 text-primary" />}
                  label="Drift"
                  value={stats?.new_patterns_count.toString() ?? "0"}
                  subValue="New Patterns"
                  trend={
                    stats?.new_patterns_count && stats.new_patterns_count > 0 ? "up" : "stable"
                  }
                  loading={!stats}
                />
              </div>

              {/* Main Charts Row */}
              <Suspense
                fallback={
                  <div className="w-full bg-bg-surface/50 border border-border rounded-xl p-6 h-[340px] flex items-center justify-center text-xs text-text-muted animate-pulse">
                    Synchronizing severity charts...
                  </div>
                }
              >
                <DashboardCharts
                  stats={stats}
                  bucketInterval={stats?.bucket_interval}
                  timeBounds={timeBounds ?? undefined}
                  timeRange={timeRange}
                  onZoom={(start, end) => setTimeRange({ start, end, label: "Zoomed Range" })}
                  onReset={() => {
                    if (timeBounds) {
                      setTimeRange({
                        start: timeBounds.min,
                        end: timeBounds.max,
                        label: "All Time",
                      });
                    } else {
                      setTimeRange({ start: "", end: "" });
                    }
                  }}
                />
              </Suspense>

              {/* Patterns Row */}
              <div ref={patternsRef} className="flex flex-col gap-8 min-h-[300px]">
                {patternsInView ? (
                  <>
                    <ErrorClustersSection stats={stats} selectedWorkspaceId={selectedWorkspaceId} />
                    <NoiseClustersSection stats={stats} selectedWorkspaceId={selectedWorkspaceId} />
                  </>
                ) : (
                  <div className="h-[300px] w-full bg-bg-surface/20 rounded-xl animate-pulse" />
                )}
              </div>

              {/* Source Heatmap Row */}
              <section
                ref={heatmapRef}
                className="bg-bg-surface/50 border border-border rounded-xl p-6 backdrop-blur-sm relative overflow-hidden min-h-[180px]"
              >
                <div className="flex items-center gap-2 mb-6">
                  <Activity className="h-4 w-4 text-primary" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted">
                    Source Activity Heatmap
                  </h2>
                </div>

                {heatmapInView ? (
                  <SourceHeatmap stats={stats} />
                ) : (
                  <div className="h-[80px] w-full bg-bg-surface/20 rounded animate-pulse" />
                )}
                <Activity className="absolute -bottom-4 -right-4 size-32 text-text-muted/5 opacity-5 pointer-events-none" />
              </section>
            </div>
          ) : (
            <div key="ai" className="flex flex-1 min-h-[600px] h-full w-full animate-fade-in-up">
              <AIInsightsStudio />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
