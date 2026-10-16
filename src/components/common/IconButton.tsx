import { buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface IconButtonProps {
  icon: ReactNode;
  label: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}

/**
 * A standard Icon Button that includes a mandatory accessible tooltip.
 * Uses buttonVariants to ensure visual consistency with other buttons
 * while avoiding DOM nesting errors (button-inside-button).
 */
export function IconButton({ icon, label, onClick, className }: Readonly<IconButtonProps>) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          onClick={onClick}
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), className)}
          aria-label={label}
        >
          {icon}
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
