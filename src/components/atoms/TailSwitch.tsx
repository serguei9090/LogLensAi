import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { FileText, HardDrive, Radio, Server, Shuffle, TriangleAlert } from "lucide-react";

export type TailSourceType = "local" | "ssh" | "manual" | "fusion" | "live";

interface TailSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  sourceType?: TailSourceType;
  isFileMissing?: boolean;
  sourceName?: string;
  className?: string;
  disabled?: boolean;
}

/** Modern pill-style Live Tail toggle with pulsing dot indicator, micro source chip, and rich tooltips */
export function TailSwitch({
  checked,
  onCheckedChange,
  label = "Tail",
  sourceType = "local",
  isFileMissing = false,
  sourceName,
  className,
  disabled = false,
}: TailSwitchProps) {
  // Determine if streaming is supported for this source
  const isStatic = sourceType === "manual";
  const isUnavailable = isFileMissing || isStatic;
  const effectiveDisabled = disabled || isUnavailable;

  // Resolve micro chip icon and tooltip text based on source type & availability
  const getBadgeConfig = () => {
    if (isFileMissing) {
      return {
        icon: <TriangleAlert className="size-2.5 text-amber-400" />,
        chipBg: "bg-amber-950/80 border-amber-500/40 text-amber-300",
        label: "Missing",
        tooltipTitle: "File Missing on Disk",
        tooltipDesc:
          "The original file was deleted or moved. Viewing indexed historical records from DuckDB.",
      };
    }
    switch (sourceType) {
      case "ssh":
        return {
          icon: <Server className="size-2.5 text-cyan-400" />,
          chipBg: "bg-cyan-950/80 border-cyan-500/40 text-cyan-300",
          label: "SSH",
          tooltipTitle: checked ? "SSH Remote Tail: Connected" : "SSH Remote Tail: Standby",
          tooltipDesc: checked
            ? "Live SSH stdout stream active. Click to disconnect and conserve remote resources."
            : "Click to establish SSH connection and stream remote log appends.",
        };
      case "live":
        return {
          icon: <Radio className="size-2.5 text-violet-400" />,
          chipBg: "bg-violet-950/80 border-violet-500/40 text-violet-300",
          label: "Stream",
          tooltipTitle: checked ? "Live Ingestion: Streaming" : "Live Ingestion: Paused",
          tooltipDesc: checked
            ? "Incoming push events actively updating the view. Click to pause real-time rendering."
            : "Live rendering paused. Incoming events continue buffering. Click to resume.",
        };
      case "fusion":
        return {
          icon: <Shuffle className="size-2.5 text-purple-400" />,
          chipBg: "bg-purple-950/80 border-purple-500/40 text-purple-300",
          label: "Fusion",
          tooltipTitle: checked ? "Fusion Stream: Active" : "Fusion Stream: Standby",
          tooltipDesc: checked
            ? "Live multi-stream orchestration active across composite sources."
            : "Click to start live tailing composite sources.",
        };
      case "manual":
        return {
          icon: <FileText className="size-2.5 text-zinc-400" />,
          chipBg: "bg-zinc-800/80 border-zinc-700 text-zinc-400",
          label: "Static",
          tooltipTitle: "Static Snapshot",
          tooltipDesc: "Pasted or manually imported log dump. Real-time tailing is not applicable.",
        };
      default:
        return {
          icon: <HardDrive className="size-2.5 text-emerald-400" />,
          chipBg: "bg-emerald-950/80 border-emerald-500/40 text-emerald-300",
          label: "File",
          tooltipTitle: checked ? "Live Tail: Active" : "Live Tail: Inactive",
          tooltipDesc: checked
            ? "Watching file on disk for newly appended lines. Click to pause."
            : "Click to tail this file and stream newly appended lines in real time.",
        };
    }
  };

  const badge = getBadgeConfig();

  return (
    <TooltipProvider delay={100}>
      <Tooltip>
        <TooltipTrigger
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={effectiveDisabled}
          onClick={() => {
            if (!effectiveDisabled) {
              onCheckedChange(!checked);
            }
          }}
          className={cn(
            "relative inline-flex items-center gap-1.5 rounded-full border pl-2 pr-1.5 py-0.5 text-xs font-semibold transition-all duration-200 select-none cursor-pointer outline-none",
            checked && !effectiveDisabled
              ? "border-emerald-500/40 bg-emerald-950/60 text-emerald-400 shadow-[0_0_12px_0_rgba(52,211,153,0.15)] hover:bg-emerald-900/60"
              : "border-zinc-700/80 bg-zinc-900/90 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300",
            effectiveDisabled &&
              "opacity-60 cursor-not-allowed hover:border-zinc-700/80 hover:text-zinc-400",
            className,
          )}
        >
          {/* Status Dot */}
          <span className="relative flex h-2 w-2 shrink-0">
            {checked && !effectiveDisabled && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            )}
            <span
              className={cn(
                "relative inline-flex h-2 w-2 rounded-full transition-colors",
                effectiveDisabled ? "bg-zinc-600" : checked ? "bg-emerald-400" : "bg-zinc-600",
              )}
            />
          </span>

          {/* Stable Label */}
          <span className="leading-none">{label}</span>

          {/* Micro Transport Chip */}
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-mono uppercase font-bold tracking-wider leading-none shadow-xs shrink-0",
              badge.chipBg,
            )}
          >
            {badge.icon}
            <span>{badge.label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          className="max-w-xs p-2.5 bg-bg-surface-bright/95 border-border shadow-2xl backdrop-blur-md"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-text-primary">
              {badge.icon}
              <span>{badge.tooltipTitle}</span>
            </div>
            {sourceName && (
              <p className="text-[10px] text-text-muted font-mono truncate max-w-[220px]">
                Source: {sourceName}
              </p>
            )}
            <p className="text-[11px] text-text-secondary leading-snug">{badge.tooltipDesc}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
