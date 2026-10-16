// Assume Role: Frontend Engineer (@frontend)

import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  Check,
  Cpu,
  Layers,
  Search,
  SlidersHorizontal,
  Table as TableIcon,
  TrendingUp,
} from "lucide-react";
import { useEffect, useRef } from "react";

export interface SkillCommandItem {
  id: string;
  command: string;
  title: string;
  description: string;
  badge: string;
  category: "Visuals" | "Analytics" | "Drilldown";
  promptTemplate: string;
}

export const SKILL_COMMANDS: SkillCommandItem[] = [
  {
    id: "skill-histogram",
    command: "/histogram",
    title: "Log Volume Histogram",
    description: "Render time-series volume distribution across current scope",
    badge: "Chart",
    category: "Visuals",
    promptTemplate: "Show me the log volume histogram timeline and distribution.",
  },
  {
    id: "skill-timeline",
    command: "/timeline",
    title: "Chronological Event Timeline",
    description: "Trace chronological incident progression with severity markers",
    badge: "Timeline",
    category: "Visuals",
    promptTemplate: "Trace chronological event timeline and anomalies across the logs.",
  },
  {
    id: "skill-errors",
    command: "/errors",
    title: "Error & Severity Spikes",
    description: "Filter error patterns and generate live error rate metric cards",
    badge: "Metric",
    category: "Analytics",
    promptTemplate: "Analyze top error patterns and show error distribution metrics.",
  },
  {
    id: "skill-clusters",
    command: "/clusters",
    title: "Drain3 Cluster Templates",
    description: "Inspect template clusters, frequency distribution, and drift",
    badge: "Clusters",
    category: "Analytics",
    promptTemplate: "What are the most volatile Drain3 log clusters and template patterns?",
  },
  {
    id: "skill-metrics",
    command: "/metrics",
    title: "Live Telemetry Counters",
    description: "Generate A2UI real-time metric cards for errors, warnings, and throughput",
    badge: "Metric",
    category: "Visuals",
    promptTemplate: "Show live metric counters for errors, warnings, and log throughput.",
  },
  {
    id: "skill-table",
    command: "/table",
    title: "Live Data Table",
    description: "Render an interactive, column-filtered live log data table",
    badge: "Table",
    category: "Visuals",
    promptTemplate: "Render a live interactive data table of the most recent logs.",
  },
  {
    id: "skill-rootcause",
    command: "/rootcause",
    title: "Root Cause Synthesis",
    description: "Correlate anomalies and infer the primary incident root causes",
    badge: "Synthesis",
    category: "Drilldown",
    promptTemplate: "Scan logs for correlated warning chains and synthesize probable root causes.",
  },
  {
    id: "skill-drilldown",
    command: "/drilldown",
    title: "Deep Catalog Drilldown",
    description: "Multi-point diagnostic breakdown isolating anomalies by service",
    badge: "Diagnosis",
    category: "Drilldown",
    promptTemplate:
      "Perform an in-depth diagnostic drilldown comparing normal vs anomalous log patterns.",
  },
];

interface SlashCommandMenuProps {
  readonly query: string;
  readonly selectedIndex: number;
  readonly onSelect: (item: SkillCommandItem) => void;
  readonly onClose: () => void;
}

export function SlashCommandMenu({
  query,
  selectedIndex,
  onSelect,
  onClose,
}: Readonly<SlashCommandMenuProps>) {
  const listRef = useRef<HTMLDivElement>(null);
  const filter = query.toLowerCase().trim();

  const filteredItems = SKILL_COMMANDS.filter(
    (item) =>
      filter === "" ||
      item.command.toLowerCase().includes(filter) ||
      item.title.toLowerCase().includes(filter) ||
      item.description.toLowerCase().includes(filter) ||
      item.category.toLowerCase().includes(filter),
  );

  useEffect(() => {
    if (listRef.current && filteredItems.length > 0) {
      const activeIdx = Math.min(selectedIndex, filteredItems.length - 1);
      const activeEl = listRef.current.children[activeIdx] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedIndex, filteredItems.length]);

  return (
    <div
      role="region"
      aria-label="Slash Skills Menu"
      className="absolute bottom-full mb-2 left-0 right-0 max-h-84 bg-[#101311]/98 border border-white/15 rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] backdrop-blur-3xl overflow-hidden z-50 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-150"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-primary/10 border border-primary/20 text-primary">
            <BarChart3 className="size-3.5" />
          </div>
          <span className="text-xs font-semibold text-text-primary tracking-wide">
            A2UI Skills & Visual Blueprints
          </span>
          <span className="text-[10px] font-mono text-text-muted px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
            / command
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-muted">
          <span>{filteredItems.length} skills available</span>
        </div>
      </div>

      {/* Skills list */}
      <div ref={listRef} className="overflow-y-auto max-h-72 p-1.5 space-y-0.5 custom-scrollbar">
        {filteredItems.length === 0 ? (
          <div className="py-8 px-4 text-center">
            <Search className="size-5 text-text-muted/40 mx-auto mb-2" />
            <p className="text-xs text-text-muted font-mono">
              No matching skills or blueprints found
            </p>
            <p className="text-[11px] text-text-muted/60 mt-1">
              Try /histogram, /timeline, /errors, /table
            </p>
          </div>
        ) : (
          filteredItems.map((item, index) => {
            const isSelected = index === selectedIndex;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                className={cn(
                  "w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left transition-all group",
                  isSelected
                    ? "bg-primary/15 border border-primary/30 text-white shadow-sm"
                    : "hover:bg-white/[0.04] text-text-secondary hover:text-text-primary border border-transparent",
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={cn(
                      "p-1.5 rounded-lg border transition-colors shrink-0",
                      isSelected
                        ? "bg-primary/20 border-primary/40 text-primary"
                        : "bg-white/[0.03] border-white/10 text-text-muted group-hover:text-primary group-hover:border-primary/20",
                    )}
                  >
                    {item.badge === "Chart" ? (
                      <BarChart3 className="size-3.5" />
                    ) : item.badge === "Timeline" ? (
                      <Activity className="size-3.5" />
                    ) : item.badge === "Metric" ? (
                      <TrendingUp className="size-3.5" />
                    ) : item.badge === "Clusters" ? (
                      <Layers className="size-3.5" />
                    ) : item.badge === "Table" ? (
                      <TableIcon className="size-3.5" />
                    ) : item.badge === "Diagnosis" ? (
                      <SlidersHorizontal className="size-3.5" />
                    ) : (
                      <Cpu className="size-3.5" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary">
                        {item.command}
                      </span>
                      <span className="text-xs font-medium text-text-primary truncate">
                        {item.title}
                      </span>
                    </div>
                    <span className="text-[11px] text-text-muted truncate mt-0.5">
                      {item.description}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={cn(
                      "text-[10px] font-mono px-2 py-0.5 rounded-md border",
                      isSelected
                        ? "bg-primary/20 border-primary/40 text-primary font-semibold"
                        : "bg-white/5 border-white/10 text-text-muted",
                    )}
                  >
                    {item.badge}
                  </span>
                  {isSelected && <Check className="size-3 text-primary animate-in zoom-in-50" />}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer helper */}
      <div className="px-3 py-1.5 border-t border-white/5 bg-white/[0.01] flex items-center justify-between text-[10px] font-mono text-text-muted/70">
        <div className="flex items-center gap-2">
          <span>
            Use <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10">↑</kbd>
            <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10">↓</kbd> to
            navigate
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10">Enter</kbd> to
            insert blueprint
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="hover:text-text-primary underline cursor-pointer"
        >
          ESC to dismiss
        </button>
      </div>
    </div>
  );
}
