import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  addMonths as dateFnsAddMonths,
  setMonth as dateFnsSetMonth,
  setYear as dateFnsSetYear,
  subMonths as dateFnsSubMonths,
  format,
  getMonth,
  getYear,
} from "date-fns";
import { Clock } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { type DateRange, DayPicker, type MonthCaptionProps } from "react-day-picker";
import { CalendarHeader } from "./components/CalendarHeader";
import { MonthGrid } from "./components/MonthGrid";
import { PresetsSidebar } from "./components/PresetsSidebar";
import { SelectionPreview } from "./components/SelectionPreview";
import { TimeControls } from "./components/TimeControls";
import { YearGrid } from "./components/YearGrid";
import type { PRESETS } from "./constants";
import type { CalendarView, TimeRangePickerProps } from "./types";
import { toNominalISO } from "./utils";

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
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<CalendarView>("days");
  const [activeSide, setActiveSide] = useState<"left" | "right">("left");
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const from = value.start ? new Date(value.start) : undefined;
    const to = value.end ? new Date(value.end) : undefined;
    return from ? { from, to } : undefined;
  });

  const nowRef = new Date();
  const [startH, setStartH] = useState(() => (value.start ? new Date(value.start).getHours() : 0));
  const [startM, setStartM] = useState(() =>
    value.start ? new Date(value.start).getMinutes() : 0,
  );
  const [startS, setStartS] = useState(() =>
    value.start ? new Date(value.start).getSeconds() : 0,
  );
  const [endH, setEndH] = useState(() =>
    value.end ? new Date(value.end).getHours() : nowRef.getHours(),
  );
  const [endM, setEndM] = useState(() =>
    value.end ? new Date(value.end).getMinutes() : nowRef.getMinutes(),
  );
  const [endS, setEndS] = useState(() =>
    value.end ? new Date(value.end).getSeconds() : nowRef.getSeconds(),
  );

  const [monthLeft, setMonthLeft] = useState<Date>(() =>
    value.start ? new Date(value.start) : new Date(),
  );
  const [monthRight, setMonthRight] = useState<Date>(() =>
    value.end ? new Date(value.end) : dateFnsAddMonths(new Date(), 1),
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        const from = value.start ? new Date(value.start) : undefined;
        const to = value.end ? new Date(value.end) : undefined;
        setRange(from ? { from, to } : undefined);
        if (from) {
          setStartH(from.getHours());
          setStartM(from.getMinutes());
          setStartS(from.getSeconds());
        } else {
          setStartH(0);
          setStartM(0);
          setStartS(0);
        }
        const n = new Date();
        if (to) {
          setEndH(to.getHours());
          setEndM(to.getMinutes());
          setEndS(to.getSeconds());
        } else {
          setEndH(n.getHours());
          setEndM(n.getMinutes());
          setEndS(n.getSeconds());
        }

        const left = from ?? new Date();
        const right = to ?? dateFnsAddMonths(left, 1);
        setMonthLeft(left);
        setMonthRight(right);
        setView("days");
        setActiveSide("left");
      }
      setOpen(next);
    },
    [value],
  );

  const handleApply = useCallback(() => {
    if (!range?.from) {
      return;
    }
    const start = new Date(range.from);
    start.setHours(startH, startM, startS, 0);
    let endStr = "";
    if (range.to) {
      const end = new Date(range.to);
      end.setHours(endH, endM, endS, 0);
      endStr = toNominalISO(end);
    }
    onChange({ start: toNominalISO(start), end: endStr });
    setOpen(false);
  }, [range, startH, startM, startS, endH, endM, endS, onChange]);

  const handlePreset = useCallback(
    (preset: (typeof PRESETS)[number]) => {
      const r = preset.getValue();
      onChange({ ...r, label: preset.label });
      setOpen(false);
    },
    [onChange],
  );

  /** Cycles forward: days → months → years. */
  const handleToggleView = useCallback((side: "left" | "right") => {
    setActiveSide(side);
    setView((v) => {
      if (v === "days") {
        return "months";
      }
      if (v === "months") {
        return "years";
      }
      return "days";
    });
  }, []);

  const handleMonthSelect = useCallback(
    (m: number) => {
      const setter = activeSide === "left" ? setMonthLeft : setMonthRight;
      setter((prev) => dateFnsSetMonth(prev, m));
      setView("days");
    },
    [activeSide],
  );

  const handleYearSelect = useCallback(
    (y: number) => {
      const setter = activeSide === "left" ? setMonthLeft : setMonthRight;
      setter((prev) => dateFnsSetYear(prev, y));
      setView("months");
    },
    [activeSide],
  );

  // ── Derived ───────────────────────────────────────────────────────────────

  const displayText = useMemo(() => {
    if (value.label) {
      return value.label;
    }
    if (!value.start) {
      return "All Time";
    }
    const s = format(new Date(value.start), "MMM d, yyyy HH:mm:ss");
    const e = value.end ? format(new Date(value.end), "MMM d, yyyy HH:mm:ss") : "now";
    return `${s} → ${e}`;
  }, [value]);

  const hasEndDate = Boolean(range?.to);

  const MonthCaptionLeft = useMemo(() => {
    return function MonthCaptionLeftComp({ calendarMonth }: MonthCaptionProps) {
      return (
        <CalendarHeader
          calendarMonth={calendarMonth}
          view={view}
          onPrev={() => setMonthLeft(dateFnsSubMonths(monthLeft, 1))}
          onNext={() => setMonthLeft(dateFnsAddMonths(monthLeft, 1))}
          onToggleView={() => handleToggleView("left")}
        />
      );
    };
  }, [view, handleToggleView, monthLeft]);

  const MonthCaptionRight = useMemo(() => {
    return function MonthCaptionRightComp({ calendarMonth }: MonthCaptionProps) {
      return (
        <CalendarHeader
          calendarMonth={calendarMonth}
          view={view}
          onPrev={() => setMonthRight(dateFnsSubMonths(monthRight, 1))}
          onNext={() => setMonthRight(dateFnsAddMonths(monthRight, 1))}
          onToggleView={() => handleToggleView("right")}
        />
      );
    };
  }, [view, handleToggleView, monthRight]);

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
      weekday: "w-9 text-center text-xs font-bold text-text-muted uppercase tracking-wider",
      week: "flex transition-colors",
      day: "h-9 w-9 relative",
      day_button:
        "h-9 w-9 text-xs font-medium rounded-none transition-colors hover:bg-primary/20 hover:text-primary",
      range_start:
        "bg-primary/20 rounded-l-full [&>button]:bg-primary [&>button]:text-text-inverse [&>button]:rounded-full [&>button]:font-bold",
      range_end:
        "bg-primary/20 rounded-r-full [&>button]:bg-primary [&>button]:text-text-inverse [&>button]:rounded-full [&>button]:font-bold",
      range_middle: "bg-primary/10 [&>button]:text-primary [&>button]:rounded-none",
      selected:
        "[&>button]:bg-primary [&>button]:text-text-inverse [&>button]:rounded-full [&>button]:font-bold",
      today: "[&>button]:ring-1 [&>button]:ring-primary/50",
      outside: "opacity-30",
      disabled: "opacity-20 cursor-not-allowed",
      hidden: "invisible",
    },
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger className="h-8 inline-flex items-center gap-2 rounded-md border border-border/40 bg-black/40 px-2 2xl:px-3 text-xs font-medium transition-all hover:bg-black/60 hover:border-border/60 group">
          <Clock className="size-3.5 text-text-muted group-hover:text-primary transition-colors" />
          <span className="text-text-secondary group-hover:text-text-primary transition-colors max-w-[400px] truncate hidden 2xl:inline">
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
            <PresetsSidebar onSelectPreset={handlePreset} onReset={onChange} />

            {/* ── 2. Calendar ───────────────────────────────── */}
            <div
              className="p-4 border-r border-border/20 shrink-0 flex flex-col"
              style={{ minWidth: "600px" }}
            >
              <p className="text-xs font-bold uppercase tracking-widest text-text-muted opacity-50 mb-3">
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
                          MonthCaption: MonthCaptionLeft,
                        }}
                      />
                      <DayPicker
                        {...commonPickerProps}
                        month={monthRight}
                        onMonthChange={setMonthRight}
                        components={{
                          MonthCaption: MonthCaptionRight,
                        }}
                      />
                    </div>
                  )}

                  {/* Month selector (Individual) */}
                  {view === "months" && (
                    <div className="flex flex-col items-center">
                      <CalendarHeader
                        calendarMonth={
                          {
                            date: activeSide === "left" ? monthLeft : monthRight,
                          } as MonthCaptionProps["calendarMonth"]
                        }
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
                        calendarMonth={
                          {
                            date: activeSide === "left" ? monthLeft : monthRight,
                          } as MonthCaptionProps["calendarMonth"]
                        }
                        view={view}
                        onPrev={() => {
                          const setter = activeSide === "left" ? setMonthLeft : setMonthRight;
                          setter((m) => dateFnsSetYear(m, getYear(m) - 12));
                        }}
                        onNext={() => {
                          const setter = activeSide === "left" ? setMonthLeft : setMonthRight;
                          setter((m) => dateFnsSetYear(m, getYear(m) + 12));
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
              <SelectionPreview
                range={range}
                startH={startH}
                startM={startM}
                startS={startS}
                endH={endH}
                endM={endM}
                endS={endS}
              />
            </div>

            {/* ── 3. Time Controls ──────────────────────────── */}
            <TimeControls
              hasEndDate={hasEndDate}
              startH={startH}
              startM={startM}
              startS={startS}
              endH={endH}
              endM={endM}
              endS={endS}
              onStartH={setStartH}
              onStartM={setStartM}
              onStartS={setStartS}
              onEndH={setEndH}
              onEndM={setEndM}
              onEndS={setEndS}
              canApply={Boolean(range?.from)}
              onApply={handleApply}
              onCancel={() => setOpen(false)}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
