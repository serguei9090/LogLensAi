import { TimeInputRow } from "./TimeInputRow";

interface TimeControlsProps {
  readonly hasEndDate: boolean;
  readonly startH: number;
  readonly startM: number;
  readonly startS: number;
  readonly endH: number;
  readonly endM: number;
  readonly endS: number;
  readonly onStartH: (v: number) => void;
  readonly onStartM: (v: number) => void;
  readonly onStartS: (v: number) => void;
  readonly onEndH: (v: number) => void;
  readonly onEndM: (v: number) => void;
  readonly onEndS: (v: number) => void;
  readonly canApply: boolean;
  readonly onApply: () => void;
  readonly onCancel: () => void;
}

export function TimeControls({
  hasEndDate,
  startH,
  startM,
  startS,
  endH,
  endM,
  endS,
  onStartH,
  onStartM,
  onStartS,
  onEndH,
  onEndM,
  onEndS,
  canApply,
  onApply,
  onCancel,
}: TimeControlsProps) {
  return (
    <div className="flex flex-col p-4 gap-5" style={{ minWidth: "168px" }}>
      <p className="text-xs font-bold uppercase tracking-widest text-text-muted opacity-50">
        Time (HH:MM:SS)
      </p>

      <TimeInputRow
        label="Start"
        color="green"
        h={startH}
        m={startM}
        s={startS}
        onH={onStartH}
        onM={onStartM}
        onS={onStartS}
      />

      <div className="border-t border-border/10" />

      <TimeInputRow
        label={hasEndDate ? "End" : "End (pick date)"}
        color="amber"
        h={endH}
        m={endM}
        s={endS}
        onH={onEndH}
        onM={onEndM}
        onS={onEndS}
        disabled={!hasEndDate}
      />

      <p className="text-xs text-text-muted/50 italic text-center leading-tight mt-auto">
        {hasEndDate ? "Precise end point" : "Streaming (Now)"}
      </p>

      <div className="flex flex-col gap-2 pt-2 border-t border-border/10">
        <button
          type="button"
          onClick={onApply}
          disabled={!canApply}
          className="w-full h-8 rounded-md bg-primary text-text-inverse text-xs font-bold transition-all hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Set Window
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full h-8 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-white/5 transition-all"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
