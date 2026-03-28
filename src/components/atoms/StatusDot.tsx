import { cn } from "@/lib/utils";

interface StatusDotProps {
  active: boolean;
  className?: string;
}

export function StatusDot({ active, className }: StatusDotProps) {
  return (
    <div className={cn("relative flex h-3 w-3", className)}>
      {active && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
      )}
      <span
        className={cn(
          "relative inline-flex rounded-full h-3 w-3",
          active ? "bg-primary" : "bg-border",
        )}
      ></span>
    </div>
  );
}
