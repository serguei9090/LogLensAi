import { Badge } from "@/components/ui/badge";

export type LogLevel = "ERROR" | "WARN" | "INFO" | "DEBUG" | "TRACE";

interface LogLevelBadgeProps {
  level: LogLevel;
  className?: string;
}

const levelStyles: Record<LogLevel, string> = {
  ERROR: "bg-error text-text-inverse hover:bg-error/80",
  WARN: "bg-warning text-text-inverse hover:bg-warning/80",
  INFO: "bg-info text-text-inverse hover:bg-info/80",
  DEBUG: "bg-debug text-text-inverse hover:bg-debug/80",
  TRACE: "bg-primary-muted text-text-primary hover:bg-primary-muted/80",
};

export function LogLevelBadge({ level, className }: LogLevelBadgeProps) {
  return (
    <Badge className={`${levelStyles[level]} ${className || ""}`} variant="outline">
      {level}
    </Badge>
  );
}
