import type { LogSource } from "@/store/workspaceStore";
import { Clock } from "lucide-react";

interface TimeAlignmentViewProps {
  readonly availableSources: LogSource[];
  readonly temporalOffsets: Record<string, number>;
  readonly onSyncSource: (sourcePath: string) => void;
  readonly onBack: () => void;
}

export function TimeAlignmentView({
  availableSources,
  temporalOffsets,
  onSyncSource,
  onBack,
}: TimeAlignmentViewProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
      <button
        type="button"
        onClick={onBack}
        className="text-xs text-white/50 hover:text-white transition-all flex items-center gap-1.5"
      >
        ← Back
      </button>

      <div className="space-y-4">
        <p className="text-xs text-white/50 font-medium">
          Adjust time offsets out-of-sync lines.
        </p>

        <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1 custom-scrollbar">
          {availableSources.map((source) => {
            const offset = temporalOffsets[source.path] ?? 0;
            return (
              <div
                key={source.path}
                className="group flex flex-row items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all"
              >
                <div className="min-w-0 pr-3">
                  <p className="text-sm font-medium text-white/90 truncate">
                    {source.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Clock className="size-3 text-white/30" />
                    <p className="text-xs font-mono text-white/50">
                      {(() => {
                        if (offset === 0) {
                          return "0s";
                        }
                        const sign = offset > 0 ? "+" : "";
                        return `${sign}${offset}s`;
                      })()}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onSyncSource(source.path)}
                  className="px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all"
                >
                  Sync
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
