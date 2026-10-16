import { ChevronDown, ChevronUp } from "lucide-react";
import { useRef } from "react";
import type { TimeSegmentInputProps } from "../types";

export function TimeSegmentInput({ value, max, onChange, onNext }: TimeSegmentInputProps) {
  const pendingRef = useRef<string>("");
  const clamp = (v: number) => Math.max(0, Math.min(max, v));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onChange(clamp(value + 1));
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      onChange(clamp(value - 1));
      return;
    }
    if (e.key === "Backspace") {
      pendingRef.current = pendingRef.current.slice(0, -1);
      return;
    }
    if (/^\d$/.test(e.key)) {
      e.preventDefault();
      const next = (pendingRef.current + e.key).slice(-2);
      pendingRef.current = next;
      const n = Number.parseInt(next, 10);
      if (!Number.isNaN(n)) {
        onChange(clamp(n));
        if (next.length === 2 && onNext) {
          setTimeout(onNext, 0);
        }
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    onChange(clamp(value + (e.deltaY < 0 ? 1 : -1)));
  };

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        tabIndex={-1}
        onClick={() => onChange(clamp(value + 1))}
        className="w-7 h-5 flex items-center justify-center text-text-muted hover:text-primary rounded transition-colors"
      >
        <ChevronUp className="size-3" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={String(value).padStart(2, "0")}
        onFocus={(e) => e.target.select()}
        onKeyDown={handleKeyDown}
        onWheel={handleWheel}
        onChange={() => {
          /* controlled via keydown */
        }}
        onBlur={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) {
            onChange(clamp(n));
          }
          pendingRef.current = "";
        }}
        className={[
          "w-8 h-8 text-center text-sm font-mono font-semibold rounded-md",
          "bg-black/40 border border-border/30 text-text-primary",
          "focus:outline-none focus:ring-1 focus:ring-primary/60 focus:border-primary/60",
          "transition-all cursor-text",
        ].join(" ")}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => onChange(clamp(value - 1))}
        className="w-7 h-5 flex items-center justify-center text-text-muted hover:text-primary rounded transition-colors"
      >
        <ChevronDown className="size-3" />
      </button>
    </div>
  );
}
