import { RotateCcw } from "lucide-react";
import { PRESETS } from "../constants";
import type { TimeRange } from "../types";

interface PresetsSidebarProps {
  readonly onSelectPreset: (preset: (typeof PRESETS)[number]) => void;
  readonly onReset: (range: TimeRange) => void;
}

export function PresetsSidebar({ onSelectPreset, onReset }: PresetsSidebarProps) {
  return (
    <div className="w-[140px] border-r border-border/20 p-2 space-y-0.5 bg-white/[0.02] shrink-0">
      <p className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-text-muted opacity-50">
        Quick Select
      </p>
      {PRESETS.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => onSelectPreset(p)}
          className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:text-primary hover:bg-primary/10 rounded-md transition-all"
        >
          {p.label}
        </button>
      ))}
      <div className="pt-2 mt-1 border-t border-border/10">
        <button
          type="button"
          onClick={() => onReset({ start: "", end: "" })}
          className="w-full text-left px-3 py-1.5 text-xs text-text-muted hover:text-text-primary hover:bg-white/5 rounded-md transition-all flex items-center gap-2"
        >
          <RotateCcw className="size-3" />
          Reset
        </button>
      </div>
    </div>
  );
}
