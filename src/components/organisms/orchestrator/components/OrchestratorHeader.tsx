import { Cpu, X } from "lucide-react";
import type { OrchestratorView } from "../types";

interface OrchestratorHeaderProps {
  readonly view: OrchestratorView;
  readonly onClose: () => void;
}

const VIEW_TITLES: Record<OrchestratorView, string> = {
  picker: "Command Center",
  "ai-context-form": "Cognitive State",
  "time-alignment-form": "Temporal Target",
  "fusion-form": "Neural Link",
};

export function OrchestratorHeader({ view, onClose }: OrchestratorHeaderProps) {
  return (
    <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/[0.02] shrink-0">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-md bg-white/5 text-white/70 border border-white/5">
          <Cpu className="size-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white/90 tracking-tight">Orchestrator</h2>
          <p className="text-xs text-white/40 uppercase tracking-widest mt-0.5">
            {VIEW_TITLES[view]}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="p-2 hover:bg-white/10 rounded-md transition-all text-white/40 hover:text-white"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
