import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import type React from "react";
import type { ParserMapping } from "./types";
import { splitLineIntoSegments } from "./utils";

interface SampleViewerProps {
  samples: string[];
  isLoading: boolean;
  sourceId: string;
  mapping: { timestamp?: ParserMapping; level?: ParserMapping };
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function SampleViewer({
  samples,
  isLoading,
  sourceId,
  mapping,
  containerRef,
}: SampleViewerProps) {
  return (
    <div className="flex-[1.5] flex flex-col min-w-0 bg-black/20">
      <div className="p-4 border-b border-border/20 flex items-center justify-between">
        <span className="text-xs font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
          <Search className="size-3" /> Raw Source Samples
        </span>
        <Tooltip>
          <TooltipTrigger>
            <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 animate-pulse cursor-help">
              Highlight text to define capture group
            </span>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            className="bg-[#111613] border-white/20 text-white p-2 text-xs max-w-[240px]"
          >
            Select a range to map it to a field.
          </TooltipContent>
        </Tooltip>
      </div>

      <section
        ref={containerRef}
        aria-label="Log sample container"
        className="flex-1 overflow-auto p-0 font-mono text-xs select-text custom-scrollbar bg-bg-surface/20 divide-y divide-white/5"
      >
        {!isLoading && samples.length > 0 ? (
          samples.map((line, idx) => {
            const segments = splitLineIntoSegments(line, mapping);
            return (
              <div
                key={`sample-${sourceId}-${idx}`}
                data-sample-line="true"
                className="group flex hover:bg-primary/5 transition-colors min-w-fit"
              >
                <div className="w-12 shrink-0 flex items-center justify-center bg-black/40 text-xs text-text-muted border-r border-white/5 select-none group-hover:text-primary transition-colors">
                  {(idx + 1).toString().padStart(3, "0")}
                </div>
                <div className="p-3 px-4 whitespace-nowrap text-text-secondary leading-relaxed cursor-crosshair group-hover:text-text-primary transition-colors">
                  {segments.map((s, i) => (
                    <span
                      key={`${i}-${s.text.length}`}
                      className={cn(
                        s.type === "timestamp" &&
                          "bg-primary/20 text-primary border border-primary/40 px-1 py-0.5 rounded-sm",
                        s.type === "level" &&
                          "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 px-1 py-0.5 rounded-sm",
                      )}
                    >
                      {s.text}
                    </span>
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          <div className="h-full flex items-center justify-center text-text-muted/40 italic">
            {isLoading ? "Sampling log stream..." : "No samples found."}
          </div>
        )}
      </section>
    </div>
  );
}
