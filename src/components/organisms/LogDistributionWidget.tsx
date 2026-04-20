import type { FilterEntry } from "@/components/molecules/FilterBuilder";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { useInvestigationStore } from "@/store/investigationStore";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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

export function LogDistributionWidget({
  workspaceId,
  sourceIds,
  fusionId,
  filters,
  query,
  isTailing,
  onClose,
}: LogDistributionWidgetProps) {
  const { timeRange } = useInvestigationStore();
  const [data, setData] = useState<Bucket[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          callSidecar<{ buckets: Bucket[] }>({
            method: "get_log_distribution",
            params: {
              workspace_id: workspaceId,
              source_ids: sourceIds,
              fusion_id: fusionId,
              query: query,
              filters: filters,
              interval: "1h",
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

  // Format the time bucket for display
  const formattedData = data.map((d) => {
    const timeStr = d.bucket; // "YYYY-MM-DD HH:MM"
    const date = new Date(`${timeStr}:00Z`); // approximate or treat as local
    const displayTime = Number.isNaN(date.getTime())
      ? timeStr.split(" ")[1] || timeStr
      : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Match anomalies to this bucket
    const hasAnomaly = anomalies.some((a) => a.timestamp.startsWith(timeStr));

    return {
      ...d,
      displayTime,
      hasAnomaly,
      INFO: d.INFO || 0,
      ERROR: d.ERROR || 0,
      WARN: d.WARN || 0,
    };
  });

  const renderStatusOverlay = () => {
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
  };

  return (
    <div className="min-h-[220px] h-[220px] w-full bg-bg-base border-b border-border/40 shrink-0 flex flex-col relative group">
      {/* Header with Date Selectors */}
      <div className="flex items-center justify-between px-4 h-10 border-b border-border/20 bg-bg-base/50">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            Distribution Insights
          </span>
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

      <div className="flex-1 p-4 relative overflow-hidden">
        {renderStatusOverlay()}

        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={formattedData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="displayTime"
              tick={{ fill: "#878c8e", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              dy={5}
            />
            <YAxis
              tick={{ fill: "#878c8e", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              dx={-5}
            />
            <Tooltip
              cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
              contentStyle={{
                backgroundColor: "#111312",
                borderColor: "rgba(255, 255, 255, 0.1)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              itemStyle={{ fontSize: "12px" }}
            />
            <Bar dataKey="INFO" stackId="a" fill="#0ea5e9" radius={[0, 0, 4, 4]} />
            <Bar dataKey="WARN" stackId="a" fill="#eab308" />
            <Bar dataKey="ERROR" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]}>
              {formattedData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.hasAnomaly ? "#ff4444" : "#ef4444"}
                  stroke={entry.hasAnomaly ? "#ffffff" : "none"}
                  strokeWidth={entry.hasAnomaly ? 2 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
