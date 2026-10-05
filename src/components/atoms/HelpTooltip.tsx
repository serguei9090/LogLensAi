import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface HelpTooltipProps {
  content: string;
  className?: string;
}

export function HelpTooltip({ content, className }: Readonly<HelpTooltipProps>) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          type="button"
          className="inline-flex items-center justify-center p-0.5 rounded-md hover:bg-bg-surface-bright text-text-muted hover:text-text-primary transition-colors focus:outline-none cursor-help"
          aria-label="Help information"
        >
          <HelpCircle className={`h-4 w-4 ${className || ""}`} />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed text-text-primary/90 text-left">
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
