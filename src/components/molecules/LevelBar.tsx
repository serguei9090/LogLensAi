import { motion } from "framer-motion";

interface LevelBarProps {
  level: string;
  count: number;
  total: number;
}

/**
 * LevelBar component for visualizing log severity distribution.
 * Follows atomic design (Molecule).
 */
export function LevelBar({ level, count, total }: Readonly<LevelBarProps>) {
  const colors: Record<string, string> = {
    ERROR: "bg-error shadow-[0_0_8px_rgba(239,68,68,0.3)]",
    WARN: "bg-warning shadow-[0_0_8px_rgba(245,158,11,0.3)]",
    INFO: "bg-primary shadow-[0_0_8px_rgba(34,197,94,0.3)]",
    DEBUG: "bg-info shadow-[0_0_8px_rgba(56,189,248,0.3)]",
    FATAL: "bg-error shadow-[0_0_8px_rgba(239,68,68,0.5)]",
    CRITICAL: "bg-debug shadow-[0_0_8px_rgba(167,139,250,0.3)]",
  };

  const pct = total > 0 ? (count / total) * 100 : 0;
  const colorClass = colors[level.toUpperCase()] || "bg-text-muted";

  return (
    <div className="group">
      <div className="flex justify-between items-end mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-tight text-text-primary group-hover:text-primary transition-colors">
          {level}
        </span>
        <span className="text-[10px] font-mono text-text-muted bg-bg-base/50 px-1.5 py-0.5 rounded border border-border/30">
          {count.toLocaleString()}
        </span>
      </div>
      <div className="h-2 bg-bg-surface-bright rounded-full overflow-hidden border border-white/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full ${colorClass} rounded-full`}
        />
      </div>
    </div>
  );
}
