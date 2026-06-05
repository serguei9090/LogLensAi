import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ClusterRowProps {
  index: number;
  template: string;
  count: number;
  total: number;
  type: "error" | "noise";
}

/**
 * ClusterRow component for displaying log pattern clusters.
 * Follows atomic design (Molecule).
 */
export function ClusterRow({ index, template, count, total, type }: Readonly<ClusterRowProps>) {
  const barColor = type === "error" ? "bg-error" : "bg-debug";
  const glow =
    type === "error"
      ? "shadow-[0_0_8px_rgba(239,68,68,0.3)]"
      : "shadow-[0_0_8px_rgba(167,139,250,0.3)]";

  return (
    <div className="group flex items-start gap-4 p-3 rounded-lg hover:bg-bg-hover transition-[background-color,border-color] duration-200 border border-transparent hover:border-border/50 bg-bg-surface/30">
      <span className="text-[10px] font-mono text-text-muted py-1 w-6">#{index + 1}</span>
      <div className="flex-1 overflow-hidden">
        <p
          className={cn(
            "text-[11px] font-mono text-text-primary truncate mb-1.5 leading-relaxed group-hover:text-primary transition-colors",
            type === "error" && "text-error opacity-90",
          )}
        >
          {template}
        </p>
        <div className="flex items-center gap-3">
          <div className="h-1 bg-bg-base/50 rounded-full flex-1 overflow-hidden border border-white/5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(count / total) * 100}%` }}
              className={cn("h-full rounded-full", barColor, glow)}
            />
          </div>
          <span className="text-[10px] font-mono text-text-muted shrink-0 w-16 text-right">
            {count.toLocaleString()} hits
          </span>
        </div>
      </div>
    </div>
  );
}
