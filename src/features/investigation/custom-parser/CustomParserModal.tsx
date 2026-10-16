import { TooltipProvider } from "@/components/ui/tooltip";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ExtractionPanel } from "./ExtractionPanel";
import { ParserHeader } from "./ParserHeader";
import { SampleViewer } from "./SampleViewer";
import { SelectionToolbar } from "./SelectionToolbar";
import type { ActiveSelection, CustomParserModalProps, ParserConfig, ParserMapping } from "./types";
import { computePreviewResults, generateRegexFromMapping } from "./utils";

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

  const [activeSelection, setActiveSelection] = useState<ActiveSelection | null>(null);
  const [mapping, setMapping] = useState<{
    timestamp?: ParserMapping;
    level?: ParserMapping;
  }>({});

  const sampleContainerRef = useRef<HTMLDivElement>(null);

  // 1. Load samples and initial config
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    async function fetchData() {
      setIsLoading(true);
      try {
        const result = await callSidecar<string[]>({
          method: "get_sample_lines",
          params: { workspace_id: workspaceId, source_id: sourceId, limit: 15 },
        });
        setSamples(result);

        if (initialConfig) {
          try {
            const config = JSON.parse(initialConfig) as ParserConfig;
            setRegexPattern(config.regex || "");
            if (config.mapping) {
              setMapping(config.mapping);
            }
          } catch (error: unknown) {
            console.warn("Malformed config", error);
          }
        } else {
          setRegexPattern("");
          setMapping({});
        }
      } catch (error: unknown) {
        console.error("Failed to load parser data", error);
        toast.error("Could not fetch log samples for parsing.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [isOpen, workspaceId, sourceId, initialConfig]);

  // 2. Handle Text Selection
  const handleMouseUp = useCallback(() => {
    const selection = globalThis.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.toString().trim() === "") {
      setActiveSelection(null);
      return;
    }

    const range = selection.getRangeAt(0);

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
  }, []);

  useEffect(() => {
    const element = sampleContainerRef.current;
    if (element) {
      element.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      if (element) {
        element.removeEventListener("mouseup", handleMouseUp);
      }
    };
  }, [handleMouseUp]);

  // 3. Update Regex from Mapping
  useEffect(() => {
    const newPattern = generateRegexFromMapping(mapping);
    if (newPattern) {
      setRegexPattern(newPattern);
    }
  }, [mapping]);

  // 4. Live Preview
  useEffect(() => {
    setPreviewResults(computePreviewResults(regexPattern, samples));
  }, [regexPattern, samples]);

  const handleSave = () => {
    const config: ParserConfig = {
      regex: regexPattern,
      mapping,
    };
    onSaved(JSON.stringify(config));
    onClose();
  };

  const handleClear = () => {
    setRegexPattern("");
    setMapping({});
  };

  const handleMapTimestamp = () => {
    if (!activeSelection) {
      return;
    }
    setMapping((prev) => ({
      ...prev,
      timestamp: { start: activeSelection.start, end: activeSelection.end },
    }));
    setActiveSelection(null);
    toast.success("Timestamp mapped");
  };

  const handleMapLevel = () => {
    if (!activeSelection) {
      return;
    }
    setMapping((prev) => ({
      ...prev,
      level: { start: activeSelection.start, end: activeSelection.end },
    }));
    setActiveSelection(null);
    toast.success("Severity mapped");
  };

  if (!isOpen) {
    return null;
  }

  return (
    <TooltipProvider delay={200}>
      <div className="fixed inset-0 z-[200] flex flex-col overflow-y-auto py-8 px-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
        <div className="max-w-5xl w-full my-auto mx-auto min-h-[520px] flex flex-col bg-bg-app border border-border-subtle rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/10">
          <ParserHeader hasTimestampMapping={Boolean(mapping.timestamp)} onClose={onClose} />

          <div className="flex-1 flex min-h-0 divide-x divide-border/40">
            <SampleViewer
              samples={samples}
              isLoading={isLoading}
              sourceId={sourceId}
              mapping={mapping}
              containerRef={sampleContainerRef}
            />

            <ExtractionPanel
              regexPattern={regexPattern}
              setRegexPattern={setRegexPattern}
              activeSelection={activeSelection}
              onMapTimestamp={handleMapTimestamp}
              onMapLevel={handleMapLevel}
              previewResults={previewResults}
              onClear={handleClear}
              onSave={handleSave}
            />
          </div>
        </div>
      </div>

      {activeSelection && (
        <SelectionToolbar
          selection={activeSelection}
          onMapTimestamp={handleMapTimestamp}
          onMapLevel={handleMapLevel}
        />
      )}
    </TooltipProvider>
  );
}
