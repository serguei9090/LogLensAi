import { motion } from "framer-motion";
import { BarChart3, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type DashboardMode = "static" | "ai";

interface DashboardModeToggleProps {
  mode: DashboardMode;
  onModeChange: (mode: DashboardMode) => void;
  className?: string;
}

/**
 * A floating pill-shaped toggle for switching between Static and AI dashboard modes.
 * Designed to sit at the bottom center of the viewport.
 */
export function DashboardModeToggle({
  mode,
  onModeChange,
  className,
}: Readonly<DashboardModeToggleProps>) {
  return (
    <div
      className={cn(
        "fixed bottom-8 left-1/2 -translate-x-1/2 z-50",
        "bg-bg-surface/80 backdrop-blur-md border border-border/50 rounded-full p-1.5",
        "shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex items-center gap-1",
        className,
      )}
    >
      <ToggleButton
        active={mode === "static"}
        onClick={() => onModeChange("static")}
        icon={<BarChart3 className="size-4" />}
        label="Static"
      />
      <ToggleButton
        active={mode === "ai"}
        onClick={() => onModeChange("ai")}
        icon={<Sparkles className="size-4" />}
        label="AI Insights"
        isPremium
      />
    </div>
  );
}

interface ToggleButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  isPremium?: boolean;
}

function ToggleButton({
  active,
  onClick,
  icon,
  label,
  isPremium = false,
}: Readonly<ToggleButtonProps>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all duration-300",
        active ? "text-bg-base" : "text-text-muted hover:text-text-secondary",
      )}
    >
      {active && (
        <motion.div
          layoutId="mode-bg"
          className={cn("absolute inset-0 rounded-full", isPremium ? "bg-debug" : "bg-primary")}
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
      <span className="relative z-10">{icon}</span>
      <span className="relative z-10 tracking-tight">{label}</span>
    </button>
  );
}
