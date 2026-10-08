import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

interface SelectionPreviewProps {
  readonly range: DateRange | undefined;
  readonly startH: number;
  readonly startM: number;
  readonly startS: number;
  readonly endH: number;
  readonly endM: number;
  readonly endS: number;
}

export function SelectionPreview({
  range,
  startH,
  startM,
  startS,
  endH,
  endM,
  endS,
}: SelectionPreviewProps) {
  return (
    <div className="mt-4 pt-4 border-t border-border/10 bg-white/[0.01] rounded-lg p-3 grid grid-cols-2 gap-6">
      <div className="flex flex-col gap-1 border-r border-border/10">
        <div className="flex items-center gap-1.5 grayscale opacity-50">
          <div className="size-1.5 rounded-full bg-emerald-500" />
          <span className="text-xs font-bold uppercase tracking-wide">Start Selection</span>
        </div>
        <div className="pl-3 text-xs font-mono text-text-primary">
          {range?.from ? (
            <>
              <span className="text-emerald-400/80 ">{format(range.from, "MMM d, yyyy")}</span>
              <span className="mx-2 text-text-muted opacity-30">@</span>
              <span className="text-text-secondary">
                {String(startH).padStart(2, "0")}:{String(startM).padStart(2, "0")}:
                {String(startS).padStart(2, "0")}
              </span>
            </>
          ) : (
            <span className="text-text-muted italic">No start date selected</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 grayscale opacity-50">
          <div className="size-1.5 rounded-full bg-amber-500" />
          <span className="text-xs font-bold uppercase tracking-wide">End Selection</span>
        </div>
        <div className="pl-3 text-xs font-mono text-text-primary">
          {range?.to ? (
            <>
              <span className="text-amber-400/80">{format(range.to, "MMM d, yyyy")}</span>
              <span className="mx-2 text-text-muted opacity-30">@</span>
              <span className="text-text-secondary">
                {String(endH).padStart(2, "0")}:{String(endM).padStart(2, "0")}:
                {String(endS).padStart(2, "0")}
              </span>
            </>
          ) : (
            <span
              className={[
                "text-amber-400/60 font-semibold animate-pulse",
                range?.from ? "" : "grayscale opacity-50 italic animate-none",
              ].join(" ")}
            >
              {range?.from ? "Streaming (Now)" : "Waiting for date..."}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
