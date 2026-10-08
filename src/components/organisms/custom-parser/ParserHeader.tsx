import { Button } from "@/components/ui/button";
import { Terminal, X } from "lucide-react";

interface ParserHeaderProps {
  hasTimestampMapping: boolean;
  onClose: () => void;
}

export function ParserHeader({ hasTimestampMapping, onClose }: ParserHeaderProps) {
  return (
    <div className="flex items-center justify-between px-8 py-6 border-b border-border/40 bg-white/5">
      <div className="flex items-center gap-4">
        <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
          <Terminal className="size-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary tracking-tight">Parser Architect</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-text-muted uppercase tracking-widest font-medium">
              Log Translation Engine
            </p>
            <div className="h-1 w-1 rounded-full bg-white/20" />
            <span className="text-xs text-primary font-mono">
              {hasTimestampMapping ? "Sync Active" : "Unmapped"}
            </span>
          </div>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        onClick={onClose}
        className="p-2 hover:bg-white/10 rounded-full transition-colors text-text-muted hover:text-text-primary"
      >
        <X className="size-5" />
      </Button>
    </div>
  );
}
