import { MONTH_NAMES } from "../constants";

interface MonthGridProps {
  readonly currentMonth: number;
  readonly onSelectMonth: (m: number) => void;
}

/**
 * Month selector grid — header handles the year drilldown, no duplicate here.
 */
export function MonthGrid({ currentMonth, onSelectMonth }: MonthGridProps) {
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
