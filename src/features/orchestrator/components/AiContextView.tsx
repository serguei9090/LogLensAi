interface AiContextViewProps {
  readonly tempContext: string;
  readonly setTempContext: (v: string) => void;
  readonly onBack: () => void;
}

export function AiContextView({ tempContext, setTempContext, onBack }: AiContextViewProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300 flex flex-col h-full">
      <button
        type="button"
        onClick={onBack}
        className="text-xs text-white/50 hover:text-white transition-all flex items-center gap-1.5"
      >
        ← Back
      </button>

      <div className="flex-1 flex flex-col space-y-3">
        <p className="text-xs text-white/50 font-medium">
          Add architecture constraints for AI to know.
        </p>
        <textarea
          value={tempContext}
          onChange={(e) => setTempContext(e.target.value)}
          placeholder="Define schemas or domains..."
          className="w-full min-h-[300px] bg-white/[0.02] border border-white/10 rounded-lg p-4 text-sm text-white/80 outline-none focus:border-white/30 transition-all placeholder:text-white/20 custom-scrollbar font-mono resize-none"
        />
      </div>
    </div>
  );
}
