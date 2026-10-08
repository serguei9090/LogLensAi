import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LayaCheckpoint } from "@/types/laya";
import { RotateCcw } from "lucide-react";

export interface CheckpointsTabProps {
  readonly checkpoints: readonly LayaCheckpoint[];
  readonly activeCheckpointId?: string;
  readonly onOpenRollback: (checkpointId: string) => void;
}

export function CheckpointsTab({
  checkpoints,
  activeCheckpointId,
  onOpenRollback,
}: Readonly<CheckpointsTabProps>) {
  if (checkpoints.length === 0) {
    return (
      <div className="p-8 text-center text-xs font-mono text-text-muted bg-bg-surface rounded-xl border border-border">
        No checkpoints found.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {checkpoints.map((cp) => {
        const isActive = cp.id === activeCheckpointId;
        return (
          <div
            key={cp.id}
            className={cn(
              "p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all",
              isActive
                ? "border-primary bg-primary/5"
                : "border-border bg-bg-surface hover:border-border/80",
            )}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-text-primary">{cp.id}</span>
                {isActive && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary font-semibold">
                    ACTIVE
                  </span>
                )}
                <span className="text-xs font-mono text-text-muted">
                  by <span className="text-text-primary font-medium">{cp.author}</span>
                </span>
                <span className="text-xs font-mono text-text-muted/60">
                  {new Date(cp.timestamp).toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-text-muted">{cp.description || "No description provided"}</p>
              <div className="text-xs font-mono text-text-muted/80">
                {Object.keys(cp.questions || {}).length} rules defined (
                {Object.keys(cp.questions || {}).join(", ")})
              </div>
            </div>

            {!isActive && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenRollback(cp.id)}
                className="h-8 text-xs font-medium gap-1.5 border-border hover:border-primary text-text-primary"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Rollback to This
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
