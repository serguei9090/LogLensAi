interface YearGridProps {
  readonly currentYear: number;
  readonly onSelectYear: (y: number) => void;
}

export function YearGrid({ currentYear, onSelectYear }: YearGridProps) {
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
