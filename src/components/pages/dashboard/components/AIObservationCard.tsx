import { DecryptedText } from "@/components/atoms/DecryptedText";
import type { DashboardMode } from "@/components/molecules/DashboardModeToggle";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import type { DashboardStats } from "../types";

export interface AIObservationCardProps {
  readonly stats: DashboardStats;
  readonly setMode: (mode: DashboardMode) => void;
}

export function AIObservationCard({ stats, setMode }: Readonly<AIObservationCardProps>) {
  if (!stats.latest_ai_insight) {
    return null;
  }
  return (
    <section className="bg-primary/5 border border-primary/20 rounded-2xl p-6 backdrop-blur-md relative overflow-hidden group animate-fade-in-up">
      <div className="flex items-start justify-between gap-6 relative z-10">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="size-4 text-primary animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              Latest AI Observation
            </span>
          </div>
          <p className="text-sm font-mono text-text-primary leading-relaxed italic">
            &quot;
            <DecryptedText
              text={stats.latest_ai_insight}
              speed={25}
              maxIterations={6}
              className="text-text-primary"
            />
            &quot;
          </p>
        </div>
        <Button
          onClick={() => setMode("ai")}
          className="shrink-0 text-xs uppercase tracking-widest shadow-[0_0_15px_var(--primary-glow)] hover:scale-105"
        >
          Deep Dive
        </Button>
      </div>
      <div className="absolute -top-20 -right-20 size-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
    </section>
  );
}
