import { AnimatePresence, motion } from "framer-motion";
import { RefreshCcw, Sparkles } from "lucide-react";
import { type IngestionJob, useIngestionStore } from "@/store/ingestionStore";

/**
 * Displays a floating processing indicator while Drain3 pattern mining is active.
 * Reads from the shared ingestionStore — no independent polling.
 */
export function ProcessingNotification() {
  const jobs = useIngestionStore((state) => state.jobs);
  const activeJobs = jobs.filter(
    (j: IngestionJob) => j.status === "processing" || j.status === "pending",
  );

  if (activeJobs.length === 0) {
    return null;
  }

  // Aggregate progress for the primary notification
  const totalProcessed = activeJobs.reduce(
    (sum: number, j: IngestionJob) => sum + j.processed_lines,
    0,
  );
  const totalLines = activeJobs.reduce((sum: number, j: IngestionJob) => sum + j.total_lines, 0);
  const percent = totalLines > 0 ? Math.round((totalProcessed / totalLines) * 100) : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, x: 20 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed bottom-6 right-6 z-[9999]"
      >
        <div className="bg-bg-surface/80 border border-primary-green/30 backdrop-blur-xl rounded-2xl p-4 shadow-2xl shadow-primary-green/10 min-w-[240px] overflow-hidden group">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative">
              <RefreshCcw className="size-4 text-primary-green animate-spin" />
              <Sparkles className="size-2 text-primary-green absolute -top-1 -right-1 animate-pulse" />
            </div>
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-text-primary">
                Drain3 Pattern Mining
              </h4>
              <p className="text-[9px] text-text-muted font-mono">
                {activeJobs.length} active Drain3 {activeJobs.length === 1 ? "task" : "tasks"}
              </p>
            </div>
            <div className="ml-auto text-right">
              <span className="text-xs font-mono font-bold text-primary-green">{percent}%</span>
            </div>
          </div>

          <div className="h-1 bg-bg-base/50 rounded-full overflow-hidden border border-white/5">
            <motion.div
              className="h-full bg-primary-green shadow-[0_0_8px_rgba(16,185,129,0.5)]"
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ type: "spring", stiffness: 40 }}
            />
          </div>

          <div className="mt-2 flex justify-between items-center">
            <span className="text-[8px] font-mono text-text-muted uppercase">
              {totalProcessed.toLocaleString()} / {totalLines.toLocaleString()}
            </span>
            <span className="text-[8px] font-bold text-primary-green opacity-0 group-hover:opacity-100 transition-opacity">
              Mining Patterns
            </span>
          </div>

          {/* Decorative accent */}
          <div className="absolute top-0 left-0 w-1 h-full bg-primary-green/40" />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
