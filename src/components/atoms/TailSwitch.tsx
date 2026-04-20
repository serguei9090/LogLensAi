import { cn } from "@/lib/utils";
import { Radio } from "lucide-react";

interface TailSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  className?: string;
}

/** Modern pill-style Live Tail toggle with pulsing dot indicator */
export function TailSwitch({
  checked,
  onCheckedChange,
  label = "Live Tail",
  className,
}: TailSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 select-none cursor-pointer",
        checked
          ? "border-emerald-500/40 bg-emerald-950/60 text-emerald-400 shadow-[0_0_12px_0_rgba(52,211,153,0.15)]"
          : "border-zinc-700 bg-zinc-900 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400",
        className,
      )}
    >
      {/* Pulsing dot */}
      <span className="relative flex h-2 w-2 shrink-0">
        {checked && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        )}
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full transition-colors",
            checked ? "bg-emerald-400" : "bg-zinc-600",
          )}
        />
      </span>
      <Radio className={cn("h-3 w-3", checked ? "text-emerald-400" : "text-zinc-600")} />
      {label}
      <span
        className={cn(
          "ml-1 rounded px-1 py-0.5 text-[10px] font-bold tracking-wide transition-colors",
          checked ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-800 text-zinc-600",
        )}
      >
        {checked ? "ON" : "OFF"}
      </span>
    </button>
  );
}
