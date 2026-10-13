import { Button } from "@/components/ui/button";
import { Activity, AlertTriangle, Layers, Sparkles, TrendingUp } from "lucide-react";

interface QuickPromptCardProps {
  readonly onSelectPrompt: (prompt: string) => void;
}

const PROMPTS = [
  {
    icon: <AlertTriangle className="size-4 text-rose-400" />,
    title: "Error & Severity Spikes",
    description: "Analyze error frequency across all services over time.",
    prompt: "Analyze the top error patterns and show an error distribution metric.",
  },
  {
    icon: <Layers className="size-4 text-emerald-400" />,
    title: "Drain3 Cluster Anomalies",
    description: "Identify sudden new log template clusters or drift.",
    prompt: "What are the most volatile log clusters and template patterns?",
  },
  {
    icon: <Activity className="size-4 text-cyan-400" />,
    title: "Live Stream Throughput",
    description: "Inspect message rates and compare syslog vs HTTP ingest.",
    prompt: "Summarize ingestion rates across active sources and generate a data table.",
  },
  {
    icon: <TrendingUp className="size-4 text-amber-400" />,
    title: "Root Cause Synthesis",
    description: "Synthesize probable root causes from correlated events.",
    prompt: "Scan recent logs for correlated warning chains and synthesize root causes.",
  },
];

export function QuickPromptStarters({ onSelectPrompt }: Readonly<QuickPromptCardProps>) {
  return (
    <div className="flex flex-col items-center justify-center max-w-3xl mx-auto py-12 px-4 text-center">
      <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 text-primary mb-4 shadow-lg shadow-primary/5">
        <Sparkles className="size-7" />
      </div>
      <h2 className="text-xl font-bold text-text-primary tracking-tight mb-2">
        Conversational Telemetry Studio
      </h2>
      <p className="text-sm text-text-muted max-w-lg mb-8 leading-relaxed">
        Ask natural questions to generate real-time metrics, interactive charts, and incident
        summaries inline via the Google A2UI protocol.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full text-left">
        {PROMPTS.map((item) => (
          <Button
            key={item.title}
            variant="outline"
            onClick={() => onSelectPrompt(item.prompt)}
            className="flex items-start gap-3.5 p-4 h-auto bg-bg-surface/40 hover:bg-bg-surface/90 border-border-subtle/80 hover:border-primary/40 rounded-xl transition-all duration-200 group text-left whitespace-normal justify-start"
          >
            <div className="p-2 rounded-lg bg-bg-app border border-border-subtle/60 shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
              {item.icon}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold text-text-primary group-hover:text-primary transition-colors">
                {item.title}
              </span>
              <span className="text-xs text-text-muted line-clamp-2 leading-relaxed">
                {item.description}
              </span>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
}
