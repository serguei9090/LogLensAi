import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Clock, Info, Trash2, Wand2 } from "lucide-react";
import type { ActiveSelection } from "./types";

interface ExtractionPanelProps {
  regexPattern: string;
  setRegexPattern: (pattern: string) => void;
  activeSelection: ActiveSelection | null;
  onMapTimestamp: () => void;
  onMapLevel: () => void;
  previewResults: { timestamp?: string; level?: string }[];
  onClear: () => void;
  onSave: () => void;
}

export function ExtractionPanel({
  regexPattern,
  setRegexPattern,
  activeSelection,
  onMapTimestamp,
  onMapLevel,
  previewResults,
  onClear,
  onSave,
}: ExtractionPanelProps) {
  const textareaId = "parser-regex-textarea";
  const previewId = "parser-preview-grid";

  return (
    <div className="flex-1 flex flex-col min-w-[320px] bg-surface-base/40 backdrop-blur-xl">
      <div className="p-6 space-y-6">
        <div className="space-y-3">
          <label
            htmlFor={textareaId}
            className="text-xs font-bold text-text-muted uppercase tracking-widest flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Wand2 className="size-3" /> Extraction Logic
            </div>
            {regexPattern && (
              <span className="text-xs text-primary/60 lowercase italic">Python Sync Standard</span>
            )}
          </label>
          <div className="relative group">
            <textarea
              id={textareaId}
              value={regexPattern}
              onChange={(e) => setRegexPattern(e.target.value)}
              placeholder="^(?P<timestamp>.*?) (?P<level>\\w+).*"
              className="w-full h-24 bg-black/60 border border-border/40 rounded-xl p-4 text-sm font-mono text-primary outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all resize-none shadow-inner"
            />
            <div className="absolute top-2 right-2 flex flex-col gap-2">
              {activeSelection && (
                <div className="flex flex-col gap-1 p-1 bg-primary/10 border border-primary/20 rounded-lg animate-in slide-in-from-right-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onMapTimestamp}
                    className="p-1.5 hover:bg-primary/20 text-primary rounded-md transition-colors"
                    title="Map as Timestamp"
                  >
                    <Clock className="size-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onMapLevel}
                    className="p-1.5 hover:bg-blue-500/20 text-blue-400 rounded-md transition-colors"
                    title="Map as Severity"
                  >
                    <Info className="size-3" />
                  </Button>
                </div>
              )}
              <Tooltip>
                <TooltipTrigger>
                  <div className="p-1 hover:bg-white/5 rounded-md cursor-help text-text-muted hover:text-primary transition-colors">
                    <Info className="size-4" />
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="left"
                  className="bg-bg-surface border-border-subtle text-text-primary p-3 text-xs max-w-[280px] space-y-2 text-wrap"
                >
                  <p className="font-bold text-primary">Python Regex Protocol</p>
                  <p>LogLens uses Python-style named groups:</p>
                  <div className="space-y-1.5 font-mono text-xs">
                    <code className="block bg-black/40 p-1.5 rounded border border-white/5 text-primary-hover">
                      (?P&lt;timestamp&gt;...)
                    </code>
                    <code className="block bg-black/40 p-1.5 rounded border border-white/5 text-primary-hover">
                      (?P&lt;level&gt;...)
                    </code>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <label
            htmlFor={previewId}
            className="text-xs font-bold text-text-muted uppercase tracking-widest"
          >
            Extraction Preview
          </label>
          <div
            id={previewId}
            className="bg-black/40 rounded-xl border border-border-subtle/40 divide-y divide-white/5 overflow-hidden text-wrap"
          >
            {previewResults.length > 0 ? (
              previewResults.slice(0, 5).map((res, i) => (
                <div
                  key={`preview-${res.timestamp}-${i}`}
                  className="p-3 flex items-center justify-between text-xs"
                >
                  <span className="text-text-muted font-mono">{res.timestamp || "---"}</span>
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-xs font-bold uppercase",
                      res.level === "ERROR"
                        ? "bg-red-500/20 text-red-400"
                        : "bg-primary/20 text-primary",
                    )}
                  >
                    {res.level}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-text-muted/40 italic text-xs">
                Enter regex to see preview
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 pb-2">
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-2">
          <p className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
            <Wand2 className="size-3" /> Pattern Protocol
          </p>
          <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
            <li>Highlight text in the log to open the Map Menu.</li>
            <li>The regex engine will sync automatically.</li>
            <li>
              Check the <span className="font-bold underline">Preview</span> for live validation.
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-auto p-6 border-t border-border/40 bg-white/5 space-y-4">
        <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 flex gap-3 items-start">
          <Info className="size-4 text-orange-400 shrink-0 mt-0.5" />
          <p className="text-xs text-orange-200/70 leading-relaxed italic text-wrap">
            Normalized timestamps are critical for Fusion mode.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={onClear}
            className="border-border/40 text-text-muted hover:text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="size-5" />
          </Button>
          <Button
            onClick={onSave}
            className="flex-1 bg-primary text-black h-11 font-bold text-sm hover:bg-primary-hover shadow-lg shadow-primary/10"
          >
            Save Definition
          </Button>
        </div>
      </div>
    </div>
  );
}
