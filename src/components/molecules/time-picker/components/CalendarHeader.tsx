import { format } from "date-fns";
import { ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import type { MonthCaptionProps } from "react-day-picker";
import type { CalendarView } from "../types";

interface CalendarHeaderProps {
  readonly calendarMonth: MonthCaptionProps["calendarMonth"];
  readonly view: CalendarView;
  readonly onPrev?: () => void;
  readonly onNext?: () => void;
  readonly onToggleView: () => void;
}

/**
 * Adaptive header that transforms its label per view:
 * - days   →  "March 2026 ▾"  (clickable, arrows active)
 * - months →  "2026 ▾"        (clickable, arrows hidden — click to go to years)
 * - years  →  "Select Year"   (no toggle arrow, arrows hidden)
 */
export function CalendarHeader({
  calendarMonth,
  view,
  onPrev,
  onNext,
  onToggleView,
}: CalendarHeaderProps) {
  const isDays = view === "days";
  const isMonths = view === "months";

  const LABEL_BY_VIEW: Record<CalendarView, string> = {
    days: format(calendarMonth.date, "MMMM yyyy"),
    months: format(calendarMonth.date, "yyyy"),
    years: "Select Year",
  };
  const label = LABEL_BY_VIEW[view];
  const isClickable = isDays || isMonths;
  const showPrev = Boolean(onPrev);
  const showNext = Boolean(onNext);

  return (
    <div className="flex items-center justify-between w-full mb-2 pb-2 border-b border-white/5 px-1">
      <button
        type="button"
        onClick={onPrev}
        disabled={!onPrev}
        aria-hidden={!onPrev}
        className={[
          "h-8 w-8 rounded-md border flex items-center justify-center transition-all",
          showPrev
            ? "bg-black/30 border-border/20 text-text-muted hover:text-text-primary hover:bg-white/10"
            : "border-transparent text-transparent pointer-events-none select-none",
        ].join(" ")}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Label transforms per view */}
      <button
        type="button"
        onClick={isClickable ? onToggleView : undefined}
        className={[
          "flex items-center justify-center gap-1.5 px-2 py-1 rounded-md text-sm font-semibold transition-colors flex-1",
          isClickable
            ? "hover:bg-white/8 hover:text-primary group cursor-pointer"
            : "cursor-default text-text-muted",
        ].join(" ")}
      >
        <span className={isMonths ? "text-primary" : ""}>{label}</span>
        {isClickable && (
          <ChevronsUpDown className="size-3 text-text-muted group-hover:text-primary transition-colors" />
        )}
      </button>

      <button
        type="button"
        onClick={onNext}
        disabled={!onNext}
        aria-hidden={!onNext}
        className={[
          "h-8 w-8 rounded-md border flex items-center justify-center transition-all",
          showNext
            ? "bg-black/30 border-border/20 text-text-muted hover:text-text-primary hover:bg-white/10"
            : "border-transparent text-transparent pointer-events-none select-none",
        ].join(" ")}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
