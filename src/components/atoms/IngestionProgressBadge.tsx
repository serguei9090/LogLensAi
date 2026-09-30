import { cn } from "@/lib/utils";

export type IngestionStatus = "queued" | "pending" | "processing" | "completed" | "failed";

interface IngestionProgressBadgeProps {
  status: IngestionStatus;
  /** Progress ratio 0–1 (processed_lines / total_lines). */
  progress?: number;
  /** 1-based queue position. Shown when status is "queued". */
  queuePosition?: number;
  className?: string;
}

/**
 * IngestionProgressBadge — compact source-level status indicator.
 *
 * Displayed inside SourceItem in the sidebar hierarchy tree to give the user
 * instant feedback on per-source upload state:
 *   - queued   → amber ring + position number (#2, #3…)
 *   - pending  → pulsing primary dot
 *   - processing → determinate progress arc + pulse
 *   - completed  → nothing (badge disappears)
 *   - failed     → red error dot
 */
export function IngestionProgressBadge({
  status,
  progress = 0,
  queuePosition = 0,
  className,
}: IngestionProgressBadgeProps) {
  if (status === "completed") {
    return null;
  }

  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  if (status === "queued") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none",
          "bg-amber-500/15 text-amber-400 border border-amber-500/30",
          "animate-in fade-in duration-300",
          className,
        )}
        title={`Queued — position #${queuePosition}`}
      >
        <span className="inline-block w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
        {queuePosition > 0 ? `#${queuePosition}` : "Q"}
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none",
          "bg-red-500/15 text-red-400 border border-red-500/30",
          className,
        )}
        title="Ingestion failed"
      >
        <span className="inline-block w-1 h-1 rounded-full bg-red-400" />
        ERR
      </span>
    );
  }

  // processing or pending — show a compact progress bar + pct
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none",
        "bg-primary/15 text-primary border border-primary/30",
        className,
      )}
      title={`Processing — ${pct}%`}
    >
      {/* Mini progress bar */}
      <span className="relative inline-block w-8 h-1.5 rounded-full bg-primary/20 overflow-hidden">
        <span
          className="absolute inset-y-0 left-0 bg-primary rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="animate-pulse">{pct}%</span>
    </span>
  );
}
