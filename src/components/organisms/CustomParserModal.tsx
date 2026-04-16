import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { cn } from "@/lib/utils";
import { Clock, Info, Search, Terminal, Trash2, Wand2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface CustomParserModalProps {
  workspaceId: string;
  sourceId: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (parserConfig: any) => void;
  initialConfig?: string | null;
}

/**
 * CustomParserModal provides an interactive "Highlight-to-Parse" UI for log normalization.
 * Users can select a sample timestamp/level in raw log lines to generate extraction regex.
 */
export function CustomParserModal({
  workspaceId,
  sourceId,
  isOpen,
  onClose,
  onSaved,
  initialConfig,
}: CustomParserModalProps) {
  const [samples, setSamples] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [regexPattern, setRegexPattern] = useState("");
  const [previewResults, setPreviewResults] = useState<{ timestamp?: string; level?: string }[]>(
    [],
  );

  // Selection & Mapping State
  const [activeSelection, setActiveSelection] = useState<{
    start: number;
    end: number;
    text: string;
    rect: DOMRect;
  } | null>(null);
  const [mapping, setMapping] = useState<{
    timestamp?: { start: number; end: number };
    level?: { start: number; end: number };
  }>({});

  const sampleContainerRef = useRef<HTMLDivElement>(null);

  // 1. Load samples and initial config
  useEffect(() => {
    if (!isOpen) return;

    async function fetchData() {
      setIsLoading(true);
      try {
        const result = await callSidecar<string[]>({
          method: "get_sample_lines",
          params: { workspace_id: workspaceId, source_id: sourceId, limit: 2 },
        });
        setSamples(result);

        if (initialConfig) {
          try {
            const config = JSON.parse(initialConfig);
            setRegexPattern(config.regex || "");
            if (config.mapping) setMapping(config.mapping);
          } catch (e) {
            console.warn("Malformed config", e);
          }
        } else {
          setRegexPattern("");
          setMapping({});
        }
      } catch (error) {
        console.error("Failed to load parser data", error);
        toast.error("Could not fetch log samples for parsing.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [isOpen, workspaceId, sourceId, initialConfig]);

  // 2. Handle Text Selection - Show Context Menu
  const handleMouseUp = () => {
    const selection = globalThis.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.toString().trim() === "") {
      setActiveSelection(null);
      return;
    }

    const range = selection.getRangeAt(0);

    // Robustly check if selection is inside a sample line
    let node: HTMLElement | null = range.startContainer.parentElement;
    let isSampleLine = false;
    while (node && node !== sampleContainerRef.current) {
      if (node.dataset.sampleLine === "true") {
        isSampleLine = true;
        break;
      }
      node = node.parentElement;
    }

    if (isSampleLine) {
      const rect = range.getBoundingClientRect();
      // Ensure we have a valid rect before showing
      if (rect.width > 0) {
        setActiveSelection({
          start: range.startOffset,
          end: range.endOffset,
          text: selection.toString(),
          rect,
        });
      }
    } else {
      setActiveSelection(null);
    }
  };

  // 3. Update Regex from Mapping
  useEffect(() => {
    if (!mapping.timestamp && !mapping.level) return;

    let pattern = "^";
    const sorted = Object.entries(mapping)
      .filter(([_, val]) => !!val)
      .sort((a, b) => (a[1] as any).start - (b[1] as any).start);

    let lastIdx = 0;
    for (const [key, range] of sorted as any) {
      if (range.start > lastIdx) {
        pattern += `.{${range.start - lastIdx}}`;
      }
      pattern += `(?P<${key}>.{${range.end - range.start}})`;
      lastIdx = range.end;
    }
    pattern += ".*";
    setRegexPattern(pattern);
  }, [mapping]);

  // 4. Live Preview
  useEffect(() => {
    if (!regexPattern) {
      setPreviewResults([]);
      return;
    }

    try {
      const jsRegexStr = regexPattern.replaceAll(/\?P<(\w+)>/g, "").replaceAll(/\\/g, "\\\\");
      const jsRegex = new RegExp(jsRegexStr);

      const previews = samples.map((line) => {
        const match = line.match(jsRegex);
        return {
          timestamp: match ? match[0].substring(0, 20) : "No match",
          level: "INFO",
        };
      });
      setPreviewResults(previews);
    } catch (e) {
      setPreviewResults([]);
    }
  }, [regexPattern, samples]);

  const handleSave = () => {
    const config = JSON.stringify({
      regex: regexPattern,
      mapping,
    });
    onSaved(config);
    onClose();
  };

  const renderLineWithHighlights = (line: string) => {
    const segments: { text: string; type?: "timestamp" | "level" }[] = [];
    let currentPos = 0;

    const hls = Object.entries(mapping)
      .filter(([_, val]) => !!val)
      .sort((a, b) => (a[1] as any).start - (b[1] as any).start);

    for (const [type, range] of hls as any) {
      if (range.start > currentPos) {
        segments.push({ text: line.substring(currentPos, range.start) });
      }
      segments.push({
        text: line.substring(range.start, range.end),
        type: type as any,
      });
      currentPos = range.end;
    }

    if (currentPos < line.length) {
      segments.push({ text: line.substring(currentPos) });
    }

    return segments.map((s, i) => (
      <span
        key={i}
        className={cn(
          s.type === "timestamp" &&
            "bg-primary/30 text-primary border-b-2 border-primary px-0.5 rounded-t-sm",
          s.type === "level" &&
            "bg-cyan-500/30 text-cyan-400 border-b-2 border-cyan-500 px-0.5 rounded-t-sm",
        )}
      >
        {s.text}
      </span>
    ));
  };

  if (!isOpen) return null;

  return (
    <TooltipProvider delay={200}>
      <div className="fixed inset-0 z-[200] flex flex-col overflow-y-auto py-8 px-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
        <div className="max-w-5xl w-full my-auto mx-auto min-h-[520px] flex flex-col bg-[#0D1110] border border-border/60 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/10">
          <div className="flex items-center justify-between p-6 border-b border-border/40 bg-white/5">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Terminal className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-text-primary tracking-tight">
                  Parser Architect
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-text-muted uppercase tracking-widest font-medium">
                    Log Translation Engine
                  </p>
                  <div className="h-1 w-1 rounded-full bg-white/20" />
                  <span className="text-[10px] text-primary font-mono">
                    {mapping.timestamp ? "Sync Active" : "Unmapped"}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-text-muted hover:text-text-primary"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="flex-1 flex min-h-0 divide-x divide-border/40">
            <div className="flex-[1.5] flex flex-col min-w-0 bg-black/20">
              <div className="p-4 border-b border-border/20 flex items-center justify-between">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                  <Search className="size-3" /> Raw Source Samples
                </span>
                <Tooltip>
                  <TooltipTrigger>
                    <span className="text-[9px] text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 animate-pulse cursor-help">
                      Highlight text to define capture group
                    </span>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    className="bg-[#111613] border-white/20 text-white p-2 text-[11px] max-w-[240px]"
                  >
                    Select a range to map it to a field.
                  </TooltipContent>
                </Tooltip>
              </div>

              <div
                ref={sampleContainerRef}
                onMouseUp={handleMouseUp}
                className="flex-1 overflow-auto p-0 font-mono text-xs select-text custom-scrollbar bg-surface-base/20 divide-y divide-white/5"
              >
                {!isLoading && samples.length > 0 ? (
                  samples.map((line, idx) => (
                    <div
                      key={idx}
                      data-sample-line="true"
                      className="group flex hover:bg-primary/5 transition-colors min-w-fit"
                    >
                      <div className="w-12 shrink-0 flex items-center justify-center bg-black/40 text-[9px] text-text-muted border-r border-white/5 select-none group-hover:text-primary transition-colors">
                        {(idx + 1).toString().padStart(3, "0")}
                      </div>
                      <div className="p-3 px-4 whitespace-nowrap text-text-secondary leading-relaxed cursor-crosshair group-hover:text-text-primary transition-colors">
                        {renderLineWithHighlights(line)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex items-center justify-center text-text-muted/40 italic">
                    {isLoading ? "Sampling log stream..." : "No samples found."}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col min-w-[320px] bg-surface-base/40 backdrop-blur-xl">
              <div className="p-6 space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wand2 className="size-3" /> Extraction Logic
                    </div>
                    {regexPattern && (
                      <span className="text-[9px] text-primary/60 lowercase italic">
                        Python Sync Standard
                      </span>
                    )}
                  </label>
                  <div className="relative group">
                    <textarea
                      value={regexPattern}
                      onChange={(e) => setRegexPattern(e.target.value)}
                      placeholder="^(?P<timestamp>.*?) (?P<level>\w+).*"
                      className="w-full h-24 bg-black/60 border border-border/40 rounded-xl p-4 text-sm font-mono text-primary outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all resize-none shadow-inner"
                    />
                    <div className="absolute top-2 right-2 flex flex-col gap-2">
                      {activeSelection && (
                        <div className="flex flex-col gap-1 p-1 bg-primary/10 border border-primary/20 rounded-lg animate-in slide-in-from-right-2">
                          <button
                            onClick={() => {
                              setMapping((prev) => ({
                                ...prev,
                                timestamp: {
                                  start: activeSelection.start,
                                  end: activeSelection.end,
                                },
                              }));
                              setActiveSelection(null);
                            }}
                            className="p-1.5 hover:bg-primary/20 text-primary rounded-md transition-colors"
                            title="Map as Timestamp"
                          >
                            <Clock className="size-3" />
                          </button>
                          <button
                            onClick={() => {
                              setMapping((prev) => ({
                                ...prev,
                                level: { start: activeSelection.start, end: activeSelection.end },
                              }));
                              setActiveSelection(null);
                            }}
                            className="p-1.5 hover:bg-blue-500/20 text-blue-400 rounded-md transition-colors"
                            title="Map as Severity"
                          >
                            <Info className="size-3" />
                          </button>
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
                          className="bg-[#111613] border-white/20 text-white p-3 text-[11px] max-w-[280px] space-y-2 text-wrap"
                        >
                          <p className="font-bold text-primary">Python Regex Protocol</p>
                          <p>LogLens uses Python-style named groups:</p>
                          <div className="space-y-1.5 font-mono text-[10px]">
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
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    Extraction Preview
                  </label>
                  <div className="bg-black/40 rounded-xl border border-white/5 divide-y divide-white/5 overflow-hidden text-wrap">
                    {previewResults.length > 0 ? (
                      previewResults.slice(0, 2).map((res, i) => (
                        <div key={i} className="p-3 flex items-center justify-between text-[11px]">
                          <span className="text-text-muted font-mono">
                            {res.timestamp || "---"}
                          </span>
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
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
                      <div className="p-8 text-center text-text-muted/40 italic text-[11px]">
                        Enter regex to see preview
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-6 pb-2">
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-2">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                    <Wand2 className="size-3" /> Pattern Protocol
                  </p>
                  <ul className="text-[10px] text-text-secondary space-y-1.5 list-disc list-inside">
                    <li>Highlight text in the log to open the Map Menu.</li>
                    <li>The regex engine will sync automatically.</li>
                    <li>
                      Check the <span className="font-bold underline">Preview</span> for live
                      validation.
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-auto p-6 border-t border-border/40 bg-white/5 space-y-4">
                <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 flex gap-3 items-start">
                  <Info className="size-4 text-orange-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-orange-200/70 leading-relaxed italic text-wrap">
                    Normalized timestamps are critical for Fusion mode.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setRegexPattern("");
                      setMapping({});
                    }}
                    className="p-2.5 rounded-xl border border-border/40 text-text-muted hover:text-red-400"
                  >
                    <Trash2 className="size-5" />
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex-1 bg-primary text-black h-11 rounded-xl font-bold text-sm hover:bg-primary-hover shadow-lg"
                  >
                    Save Definition
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {activeSelection && (
        <div
          style={{
            position: "fixed",
            top: (activeSelection.rect?.top || 0) - 48,
            left: (activeSelection.rect?.left || 0) + (activeSelection.rect?.width || 0) / 2,
            transform: "translateX(-50%)",
          }}
          className="z-[999] flex items-center gap-1 p-1 bg-[#111613] border border-white/20 rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
        >
          <button
            onClick={() => {
              setMapping((prev) => ({
                ...prev,
                timestamp: { start: activeSelection.start, end: activeSelection.end },
              }));
              setActiveSelection(null);
              toast.success("Timestamp mapped");
            }}
            className="px-2 py-1.5 rounded-md hover:bg-primary/20 text-primary text-[10px] font-bold transition-colors flex items-center gap-1.5"
          >
            <Clock className="size-3" /> Map Timestamp
          </button>
          <div className="w-px h-4 bg-white/10 mx-1" />
          <button
            onClick={() => {
              setMapping((prev) => ({
                ...prev,
                level: { start: activeSelection.start, end: activeSelection.end },
              }));
              setActiveSelection(null);
              toast.success("Severity mapped");
            }}
            className="px-2 py-1.5 rounded-md hover:bg-cyan-500/20 text-cyan-400 text-[10px] font-bold transition-colors flex items-center gap-1.5"
          >
            <Info className="size-3" /> Map Level
          </button>
        </div>
      )}
    </TooltipProvider>
  );
}
