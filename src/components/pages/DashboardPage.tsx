import { DashboardModeToggle, type DashboardMode } from "@/components/molecules/DashboardModeToggle";
import { TimeRangePicker, type TimeRange } from "@/components/molecules/TimeRangePicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { selectActiveWorkspace, useWorkspaceStore } from "@/store/workspaceStore";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, AlertCircle, BarChart3, Cpu, Database, Layers, RefreshCcw, Sparkles } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState, useMemo } from "react";

interface DashboardStats {
  total_logs: number;
  total_clusters: number;
  level_counts: Record<string, number>;
  top_clusters: { template: string; count: number }[];
  workspace_count: number;
  active_tailers: number;
}

export default function DashboardPage() {
  // Global State
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const activeWorkspace = useWorkspaceStore(selectActiveWorkspace);
  
  // Local State
  const [stats, setStats] = useState<DashboardStats | null>(null);
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
          active_workspace_ids: workspaces.map(w => w.id),
        },
      });
      setStats(res);
    } catch (e) {
      console.error("Failed to fetch dashboard stats", e);
    } finally {
      setLoading(false);
    }
  }, [selectedWorkspaceId, selectedSourceId, timeRange]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Derived Options
  const currentWorkspace = useMemo(() => 
    workspaces.find(w => w.id === selectedWorkspaceId),
    [workspaces, selectedWorkspaceId]
  );

  const sources = useMemo(() => 
    currentWorkspace?.sources || [],
    [currentWorkspace]
  );

  if (loading && !stats) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-base">
        <div className="flex flex-col items-center gap-4">
          <RefreshCcw className="h-8 w-8 text-primary-green animate-spin" />
          <p className="text-sm text-text-muted font-mono uppercase tracking-widest">
            {mode === "static" ? "Loading Analytics..." : "Scanning for AI Insights..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-bg-base overflow-y-auto p-8 custom-scrollbar pb-32">
      <header className="mb-10">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-text-base mb-1 font-mono uppercase italic flex items-center gap-3">
              {mode === "static" ? "Dashboard" : "AI Insights"}
              {mode === "ai" && <Sparkles className="size-6 text-primary-green" />}
            </h1>
            <p className="text-text-muted text-sm">
              {mode === "static" 
                ? "High-velocity log analytics and system health overview." 
                : "Heuristic pattern analysis and anomaly detection."}
            </p>
          </div>
          <button
            type="button"
            onClick={fetchStats}
            className="p-2 rounded-lg bg-bg-surface border border-border hover:bg-bg-elevated transition-colors text-text-muted hover:text-primary-green"
            title="Refresh Data"
          >
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-3 bg-bg-surface/30 p-2 rounded-xl border border-border/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-2">Context:</span>
            
            <Select value={selectedWorkspaceId} onValueChange={(v) => {
              setSelectedWorkspaceId(v);
              setSelectedSourceId("all"); // Reset source when workspace changes
            }}>
              <SelectTrigger className="w-[180px] h-8 text-[11px] bg-bg-base/40 border-white/5 hover:border-white/10 transition-all font-medium">
                <SelectValue placeholder="Select Workspace">
                  {workspaces.find(w => w.id === selectedWorkspaceId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {workspaces.map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={selectedSourceId} 
              onValueChange={setSelectedSourceId}
              disabled={selectedWorkspaceId === "all"}
            >
              <SelectTrigger className="w-[180px] h-8 text-[11px] bg-bg-base/40 border-white/5 hover:border-white/10 transition-all font-medium">
                <SelectValue placeholder="Log Source">
                  {selectedSourceId === "all" ? "Entire Workspace" : sources.find(s => s.id === selectedSourceId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Entire Workspace</SelectItem>
                {sources.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="h-4 w-px bg-border/50 mx-1" />

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Time:</span>
            <TimeRangePicker 
              value={timeRange} 
              onChange={setTimeRange} 
              className="h-8 scale-90 origin-left"
            />
          </div>
        </div>
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
            {/* Grid Layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                subValue="Active workspace"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Level Breakdown */}
              <section className="lg:col-span-1 bg-bg-surface/50 border border-border rounded-xl p-6 backdrop-blur-sm relative overflow-hidden">
                <div className="flex items-center gap-2 mb-6">
                  <BarChart3 className="h-4 w-4 text-primary-green" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted">
                    Severity Distribution
                  </h2>
                </div>
                <div className="space-y-4 relative z-10">
                  {stats && Object.keys(stats.level_counts).length > 0 ? (
                    Object.entries(stats.level_counts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([level, count]) => (
                        <LevelBar key={level} level={level} count={count} total={stats.total_logs} />
                      ))
                  ) : (
                    <div className="py-10 text-center text-[10px] font-mono text-text-muted uppercase tracking-widest">
                      No Data in Window
                    </div>
                  )}
                </div>
                {/* Subtle Background Icon */}
                <BarChart3 className="absolute -bottom-4 -right-4 size-32 text-text-muted/5 opacity-5 pointer-events-none" />
              </section>

              {/* Top Clusters */}
              <section className="lg:col-span-2 bg-bg-surface/50 border border-border rounded-xl p-6 backdrop-blur-sm relative overflow-hidden">
                <div className="flex items-center gap-2 mb-6">
                  <AlertCircle className="h-4 w-4 text-violet-400" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted">
                    Top 10 Noise Generators
                  </h2>
                </div>
                <div className="space-y-2 relative z-10">
                  {stats && stats.top_clusters.length > 0 ? (
                    stats.top_clusters.map((c, i) => (
                      <div
                        key={i}
                        className="group flex items-start gap-4 p-3 rounded-lg hover:bg-bg-elevated transition-all border border-transparent hover:border-border/50 bg-bg-base/30"
                      >
                        <span className="text-[10px] font-mono text-text-muted py-1 w-6">#{i + 1}</span>
                        <div className="flex-1 overflow-hidden">
                          <p className="text-[11px] font-mono text-text-base truncate mb-1.5 leading-relaxed group-hover:text-primary-green transition-colors">
                            {c.template}
                          </p>
                          <div className="flex items-center gap-3">
                            <div className="h-1 bg-violet-500/10 rounded-full flex-1 overflow-hidden border border-white/5">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(c.count / stats.total_logs) * 100}%` }}
                                className="h-full bg-violet-500 rounded-full shadow-[0_0_8px_rgba(139,92,246,0.3)]"
                              />
                            </div>
                            <span className="text-[10px] font-mono text-text-muted shrink-0 w-16 text-right">
                              {c.count.toLocaleString()} hits
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-20 text-center text-[10px] font-mono text-text-muted uppercase tracking-widest">
                      No Clusters Detected
                    </div>
                  )}
                </div>
                <AlertCircle className="absolute -bottom-4 -right-4 size-32 text-text-muted/5 opacity-5 pointer-events-none" />
              </section>
            </div>
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
            <h3 className="text-lg font-bold text-text-base mb-2 font-mono uppercase">AI Insight Engine</h3>
            <p className="text-text-muted text-sm max-w-md text-center px-6 font-mono leading-relaxed">
              Heuristic engine is warming up. This mode will automatically identify anomalous patterns and root cause correlations in the current filter window.
            </p>
            <div className="mt-8 flex gap-3">
              <div className="px-4 py-2 bg-bg-base border border-border rounded-lg text-[10px] font-bold text-text-muted uppercase tracking-widest">Anomaly Detection: STANDBY</div>
              <div className="px-4 py-2 bg-bg-base border border-border rounded-lg text-[10px] font-bold text-text-muted uppercase tracking-widest">Root Cause: OFFLINE</div>
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
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-bg-surface/40 border border-white/5 rounded-xl p-4 relative overflow-hidden group hover:border-primary/20 transition-all hover:bg-bg-surface/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">{label}</p>
          <h3 className="text-xl font-mono font-bold text-text-primary tracking-tight">{value}</h3>
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

function LevelBar({ level, count, total }: { level: string; count: number; total: number }) {
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
