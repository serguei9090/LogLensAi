import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  format,
  subMinutes,
  subHours,
  subDays,
  startOfDay,
  setMonth as dateFnsSetMonth,
  setYear as dateFnsSetYear,
  getYear,
  getMonth,
  addMonths as dateFnsAddMonths,
  subMonths as dateFnsSubMonths,
} from "date-fns";
import {
  Clock,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from "lucide-react";
import { useState, useMemo, useCallback, useRef } from "react";
import { DayPicker, type DateRange, type MonthCaptionProps } from "react-day-picker";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimeRange {
  start: string; // ISO
  end: string;   // ISO or empty
  label?: string;
}

interface TimeRangePickerProps {
  readonly value: TimeRange;
  readonly onChange: (range: TimeRange) => void;
  readonly className?: string;
}

interface TimeSegmentInputProps {
  readonly value: number;
  readonly max: number;
  readonly onChange: (v: number) => void;
  readonly onNext?: () => void;
  readonly onPrev?: () => void;
}

interface TimeInputRowProps {
  readonly label: string;
  readonly color: "green" | "amber";
  readonly h: number;
  readonly m: number;
  readonly s: number;
  readonly onH: (v: number) => void;
  readonly onM: (v: number) => void;
  readonly onS: (v: number) => void;
  readonly disabled?: boolean;
}

type CalendarView = "days" | "months" | "years";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESETS = [
  { label: "Last 15 min",  getValue: () => ({ start: subMinutes(new Date(), 15).toISOString(), end: "" }) },
  { label: "Last 1 hour",  getValue: () => ({ start: subHours(new Date(), 1).toISOString(),    end: "" }) },
  { label: "Last 4 hours", getValue: () => ({ start: subHours(new Date(), 4).toISOString(),    end: "" }) },
  { label: "Last 24 hrs",  getValue: () => ({ start: subHours(new Date(), 24).toISOString(),   end: "" }) },
  { label: "Last 7 days",  getValue: () => ({ start: subDays(new Date(), 7).toISOString(),     end: "" }) },
  { label: "Today",        getValue: () => ({ start: startOfDay(new Date()).toISOString(),      end: "" }) },
] as const;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ─── TimeSegmentInput ─────────────────────────────────────────────────────────

function TimeSegmentInput({ value, max, onChange, onNext }: TimeSegmentInputProps) {
  const pendingRef = useRef<string>("");
  const clamp = (v: number) => Math.max(0, Math.min(max, v));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp")   { e.preventDefault(); onChange(clamp(value + 1)); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); onChange(clamp(value - 1)); return; }
    if (e.key === "Backspace") { pendingRef.current = pendingRef.current.slice(0, -1); return; }
    if (/^\d$/.test(e.key)) {
      e.preventDefault();
      const next = (pendingRef.current + e.key).slice(-2);
      pendingRef.current = next;
      const n = Number.parseInt(next, 10);
      if (!Number.isNaN(n)) {
        onChange(clamp(n));
        if (next.length === 2 && onNext) setTimeout(onNext, 0);
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
        onChange={() => { /* controlled via keydown */ }}
        onBlur={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) onChange(clamp(n));
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

// ─── TimeInputRow ─────────────────────────────────────────────────────────────

function TimeInputRow({ label, color, h, m, s, onH, onM, onS, disabled = false }: TimeInputRowProps) {
  const dotColor = color === "green" ? "bg-emerald-500" : "bg-amber-500";
  const mRef = useRef<HTMLDivElement>(null);
  const sRef = useRef<HTMLDivElement>(null);
  const focusFirst = (ref: React.RefObject<HTMLDivElement | null>) =>
    ref.current?.querySelector("input")?.focus();

  return (
    <div className={`flex flex-col gap-2 ${disabled ? "opacity-30 pointer-events-none" : ""}`}>
      <div className="flex items-center gap-1.5">
        <div className={`size-1.5 rounded-full ${dotColor} shrink-0`} />
        <span className="text-[11px] font-semibold text-text-secondary">{label}</span>
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

// ─── MonthGrid ────────────────────────────────────────────────────────────────

interface MonthGridProps {
  readonly currentMonth: number;
  readonly currentYear: number;
  readonly onSelectMonth: (m: number) => void;
  readonly onSelectYear: () => void;
}

/**
 * Month selector grid — header handles the year drilldown, no duplicate here.
 */
function MonthGrid({ currentMonth, onSelectMonth }: Omit<MonthGridProps, "currentYear" | "onSelectYear">) {
  return (
    <div className="w-[252px] animate-in fade-in zoom-in-95 duration-150">
      <div className="grid grid-cols-3 gap-2 p-1">
        {MONTH_NAMES.map((name, i) => (
          <button
            key={name}
            type="button"
            onClick={() => onSelectMonth(i)}
            className={[
              "h-11 w-full text-xs font-semibold rounded-lg transition-all",
              i === currentMonth
                ? "bg-primary text-text-inverse shadow-[0_0_12px_rgba(34,197,94,0.25)]"
                : "text-text-secondary hover:bg-white/8 hover:text-text-primary",
            ].join(" ")}
          >
            {name.slice(0, 3)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── YearGrid ─────────────────────────────────────────────────────────────────

interface YearGridProps {
  readonly currentYear: number;
  readonly onSelectYear: (y: number) => void;
}

function YearGrid({ currentYear, onSelectYear }: YearGridProps) {
  // Show 12 years centred on current
  const startYear = currentYear - 5;
  const years = Array.from({ length: 12 }, (_, i) => startYear + i);

  return (
    <div className="w-[252px] animate-in fade-in zoom-in-95 duration-150">
      <div className="grid grid-cols-3 gap-2 p-1">
        {years.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => onSelectYear(y)}
            className={[
              "h-11 w-full text-xs font-semibold rounded-lg transition-all",
              y === currentYear
                ? "bg-primary text-text-inverse shadow-[0_0_12px_rgba(34,197,94,0.25)]"
                : "text-text-secondary hover:bg-white/8 hover:text-text-primary",
            ].join(" ")}
          >
            {y}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── CalendarHeader ───────────────────────────────────────────────────────────

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
function CalendarHeader({ calendarMonth, view, onPrev, onNext, onToggleView }: CalendarHeaderProps) {
  const isDays   = view === "days";
  const isMonths = view === "months";

  const LABEL_BY_VIEW: Record<CalendarView, string> = {
    days:   format(calendarMonth.date, "MMMM yyyy"),
    months: format(calendarMonth.date, "yyyy"),
    years:  "Select Year",
  };
  const label       = LABEL_BY_VIEW[view];
  const isClickable = isDays || isMonths;
  const showPrev    = isDays ? Boolean(onPrev) : isClickable;
  const showNext    = isDays ? Boolean(onNext) : isClickable;

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
          isClickable ? "hover:bg-white/8 hover:text-primary group cursor-pointer" : "cursor-default text-text-muted",
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

// ─── TimeRangePicker ──────────────────────────────────────────────────────────

/**
 * Professional temporal filter widget.
 *
 * Navigation UX (Material/iOS Pattern):
 * - Header: [ < ] [ March 2026 ▾ ] [ > ]  (single combined button)
 * - Click label → Month grid (year shown at top as drilldown link)
 * - Click year  → Year grid
 * - Select month or year → returns to days view
 */
export function TimeRangePicker({ value, onChange, className }: TimeRangePickerProps) {
  const [open, setOpen]   = useState(false);
  const [view, setView]   = useState<CalendarView>("days");
  const [activeSide, setActiveSide] = useState<"left" | "right">("left");
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const from = value.start ? new Date(value.start) : undefined;
    const to   = value.end   ? new Date(value.end)   : undefined;
    return from ? { from, to } : undefined;
  });

  const nowRef = new Date();
  const [startH, setStartH] = useState(() => value.start ? new Date(value.start).getHours()   : 0);
  const [startM, setStartM] = useState(() => value.start ? new Date(value.start).getMinutes() : 0);
  const [startS, setStartS] = useState(() => value.start ? new Date(value.start).getSeconds() : 0);
  const [endH,   setEndH]   = useState(() => value.end   ? new Date(value.end).getHours()     : nowRef.getHours());
  const [endM,   setEndM]   = useState(() => value.end   ? new Date(value.end).getMinutes()   : nowRef.getMinutes());
  const [endS,   setEndS]   = useState(() => value.end   ? new Date(value.end).getSeconds()   : nowRef.getSeconds());

  const [monthLeft, setMonthLeft]   = useState<Date>(() => value.start ? new Date(value.start) : new Date());
  const [monthRight, setMonthRight] = useState<Date>(() => value.end ? new Date(value.end) : dateFnsAddMonths(new Date(), 1));

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleOpenChange = useCallback((next: boolean) => {
    if (next) {
      const from = value.start ? new Date(value.start) : undefined;
      const to   = value.end   ? new Date(value.end)   : undefined;
      setRange(from ? { from, to } : undefined);
      if (from) { setStartH(from.getHours()); setStartM(from.getMinutes()); setStartS(from.getSeconds()); }
      else       { setStartH(0); setStartM(0); setStartS(0); }
      const n = new Date();
      if (to) { setEndH(to.getHours()); setEndM(to.getMinutes()); setEndS(to.getSeconds()); }
      else    { setEndH(n.getHours()); setEndM(n.getMinutes()); setEndS(n.getSeconds()); }
      
      const left  = from ?? new Date();
      const right = to   ?? dateFnsAddMonths(left, 1);
      setMonthLeft(left);
      setMonthRight(right);
      setView("days");
      setActiveSide("left");
    }
    setOpen(next);
  }, [value]);

  const handleApply = useCallback(() => {
    if (!range?.from) return;
    const start = new Date(range.from);
    start.setHours(startH, startM, startS, 0);
    let endStr = "";
    if (range.to) {
      const end = new Date(range.to);
      end.setHours(endH, endM, endS, 0);
      endStr = end.toISOString();
    }
    onChange({ start: start.toISOString(), end: endStr });
    setOpen(false);
  }, [range, startH, startM, startS, endH, endM, endS, onChange]);

  const handlePreset = useCallback((preset: typeof PRESETS[number]) => {
    const r = preset.getValue();
    onChange({ ...r, label: preset.label });
    setOpen(false);
  }, [onChange]);

  /** Cycles forward: days → months → years. */
  const handleToggleView = useCallback((side: "left" | "right") => {
    setActiveSide(side);
    setView((v) => {
      if (v === "days")   return "months";
      if (v === "months") return "years";
      return "days";
    });
  }, []);


  const handleMonthSelect = useCallback((m: number) => {
    const setter = activeSide === "left" ? setMonthLeft : setMonthRight;
    setter((prev) => dateFnsSetMonth(prev, m));
    setView("days");
  }, [activeSide]);

  const handleYearSelect = useCallback((y: number) => {
    const setter = activeSide === "left" ? setMonthLeft : setMonthRight;
    setter((prev) => dateFnsSetYear(prev, y));
    setView("months");
  }, [activeSide]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const displayText = useMemo(() => {
    if (value.label) return value.label;
    if (!value.start) return "All Time";
    const s = format(new Date(value.start), "MMM d, yyyy HH:mm:ss");
    const e = value.end ? format(new Date(value.end), "MMM d, yyyy HH:mm:ss") : "now";
    return `${s} → ${e}`;
  }, [value]);

  const hasEndDate = Boolean(range?.to);

  const commonPickerProps = {
    mode: "range" as const,
    selected: range,
    onSelect: setRange,
    className: "p-0 select-none",
    classNames: {
      months: "flex flex-col",
      month: "space-y-0",
      month_caption: "mb-2",
      caption_label: "hidden",
      nav: "hidden",
      month_grid: "w-full border-collapse",
      weekdays: "flex mb-1",
      weekday: "w-9 text-center text-[10px] font-bold text-text-muted uppercase tracking-wider",
      week: "flex transition-colors",
      day: "h-9 w-9 relative",
      day_button: "h-9 w-9 text-xs font-medium rounded-none transition-colors hover:bg-primary/20 hover:text-primary",
      range_start: "bg-primary/20 rounded-l-full [&>button]:bg-primary [&>button]:text-text-inverse [&>button]:rounded-full [&>button]:font-bold",
      range_end:   "bg-primary/20 rounded-r-full [&>button]:bg-primary [&>button]:text-text-inverse [&>button]:rounded-full [&>button]:font-bold",
      range_middle:"bg-primary/10 [&>button]:text-primary [&>button]:rounded-none",
      selected:    "[&>button]:bg-primary [&>button]:text-text-inverse [&>button]:rounded-full [&>button]:font-bold",
      today:       "[&>button]:ring-1 [&>button]:ring-primary/50",
      outside:     "opacity-30",
      disabled:    "opacity-20 cursor-not-allowed",
      hidden:      "invisible",
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger className="h-8 inline-flex items-center gap-2 rounded-md border border-border/40 bg-black/40 px-3 text-xs font-medium transition-all hover:bg-black/60 hover:border-border/60 group">
          <Clock className="size-3.5 text-text-muted group-hover:text-primary transition-colors" />
          <span className="text-text-secondary group-hover:text-text-primary transition-colors max-w-[400px] truncate">
            {displayText}
          </span>
        </PopoverTrigger>

        <PopoverContent
          className="p-0 bg-[#0d0f0e] border-border/40 shadow-2xl rounded-xl overflow-hidden"
          style={{ width: "auto" }}
          align="start"
        >
          <div className="flex">
            {/* ── 1. Presets ────────────────────────────────── */}
            <div className="w-[140px] border-r border-border/20 p-2 space-y-0.5 bg-white/[0.02] shrink-0">
              <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted opacity-50">
                Quick Select
              </p>
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handlePreset(p)}
                  className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:text-primary hover:bg-primary/10 rounded-md transition-all"
                >
                  {p.label}
                </button>
              ))}
              <div className="pt-2 mt-1 border-t border-border/10">
                <button
                  type="button"
                  onClick={() => { onChange({ start: "", end: "" }); setOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-text-muted hover:text-text-primary hover:bg-white/5 rounded-md transition-all flex items-center gap-2"
                >
                  <RotateCcw className="size-3" />
                  Reset
                </button>
              </div>
            </div>

            {/* ── 2. Calendar ───────────────────────────────── */}
            <div className="p-4 border-r border-border/20 shrink-0 flex flex-col" style={{ minWidth: "600px" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted opacity-50 mb-3">
                Range Selection
              </p>

              <div className="flex-1 flex flex-col">
                <div className="flex-1">
                  {/* Days view (Individual Pickers for true Independence) */}
                  {view === "days" && (
                    <div className="grid grid-cols-2 gap-10">
                      <DayPicker
                        {...commonPickerProps}
                        month={monthLeft}
                        onMonthChange={setMonthLeft}
                        components={{
                          MonthCaption: ({ calendarMonth }: MonthCaptionProps) => (
                            <CalendarHeader
                              calendarMonth={calendarMonth}
                              view={view}
                              onPrev={() => setMonthLeft((m) => dateFnsSubMonths(m, 1))}
                              onNext={() => setMonthLeft((m) => dateFnsAddMonths(m, 1))}
                              onToggleView={() => handleToggleView("left")}
                            />
                          )
                        }}
                      />
                      <DayPicker
                        {...commonPickerProps}
                        month={monthRight}
                        onMonthChange={setMonthRight}
                        components={{
                          MonthCaption: ({ calendarMonth }: MonthCaptionProps) => (
                            <CalendarHeader
                              calendarMonth={calendarMonth}
                              view={view}
                              onPrev={() => setMonthRight((m) => dateFnsSubMonths(m, 1))}
                              onNext={() => setMonthRight((m) => dateFnsAddMonths(m, 1))}
                              onToggleView={() => handleToggleView("right")}
                            />
                          )
                        }}
                      />
                    </div>
                  )}

                  {/* Month selector (Individual) */}
                  {view === "months" && (
                    <div className="flex flex-col items-center">
                      <CalendarHeader
                        calendarMonth={{ date: activeSide === "left" ? monthLeft : monthRight } as MonthCaptionProps["calendarMonth"]}
                        view={view}
                        onPrev={() => {
                          const setter = activeSide === "left" ? setMonthLeft : setMonthRight;
                          setter((m) => dateFnsSetYear(m, getYear(m) - 1));
                        }}
                        onNext={() => {
                          const setter = activeSide === "left" ? setMonthLeft : setMonthRight;
                          setter((m) => dateFnsSetYear(m, getYear(m) + 1));
                        }}
                        onToggleView={() => handleToggleView(activeSide)}
                      />
                      <MonthGrid
                        currentMonth={getMonth(activeSide === "left" ? monthLeft : monthRight)}
                        onSelectMonth={handleMonthSelect}
                      />
                    </div>
                  )}

                  {/* Year selector (Individual) */}
                  {view === "years" && (
                    <div className="flex flex-col items-center">
                      <CalendarHeader
                        calendarMonth={{ date: activeSide === "left" ? monthLeft : monthRight } as MonthCaptionProps["calendarMonth"]}
                        view={view}
                        onPrev={() => {
                          const setter = activeSide === "left" ? setMonthLeft : setMonthRight;
                          setter((m) => dateFnsSetYear(m, getYear(m) - 5));
                        }}
                        onNext={() => {
                          const setter = activeSide === "left" ? setMonthLeft : setMonthRight;
                          setter((m) => dateFnsSetYear(m, getYear(m) + 5));
                        }}
                        onToggleView={() => handleToggleView(activeSide)}
                      />
                      <YearGrid
                        currentYear={getYear(activeSide === "left" ? monthLeft : monthRight)}
                        onSelectYear={handleYearSelect}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* ── Selection Preview ── */}
              <div className="mt-4 pt-4 border-t border-border/10 bg-white/[0.01] rounded-lg p-3 grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-1 border-r border-border/10">
                  <div className="flex items-center gap-1.5 grayscale opacity-50">
                    <div className="size-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wide">Start Selection</span>
                  </div>
                  <div className="pl-3 text-xs font-mono text-text-primary">
                    {range?.from ? (
                      <>
                        <span className="text-emerald-400/80 ">{format(range.from, "MMM d, yyyy")}</span>
                        <span className="mx-2 text-text-muted opacity-30">@</span>
                        <span className="text-text-secondary">
                          {String(startH).padStart(2, "0")}:{String(startM).padStart(2, "0")}:{String(startS).padStart(2, "0")}
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
                    <span className="text-[10px] font-bold uppercase tracking-wide">End Selection</span>
                  </div>
                  <div className="pl-3 text-xs font-mono text-text-primary">
                    {range?.to ? (
                      <>
                        <span className="text-amber-400/80">{format(range.to, "MMM d, yyyy")}</span>
                        <span className="mx-2 text-text-muted opacity-30">@</span>
                        <span className="text-text-secondary">
                          {String(endH).padStart(2, "0")}:{String(endM).padStart(2, "0")}:{String(endS).padStart(2, "0")}
                        </span>
                      </>
                    ) : (
                      <span className={[
                        "text-amber-400/60 font-semibold animate-pulse",
                        range?.from ? "" : "grayscale opacity-50 italic animate-none"
                      ].join(" ")}>
                        {range?.from ? "Streaming (Now)" : "Waiting for date..."}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── 3. Time Controls ──────────────────────────── */}
            <div className="flex flex-col p-4 gap-5" style={{ minWidth: "168px" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted opacity-50">
                Time (HH:MM:SS)
              </p>

              <TimeInputRow
                label="Start"
                color="green"
                h={startH} m={startM} s={startS}
                onH={setStartH} onM={setStartM} onS={setStartS}
              />

              <div className="border-t border-border/10" />

              <TimeInputRow
                label={hasEndDate ? "End" : "End (pick date)"}
                color="amber"
                h={endH} m={endM} s={endS}
                onH={setEndH} onM={setEndM} onS={setEndS}
                disabled={!hasEndDate}
              />

              <p className="text-[9px] text-text-muted/50 italic text-center leading-tight mt-auto">
                {hasEndDate ? "Precise end point" : "Streaming (Now)"}
              </p>

              <div className="flex flex-col gap-2 pt-2 border-t border-border/10">
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={!range?.from}
                  className="w-full h-8 rounded-md bg-primary text-text-inverse text-xs font-bold transition-all hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Set Window
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full h-8 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
