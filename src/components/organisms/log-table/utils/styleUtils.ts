import type { LogLevel } from "@/types/log";

export function getRowLevelStyles(level: LogLevel): string {
  switch (level) {
    case "FATAL":
    case "CRITICAL":
    case "ERROR":
      return "bg-error/5 border-l-2 border-error hover:bg-error/10";
    case "WARN":
      return "bg-warning/5 border-l-2 border-warning hover:bg-warning/10";
    case "INFO":
      return "bg-info/3 hover:bg-info/8 text-info/90";
    case "DEBUG":
      return "bg-debug/2 hover:bg-debug/5 text-debug/80";
    case "TRACE":
    case "VERBOSE":
      return "bg-primary-muted/5 border-l-2 border-primary-muted/30 hover:bg-primary-muted/10";
    default:
      return "hover:bg-bg-hover";
  }
}

export function getClusterStyles(
  clusterId: string,
  anomalousClusters?: Set<string>,
): string {
  if (clusterId === "unknown") {
    return "bg-zinc-800/50 border-zinc-700/30 text-zinc-500";
  }

  if (anomalousClusters?.has(clusterId)) {
    return "bg-orange-500/20 border-orange-500/40 text-orange-400 hover:bg-orange-500/30";
  }

  return "bg-primary/10 border-primary/20 text-primary hover:bg-primary/20";
}
