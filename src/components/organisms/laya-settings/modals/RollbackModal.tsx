import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface RollbackModalProps {
  readonly rollbackTargetId: string | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirmRollback: () => void;
}

export function RollbackModal({
  rollbackTargetId,
  onOpenChange,
  onConfirmRollback,
}: Readonly<RollbackModalProps>) {
  return (
    <Dialog open={Boolean(rollbackTargetId)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] bg-bg-surface border-border">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-text-primary">
            Confirm Checkpoint Rollback
          </DialogTitle>
          <DialogDescription className="text-xs text-text-muted">
            Are you sure you want to revert active rules to checkpoint{" "}
            <span className="font-mono font-bold text-text-primary">{rollbackTargetId}</span>?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirmRollback}
            className="text-xs bg-primary text-black hover:bg-primary/90"
          >
            Confirm Rollback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
