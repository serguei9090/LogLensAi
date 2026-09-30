import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

interface ConfirmationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  variant?: "default" | "destructive";
}

export function ConfirmationDialog({
  isOpen,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  variant = "default",
}: ConfirmationDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-bg-surface-bright border-border-subtle">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div
              className={`p-2 rounded-full ${variant === "destructive" ? "bg-error/10 text-error" : "bg-primary/10 text-primary"}`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-text-primary text-xl font-semibold">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-text-secondary text-[14px] leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-6 gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-border-subtle hover:bg-bg-hover text-text-primary h-10 px-6 rounded-lg font-medium transition-all"
          >
            Cancel
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className={`${variant === "destructive" ? "bg-error hover:bg-error-dark" : "bg-primary hover:bg-primary-dark"} text-white h-10 px-6 rounded-lg font-semibold transition-all shadow-lg shadow-black/20`}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
