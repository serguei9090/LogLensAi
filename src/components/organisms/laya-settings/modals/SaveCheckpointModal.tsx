import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface SaveCheckpointModalProps {
  readonly isOpen: boolean;
  readonly checkpointAuthor: string;
  readonly checkpointDesc: string;
  readonly onOpenChange: (open: boolean) => void;
  readonly onAuthorChange: (val: string) => void;
  readonly onDescChange: (val: string) => void;
  readonly onSaveRules: () => void;
}

export function SaveCheckpointModal({
  isOpen,
  checkpointAuthor,
  checkpointDesc,
  onOpenChange,
  onAuthorChange,
  onDescChange,
  onSaveRules,
}: Readonly<SaveCheckpointModalProps>) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] bg-bg-surface border-border">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-text-primary">
            Commit Rule Checkpoint
          </DialogTitle>
          <DialogDescription className="text-xs text-text-muted">
            Creates a versioned snapshot of the current rules with rollback support.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <label className="text-xs font-mono text-text-muted">Author</label>
            <input
              type="text"
              value={checkpointAuthor}
              onChange={(e) => onAuthorChange(e.target.value)}
              className="w-full h-9 px-3 rounded-lg text-xs bg-bg-app border border-border text-text-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-mono text-text-muted">Change Description</label>
            <input
              type="text"
              placeholder="e.g. Refined auth deadlock categories"
              value={checkpointDesc}
              onChange={(e) => onDescChange(e.target.value)}
              className="w-full h-9 px-3 rounded-lg text-xs bg-bg-app border border-border text-text-primary"
            />
          </div>
        </div>

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
            onClick={onSaveRules}
            className="text-xs bg-primary text-black hover:bg-primary/90"
          >
            Commit & Activate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
