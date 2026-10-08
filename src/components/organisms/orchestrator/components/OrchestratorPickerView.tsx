import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { ClusteringStatus } from "@/store/clusteringStore";
import { Clock, Cpu, Layers, Sparkles, Zap } from "lucide-react";
import type { OrchestratorView } from "../types";
import { StrategyCard } from "./StrategyCard";

interface OrchestratorPickerViewProps {
  readonly showDistribution: boolean;
  readonly setShowDistribution: (v: boolean) => void;
  readonly showAnomalies: boolean;
  readonly setShowAnomalies: (v: boolean) => void;
  readonly workspaceGlobalContext: string | null;
  readonly onOpenAiContext: () => void;
  readonly clusteringStatus: ClusteringStatus | null;
  readonly onToggleClustering: (enabled: boolean) => void;
  readonly onConfigureEngine: () => void;
  readonly onSelectView: (view: OrchestratorView) => void;
}

export function OrchestratorPickerView({
  showDistribution,
  setShowDistribution,
  showAnomalies,
  setShowAnomalies,
  workspaceGlobalContext,
  onOpenAiContext,
  clusteringStatus,
  onToggleClustering,
  onConfigureEngine,
  onSelectView,
}: OrchestratorPickerViewProps) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
      <div className="space-y-3">
        <p className="text-xs text-white/40 font-medium px-0.5 uppercase tracking-widest">
          Visualizers
        </p>
        <div className="grid gap-2">
          {[
            {
              label: "Log Distribution",
              desc: "Timeline density matching",
              checked: showDistribution,
              set: setShowDistribution,
              icon: <Sparkles className="size-4 text-white/50" />,
            },
            {
              label: "Anomaly Radar",
              desc: "Detect statistical violations",
              checked: showAnomalies,
              set: setShowAnomalies,
              icon: <Sparkles className="size-4 text-white/50" />,
            },
          ].map((layer) => (
            <div
              key={layer.label}
              className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-md bg-white/5 border border-white/10 flex items-center justify-center group-hover:text-white transition-all">
                  {layer.icon}
                </div>
                <div className="space-y-0.5">
                  <span className="block text-sm font-medium text-white/90 group-hover:text-white transition-colors">
                    {layer.label}
                  </span>
                  <span className="block text-xs text-white/40">{layer.desc}</span>
                </div>
              </div>
              <Switch checked={layer.checked} onCheckedChange={layer.set} />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs text-white/40 font-medium px-0.5 uppercase tracking-widest">
          Intelligence
        </p>
        <div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all group">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-md bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-all">
              <Sparkles
                className={cn("size-4", workspaceGlobalContext ? "text-white/80" : "text-white/40")}
              />
            </div>
            <div className="space-y-0.5">
              <span className="block text-sm font-medium text-white/90 group-hover:text-white transition-colors">
                Knowledge Base
              </span>
              <span className="block text-xs text-white/40 max-w-[140px] truncate">
                {workspaceGlobalContext ? "Context active" : "Inject structure"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenAiContext}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
          >
            {workspaceGlobalContext ? "Edit" : "Set"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs text-white/40 font-medium px-0.5 uppercase tracking-widest">
          Engine Performance
        </p>
        <div className="grid gap-2">
          <div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all group">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-md bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-all text-white/40 group-hover:text-white">
                <Cpu className="size-4" />
              </div>
              <div className="space-y-0.5">
                <span className="block text-sm font-medium text-white/90 group-hover:text-white transition-colors">
                  Enable Clustering
                </span>
                <span className="block text-xs text-white/40 truncate">
                  Drain3 Pattern Mining
                </span>
              </div>
            </div>
            <Switch
              checked={!clusteringStatus?.paused}
              onCheckedChange={onToggleClustering}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs text-white/40 font-medium px-0.5 uppercase tracking-widest">
          Engine
        </p>
        <div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all group">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-md bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-all text-white/40 group-hover:text-white">
              <Layers className="size-4" />
            </div>
            <div className="space-y-0.5">
              <span className="block text-sm font-medium text-white/90 group-hover:text-white transition-colors">
                Core Parser
              </span>
              <span className="block text-xs text-white/40 truncate">
                Drain3 Configuration
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onConfigureEngine}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
          >
            Configure
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs text-white/40 font-medium px-0.5 uppercase tracking-widest">
          Operations
        </p>
        <div className="grid gap-2">
          <StrategyCard
            icon={<Zap className="size-4 text-white/50" />}
            name="Log Fusion"
            description="Combine different log streams together."
            onClick={() => onSelectView("fusion-form")}
          />
          <StrategyCard
            icon={<Clock className="size-4 text-white/50" />}
            name="Temporal Sync"
            description="Align clocks across multiple files."
            onClick={() => onSelectView("time-alignment-form")}
          />
        </div>
      </div>
    </div>
  );
}
