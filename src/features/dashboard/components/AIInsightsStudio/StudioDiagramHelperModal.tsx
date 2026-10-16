// Assume Role: Frontend Engineer (@frontend)

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  ChevronRight,
  Database,
  Layers,
  Sparkles,
  Table as TableIcon,
  TrendingUp,
  X,
} from "lucide-react";
import { useState } from "react";

export interface VisualPreset {
  id: string;
  title: string;
  description: string;
  icon: typeof BarChart3;
  category: "Histograms" | "Metrics" | "Tables" | "Drilldown";
  badge: string;
  color: string;
  prompt: string;
}

const VISUAL_PRESETS: VisualPreset[] = [
  {
    id: "preset-histogram-all",
    title: "Volume Timeline (Histogram)",
    description: "Multi-bucket distribution showing volume spikes across the selected scope",
    icon: BarChart3,
    category: "Histograms",
    badge: "Time-series",
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    prompt: "Show me a log volume histogram timeline for the attached scope.",
  },
  {
    id: "preset-error-histogram",
    title: "Error & Warning Spikes",
    description: "Filtered histogram isolating error anomalies and warning bursts over time",
    icon: TrendingUp,
    category: "Histograms",
    badge: "Anomalies",
    color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    prompt: "Render an error frequency distribution chart and breakdown the most critical spikes.",
  },
  {
    id: "preset-telemetry-metrics",
    title: "Telemetry Counter Cards",
    description: "Real-time live metric cards for total ingested logs, error counts, and warnings",
    icon: Activity,
    category: "Metrics",
    badge: "Live Stat",
    color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    prompt:
      "Display live metric telemetry cards showing total volume, error count, and warning rates.",
  },
  {
    id: "preset-cluster-drift",
    title: "Drain3 Cluster Templates",
    description: "Template frequency breakdown to identify recurring log patterns and drift",
    icon: Layers,
    category: "Drilldown",
    badge: "Clustering",
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    prompt:
      "Analyze the top Drain3 log clusters and display their template signatures with frequency.",
  },
  {
    id: "preset-live-table",
    title: "Interactive Log Data Table",
    description:
      "Render a scrollable live log table with level badges, timestamps, and message search",
    icon: TableIcon,
    category: "Tables",
    badge: "Data Grid",
    color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    prompt: "Render a live interactive log data table of the latest records.",
  },
  {
    id: "preset-deep-drilldown",
    title: "Cross-Catalog Root Cause",
    description:
      "Correlate error chains and abnormal clusters across services into a synthesized verdict",
    icon: Database,
    category: "Drilldown",
    badge: "Synthesis",
    color: "text-sky-400 bg-sky-500/10 border-sky-500/20",
    prompt: "Perform a deep root cause analysis correlating error spikes and cluster patterns.",
  },
];

interface StudioDiagramHelperModalProps {
  readonly onSelectPrompt: (prompt: string) => void;
}

export function StudioDiagramHelperModal({
  onSelectPrompt,
}: Readonly<StudioDiagramHelperModalProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "All" | "Histograms" | "Metrics" | "Tables" | "Drilldown"
  >("All");

  const filteredPresets = VISUAL_PRESETS.filter(
    (preset) => activeTab === "All" || preset.category === activeTab,
  );

  const handleSelect = (prompt: string) => {
    onSelectPrompt(prompt);
    setIsOpen(false);
  };

  return (
    <>
      {/* Top-Left Floating Button */}
      <div className="absolute top-4 left-4 z-40 flex items-center gap-2 pointer-events-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen((prev) => !prev)}
          className={cn(
            "h-8.5 px-3 rounded-xl gap-2 text-xs font-mono backdrop-blur-xl shadow-lg transition-all",
            isOpen
              ? "border-primary/50 bg-primary/10 text-primary shadow-primary/10"
              : "border-white/10 bg-bg-surface/80 hover:bg-bg-surface hover:border-white/20 text-text-secondary hover:text-text-primary",
          )}
          title="Open Visuals & Diagrams helper"
        >
          <BarChart3 className="size-3.5 text-primary" />
          <span className="font-medium">Diagrams & Visuals</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/5 border border-white/10 text-text-muted">
            A2UI
          </span>
        </Button>
      </div>

      {/* Modal / Popover Card */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-start p-4 sm:p-6 md:p-8 pointer-events-none animate-in fade-in duration-150">
          {/* Backdrop click to dismiss */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs pointer-events-auto"
            onClick={() => setIsOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setIsOpen(false);
              }
            }}
          />

          {/* Dialog Container */}
          <div className="relative mt-12 sm:mt-10 ml-0 sm:ml-4 w-full max-w-xl bg-[#101311]/98 border border-white/15 rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] backdrop-blur-3xl pointer-events-auto overflow-hidden flex flex-col z-10 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    Diagram & Histogram Blueprints
                  </h3>
                  <p className="text-[11px] text-text-muted">
                    Quickly launch pre-calibrated A2UI visual templates for your active log scope
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
                title="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 px-4 py-2 border-b border-white/5 bg-white/[0.01] overflow-x-auto custom-scrollbar">
              {(["All", "Histograms", "Metrics", "Tables", "Drilldown"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-mono transition-colors shrink-0",
                    activeTab === tab
                      ? "bg-primary/20 border border-primary/30 text-primary font-semibold"
                      : "text-text-muted hover:text-text-primary hover:bg-white/5 border border-transparent",
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Preset Cards List */}
            <div className="p-3 grid grid-cols-1 gap-2 max-h-96 overflow-y-auto custom-scrollbar">
              {filteredPresets.map((preset) => {
                const IconComponent = preset.icon;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelect(preset.prompt)}
                    className="flex items-start justify-between gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-primary/30 transition-all text-left group"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={cn("p-2 rounded-lg border shrink-0 mt-0.5", preset.color)}>
                        <IconComponent className="size-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-text-primary group-hover:text-primary transition-colors">
                            {preset.title}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded border bg-white/5 border-white/10 text-text-muted">
                            {preset.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                          {preset.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-xs font-mono text-text-muted group-hover:text-primary shrink-0 self-center">
                      <span className="hidden sm:inline text-[11px]">Generate</span>
                      <ChevronRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-white/5 bg-white/[0.01] flex items-center justify-between text-[11px] font-mono text-text-muted">
              <span>
                Tip: Attach specific catalogs with <strong className="text-cyan-400">@</strong>{" "}
                before generating
              </span>
              <span className="text-[10px]">
                Type <strong className="text-primary">/</strong> in chat for skills
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
