import { Sparkles } from "lucide-react";
import {
  type DashboardMode,
  DashboardModeToggle,
} from "@/components/molecules/DashboardModeToggle";

export interface DashboardHeaderProps {
  readonly mode: DashboardMode;
  readonly loading: boolean;
  readonly onRefresh: () => void;
  readonly onModeChange?: (mode: DashboardMode) => void;
}

export function DashboardHeader({ mode, onModeChange }: Readonly<DashboardHeaderProps>) {
  const title = mode === "static" ? "Dashboard" : "AI Insights";
  const description =
    mode === "static"
      ? "High-velocity log analytics and system health overview."
      : "Heuristic pattern analysis and anomaly detection.";

  return (
    <div className="flex justify-between items-center mb-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-1 font-mono uppercase italic flex items-center gap-3">
          {title}
          {mode === "ai" && <Sparkles className="size-6 text-primary" />}
        </h1>
        <p className="text-text-muted text-sm">{description}</p>
      </div>

      {onModeChange && <DashboardModeToggle mode={mode} onModeChange={onModeChange} />}
    </div>
  );
}
