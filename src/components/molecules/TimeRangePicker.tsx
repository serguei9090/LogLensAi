import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, subMinutes, subHours, subDays, startOfDay } from "date-fns";
import { Clock, RotateCcw, ArrowRight } from "lucide-react";
import { useState, useMemo } from "react";

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

const PRESETS = [
  { label: "Last 15 minutes", getValue: () => ({ start: subMinutes(new Date(), 15).toISOString(), end: "" }) },
  { label: "Last 1 hour", getValue: () => ({ start: subHours(new Date(), 1).toISOString(), end: "" }) },
  { label: "Last 4 hours", getValue: () => ({ start: subHours(new Date(), 4).toISOString(), end: "" }) },
  { label: "Last 24 hours", getValue: () => ({ start: subHours(new Date(), 24).toISOString(), end: "" }) },
  { label: "Last 7 days", getValue: () => ({ start: subDays(new Date(), 7).toISOString(), end: "" }) },
  { label: "Today", getValue: () => ({ start: startOfDay(new Date()).toISOString(), end: "" }) },
];

export function TimeRangePicker({ value, onChange, className }: TimeRangePickerProps) {
  const [open, setOpen] = useState(false);
  
  // Internal state for absolute picker
  const [startDate, setStartDate] = useState<Date | undefined>(value.start ? new Date(value.start) : undefined);
  const [startTime, setStartTime] = useState<string>(value.start ? format(new Date(value.start), "HH:mm") : "00:00");
  
  const [endDate, setEndDate] = useState<Date | undefined>(value.end ? new Date(value.end) : undefined);
  const [endTime, setEndTime] = useState<string>(value.end ? format(new Date(value.end), "HH:mm") : format(new Date(), "HH:mm"));

  const handleApply = () => {
    if (!startDate) return;
    
    const startObj = new Date(startDate);
    const [startH, startM] = startTime.split(":").map(Number);
    startObj.setHours(startH, startM, 0, 0);

    let endObjStr = "";
    if (endDate) {
      const endObj = new Date(endDate);
      const [endH, endM] = endTime.split(":").map(Number);
      endObj.setHours(endH, endM, 0, 0);
      endObjStr = endObj.toISOString();
    }

    onChange({
      start: startObj.toISOString(),
      end: endObjStr,
      label: "Custom range",
    });
    setOpen(false);
  };

  const handlePreset = (preset: typeof PRESETS[0]) => {
    const range = preset.getValue();
    onChange({ ...range, label: preset.label });
    
    // Sync internal state
    const d = new Date(range.start);
    setStartDate(d);
    setStartTime(format(d, "HH:mm"));
    setEndDate(undefined);
    setOpen(false);
  };

  const displayText = useMemo(() => {
    if (value.label) return value.label;
    if (!value.start) return "All Time";
    const startStr = format(new Date(value.start), "MMM d, HH:mm");
    const endStr = value.end ? format(new Date(value.end), "MMM d, HH:mm") : "now";
    return `${startStr} - ${endStr}`;
  }, [value]);

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 bg-black/40 border-border/40 hover:bg-black/60 hover:border-border/60 text-xs font-medium px-3 flex items-center gap-2 group transition-all"
          >
            <Clock className="size-3.5 text-text-muted group-hover:text-primary transition-colors" />
            <span className="text-text-secondary group-hover:text-text-primary transition-colors">{displayText}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[640px] p-0 bg-[#0d0f0e] border-border/40 shadow-2xl rounded-xl z-50 overflow-hidden" align="start">
          <div className="flex h-[420px]">
            {/* Presets Sidebar */}
            <div className="w-[160px] border-r border-border/20 p-2 space-y-1 bg-white/[0.02]">
              <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted opacity-50">Quick Select</div>
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => handlePreset(p)}
                  className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:text-primary hover:bg-primary/10 rounded-md transition-all truncate"
                >
                  {p.label}
                </button>
              ))}
              <div className="pt-2 mt-2 border-t border-border/10">
                <button
                  onClick={() => { onChange({ start: "", end: "" }); setOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-text-muted hover:text-text-primary hover:bg-white/5 rounded-md transition-all flex items-center gap-2"
                >
                  <RotateCcw className="size-3" />
                  Reset all time
                </button>
              </div>
            </div>

            {/* Absolute Range Picker */}
            <div className="flex-1 flex flex-col p-4 overflow-hidden">
               <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted opacity-50 mb-4 px-2">Specific Range Selection</div>
               
               <div className="flex-1 flex gap-4 overflow-hidden">
                  {/* Start Date */}
                  <div className="flex-1 flex flex-col gap-2">
                    <span className="text-[11px] font-medium text-text-secondary px-2 flex items-center gap-2">
                      <div className="size-1.5 rounded-full bg-emerald-500" /> Start
                    </span>
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      className="rounded-md border border-border/10 bg-black/20"
                    />
                    <div className="px-2">
                      <input 
                        type="time" 
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full bg-black/40 border border-border/20 rounded-md px-3 py-1.5 text-xs text-text-primary outline-none focus:ring-1 focus:ring-primary/40 appearance-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center text-text-muted opacity-20">
                    <ArrowRight className="size-4" />
                  </div>

                  {/* End Date */}
                  <div className="flex-1 flex flex-col gap-2">
                    <span className="text-[11px] font-medium text-text-secondary px-2 flex items-center gap-2">
                      <div className="size-1.5 rounded-full bg-amber-500" /> End
                    </span>
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      className="rounded-md border border-border/10 bg-black/20"
                    />
                    <div className="px-2">
                      <input 
                        type="time" 
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full bg-black/40 border border-border/20 rounded-md px-3 py-1.5 text-xs text-text-primary outline-none focus:ring-1 focus:ring-primary/40 appearance-none disabled:opacity-30"
                        disabled={!endDate}
                      />
                      <div className="mt-1 text-[9px] text-text-muted/40 italic text-center">
                        {endDate ? "Specific end point" : "Streaming (Now)"}
                      </div>
                    </div>
                  </div>
               </div>

               <div className="mt-4 pt-4 border-t border-border/10 flex justify-end gap-2 px-2">
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="text-xs h-8">Cancel</Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={handleApply} 
                  disabled={!startDate}
                  className="text-xs h-8 bg-primary text-black font-bold disabled:opacity-50"
                >
                  Set Window
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
