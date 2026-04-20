import { motion } from "framer-motion";
import { Activity, AlertCircle, BarChart3, Cpu, Database, Layers, RefreshCcw } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { useWorkspaceStore } from "@/store/workspaceStore";

interface DashboardStats {
  total_logs: number;
  total_clusters: number;
  level_counts: Record<string, number>;
  top_clusters: { template: string; count: number }[];
  workspace_count: number;
  active_tailers: number;
}

export default function DashboardPage() {
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await callSidecar<DashboardStats>({
        method: "get_dashboard_stats",
        params: { workspace_id: activeWorkspaceId || undefined },
      });
      setStats(res);
    } catch (e) {
      console.error("Failed to fetch dashboard stats", e);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading && !stats) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-base">
        <div className="flex flex-col items-center gap-4">
          <RefreshCcw className="h-8 w-8 text-primary-green animate-spin" />
          <p className="text-sm text-text-muted font-mono uppercase tracking-widest">
            Loading Analytics...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-bg-base overflow-y-auto p-8 custom-scrollbar">
      <header className="mb-10 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-base mb-2 font-mono uppercase italic">
            Dashboard
          </h1>
          <p className="text-text-muted text-sm">
            High-velocity log analytics and system health overview.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchStats}
          className="p-2 rounded-lg bg-bg-surface border border-border hover:bg-bg-elevated transition-colors text-text-muted hover:text-primary-green"
          title="Refresh Data"
        >
          <RefreshCcw className="h-4 w-4" />
        </button>
      </header>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard
          icon={<Database className="h-5 w-5 text-blue-400" />}
          label="Total Logs"
          value={stats?.total_logs.toLocaleString() ?? "0"}
          subValue={activeWorkspaceId ? "Current Workspace" : "Global Index"}
        />
        <StatCard
          icon={<Layers className="h-5 w-5 text-violet-400" />}
          label="Patterns"
          value={stats?.total_clusters.toLocaleString() ?? "0"}
          subValue="Drain3 Templates"
        />
        <StatCard
          icon={<Activity className="h-5 w-5 text-emerald-400" />}
          label="Active Streams"
          value={stats?.active_tailers.toString() ?? "0"}
          subValue="Live Ingestion"
        />
        <StatCard
          icon={<Cpu className="h-5 w-5 text-amber-400" />}
          label="Workspaces"
          value={stats?.workspace_count.toString() ?? "0"}
          subValue="Isolated Contexts"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Level Breakdown */}
        <section className="lg:col-span-1 bg-bg-surface/50 border border-border rounded-xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="h-4 w-4 text-primary-green" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted">
              Severity Distribution
            </h2>
          </div>
          <div className="space-y-4">
            {stats &&
              Object.entries(stats.level_counts).map(([level, count]) => (
                <LevelBar key={level} level={level} count={count} total={stats.total_logs} />
              ))}
          </div>
        </section>

        {/* Top Clusters */}
        <section className="lg:col-span-2 bg-bg-surface/50 border border-border rounded-xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-6">
            <AlertCircle className="h-4 w-4 text-violet-400" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted">
              Top Noise Generators
            </h2>
          </div>
          <div className="space-y-3">
            {stats?.top_clusters.map((c, i) => (
              <div
                key={i}
                className="group flex items-start gap-4 p-3 rounded-lg hover:bg-bg-elevated transition-all border border-transparent hover:border-border/50"
              >
                <span className="text-[10px] font-mono text-text-muted py-1">#{i + 1}</span>
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs font-mono text-text-base truncate mb-1">{c.template}</p>
                  <div className="flex items-center gap-2">
                    <div className="h-1 bg-violet-500/20 rounded-full flex-1 overflow-hidden">
                      <div
                        className="h-full bg-violet-500 rounded-full"
                        style={{ width: `${(c.count / stats.total_logs) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-text-muted shrink-0">
                      {c.count} hits
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-bg-surface/50 border border-border rounded-xl p-6 relative overflow-hidden group hover:border-primary-green/30 transition-colors"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 rounded-lg bg-bg-elevated border border-border group-hover:border-primary-green/20 transition-colors">
          {icon}
        </div>
      </div>
      <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-1">{label}</p>
      <h3 className="text-2xl font-mono font-bold text-text-base mb-1">{value}</h3>
      <p className="text-[10px] text-text-muted font-medium">{subValue}</p>
      <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-10 transition-opacity">
        {icon}
      </div>
    </motion.div>
  );
}

function LevelBar({ level, count, total }: { level: string; count: number; total: number }) {
  const colors: Record<string, string> = {
    ERROR: "bg-red-500",
    WARN: "bg-amber-500",
    INFO: "bg-emerald-500",
    DEBUG: "bg-blue-500",
    FATAL: "bg-red-700",
    CRITICAL: "bg-purple-600",
  };

  const pct = total > 0 ? (count / total) * 100 : 0;
  const color = colors[level.toUpperCase()] || "bg-zinc-500";

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-end">
        <span className="text-[10px] font-bold uppercase tracking-tighter text-text-base">
          {level}
        </span>
        <span className="text-[10px] font-mono text-text-muted">{count.toLocaleString()}</span>
      </div>
      <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          className={`h-full ${color} rounded-full`}
        />
      </div>
    </div>
  );
}
