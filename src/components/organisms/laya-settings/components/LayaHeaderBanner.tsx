import { HelpTooltip } from "@/components/atoms/HelpTooltip";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { BookOpen, Zap } from "lucide-react";

export interface LayaHeaderBannerProps {
  readonly isEnabled: boolean;
  readonly onToggleEnabled: (checked: boolean) => void;
  readonly onOpenGuide: () => void;
}

export function LayaHeaderBanner({
  isEnabled,
  onToggleEnabled,
  onOpenGuide,
}: Readonly<LayaHeaderBannerProps>) {
  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-bg-surface border border-border/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
          <Zap className="h-5 w-5" />
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <h3 className="text-base font-semibold text-text-primary tracking-tight">
            Laya System 1 Decision Engine
          </h3>
          <span className="text-xs uppercase font-mono px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
            ModernBERT 8-bit
          </span>
          <HelpTooltip content="Non-autoregressive decision engine that performs ultra-fast tool routing, log severity scoring, and cluster triage in ~30ms before touching costly generative LLMs." />
        </div>
      </div>

      <div className="flex items-center gap-3 self-end md:self-center shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenGuide}
          className="h-8 text-xs font-medium gap-1.5 border-border hover:border-primary text-text-primary"
        >
          <BookOpen className="h-3.5 w-3.5 text-primary" /> Guide & Primitives
        </Button>
        <div className="h-4 w-px bg-border hidden sm:block" />
        <span className="text-xs font-medium text-text-muted">
          {isEnabled ? "Active" : "Disabled"}
        </span>
        <Switch
          checked={isEnabled}
          onCheckedChange={onToggleEnabled}
          className="data-[state=checked]:bg-primary"
        />
      </div>
    </div>
  );
}
