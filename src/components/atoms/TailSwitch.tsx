import { cn } from "@/lib/utils";

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
  label = "Tail",
  className,
}: TailSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200 select-none cursor-pointer",
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
      {label}
    </button>
  );
}
