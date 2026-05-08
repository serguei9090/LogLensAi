import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IngestionJob } from "@/lib/hooks/useIngestionStatus";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";

interface IngestionOverlayProps {
  readonly job?: IngestionJob | null;
  readonly className?: string;
}

/**
 * A premium, glassmorphism overlay to show log ingestion progress.
 * Features a circular progress arrow and a linear progress bar.
 */
export function IngestionOverlay({ job, className }: IngestionOverlayProps) {
  const processed = job?.processed_lines ?? 0;
  const total = job?.total_lines ?? 1;
  const progress = Math.min(Math.round((processed / total) * 100), 100);

  return (
    <div
      className={cn(
        "absolute inset-0 z-[100] flex flex-col items-center justify-center",
        "bg-bg-base/80 backdrop-blur-xl transition-all duration-700 animate-in fade-in",
        className
      )}
    >
      <div className="relative mb-12">
        {/* Glowing Background Rings */}
        <div className="absolute inset-0 rounded-full bg-primary/30 blur-3xl animate-pulse" />
        <div className="absolute -inset-4 rounded-full border border-primary/10 animate-[ping_3s_infinite]" />
        
        {/* Main Spinner Icon */}
        <div className="relative flex items-center justify-center w-28 h-28 rounded-full border-2 border-primary/20 bg-bg-surface/80 shadow-2xl backdrop-blur-md">
          <Loader2 className="w-14 h-14 text-primary animate-spin" />
        </div>
      </div>

      <div className="max-w-md w-full px-8 space-y-6 text-center">
        <div className="space-y-1">
          <h3 className="text-2xl font-black text-text-primary tracking-tighter uppercase italic">
            Ingesting Logs
          </h3>
          <p className="text-text-muted text-xs font-mono tracking-widest opacity-60 uppercase">
            {job ? `${processed.toLocaleString()} / ${total.toLocaleString()} Lines Processed` : "Ingesting to Database..."}
          </p>
        </div>

        {/* Linear Progress Bar using shadcn Primitive */}
        <div className="space-y-2">
          <Progress value={progress} className="h-1.5 w-full">
             <ProgressTrack className="h-1.5 bg-white/5 border border-white/5 overflow-hidden">
                <ProgressIndicator className="bg-gradient-to-r from-primary/60 via-primary to-primary shadow-[0_0_20px_rgba(34,197,94,0.6)]" />
             </ProgressTrack>
          </Progress>
          
          <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-[0.2em] text-text-muted/80 px-0.5">
            <span className="flex items-center gap-2">
               <span className="size-1 rounded-full bg-primary animate-pulse" />
               {job ? `${progress}% Complete` : "Loading..."}
            </span>
            <span className="animate-pulse flex items-center gap-2">
               Mining Patterns{" "}
               <span className="size-1 rounded-full bg-primary animate-pulse delay-75" />
            </span>
          </div>
        </div>
      </div>
      
      {/* Footer metadata */}
      <div className="absolute bottom-12 flex items-center gap-4 text-[10px] text-text-muted/30 font-mono tracking-tighter">
        <span className="px-2 py-0.5 rounded border border-border/30 bg-bg-surface/30">
          {job ? `JOB_${job.id}` : "JOB_PENDING"}
        </span>
        <span className="size-1 rounded-full bg-border/30" />
        <span className="uppercase tracking-widest">{job?.workspace_id ?? "WS_SYSTEM"}</span>
      </div>
    </div>
  );
}
