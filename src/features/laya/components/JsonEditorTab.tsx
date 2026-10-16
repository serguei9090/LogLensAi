import { Check } from "lucide-react";

export interface JsonEditorTabProps {
  readonly jsonText: string;
  readonly jsonError: string | null;
  readonly onJsonChange: (text: string) => void;
}

export function JsonEditorTab({ jsonText, jsonError, onJsonChange }: Readonly<JsonEditorTabProps>) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>Declarative Laya rulebook format. Validates in real time.</span>
        {jsonError ? (
          <span className="text-red-400 font-mono font-semibold">{jsonError}</span>
        ) : (
          <span className="text-primary font-mono flex items-center gap-1">
            <Check className="h-3 w-3" /> Valid JSON
          </span>
        )}
      </div>

      <textarea
        value={jsonText}
        onChange={(e) => onJsonChange(e.target.value)}
        rows={18}
        className="w-full font-mono text-xs p-4 rounded-xl bg-bg-surface border border-border text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all resize-y leading-relaxed"
        spellCheck={false}
      />
    </div>
  );
}
