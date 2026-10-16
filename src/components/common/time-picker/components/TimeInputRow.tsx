import { useRef } from "react";
import type { TimeInputRowProps } from "../types";
import { TimeSegmentInput } from "./TimeSegmentInput";

export function TimeInputRow({
  label,
  color,
  h,
  m,
  s,
  onH,
  onM,
  onS,
  disabled = false,
}: TimeInputRowProps) {
  const dotColor = color === "green" ? "bg-emerald-500" : "bg-amber-500";
  const mRef = useRef<HTMLDivElement>(null);
  const sRef = useRef<HTMLDivElement>(null);
  const focusFirst = (ref: React.RefObject<HTMLDivElement | null>) =>
    ref.current?.querySelector("input")?.focus();

  return (
    <div className={`flex flex-col gap-2 ${disabled ? "opacity-30 pointer-events-none" : ""}`}>
      <div className="flex items-center gap-1.5">
        <div className={`size-1.5 rounded-full ${dotColor} shrink-0`} />
        <span className="text-xs font-semibold text-text-secondary">{label}</span>
      </div>
      <div className="flex items-center gap-1">
        <TimeSegmentInput value={h} max={23} onChange={onH} onNext={() => focusFirst(mRef)} />
        <span className="text-text-muted font-bold text-base select-none mb-1">:</span>
        <div ref={mRef}>
          <TimeSegmentInput value={m} max={59} onChange={onM} onNext={() => focusFirst(sRef)} />
        </div>
        <span className="text-text-muted font-bold text-base select-none mb-1">:</span>
        <div ref={sRef}>
          <TimeSegmentInput value={s} max={59} onChange={onS} />
        </div>
      </div>
    </div>
  );
}
