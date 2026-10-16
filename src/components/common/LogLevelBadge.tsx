import { Badge } from "@/components/ui/badge";

import type { LogLevel } from "@/types/log";

interface LogLevelBadgeProps {
  level: LogLevel;
  className?: string;
}

const levelStyles: Record<LogLevel, string> = {
  ERROR: "bg-error text-text-inverse hover:bg-error/80",
  FATAL:
    "bg-error text-text-inverse hover:bg-error/80 border-2 border-white/20 shadow-[0_0_10px_rgba(239,68,68,0.5)]",
  CRITICAL: "bg-error text-text-inverse hover:bg-error/80",
  WARN: "bg-warning text-text-inverse hover:bg-warning/80",
  INFO: "bg-info text-text-inverse hover:bg-info/80",
  DEBUG: "bg-debug text-text-inverse hover:bg-debug/80",
  TRACE: "bg-primary-muted text-text-primary hover:bg-primary-muted/80",
  VERBOSE: "bg-primary-muted text-text-primary hover:bg-primary-muted/80 opacity-70",
};

export function LogLevelBadge({ level, className }: LogLevelBadgeProps) {
  return (
    <Badge className={`${levelStyles[level]} ${className || ""}`} variant="outline">
      {level}
    </Badge>
  );
}
