import { Check, ChevronDown, Clock, Globe, Save, Settings2, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { cn } from "@/lib/utils";
import type { LogSource } from "@/store/workspaceStore";
import { Button } from "../ui/button";
import { CustomParserModal } from "./CustomParserModal";

/** UTC offset entry for the custom timezone picker. */
interface TimezoneOption {
  value: number;
  label: string;
}

/** Pre-computed list of UTC offset options from -12 to +14. */
const TIMEZONE_OPTIONS: TimezoneOption[] = Array.from({ length: 27 }, (_, i) => {
  const offset = i - 12;
  const sign = offset >= 0 ? "+" : "−";
  const abs = Math.abs(offset);
  return {
    value: offset,
    label: `UTC ${sign}${abs.toString().padStart(2, "0")}:00`,
  };
});

interface FusionSourceConfig {
  source_id: string;
  enabled: boolean;
  tz_offset: number;
  custom_format: string | null;
  parser_config: string | null;
}

interface FusionConfigEngineProps {
  readonly workspaceId: string;
  readonly availableSources: LogSource[];
  readonly onConfigSaved: () => void;
}

/**
 * Custom dark-themed timezone dropdown.
 *
 * Uses createPortal to render the dropdown at document.body level,
 * escaping any overflow:hidden/auto ancestor that would clip it.
 */
function TimezoneSelect({
  value,
  onChange,
}: {
  readonly value: number;
  readonly onChange: (offset: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = TIMEZONE_OPTIONS.find((o) => o.value === value) ?? TIMEZONE_OPTIONS[12];

  // Layout Constants
  const DROPDOWN_GAP = 4;
  const MIN_DROPDOWN_WIDTH = 148;
  const MAX_Z_INDEX = 9999;

  const updatePosition = () => {
    if (!triggerRef.current) {
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    setPanelStyle({
      position: "fixed",
      top: rect.bottom + DROPDOWN_GAP,
      left: rect.left,
      width: Math.max(rect.width, MIN_DROPDOWN_WIDTH),
      zIndex: MAX_Z_INDEX,
    });
  };

  const handleOpen = () => {
    updatePosition();
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) === false &&
        listRef.current?.contains(target) === false
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open && listRef.current) {
      const selectedEl = listRef.current.querySelector("[data-selected='true']");
      selectedEl?.scrollIntoView({ block: "center" });
    }
  }, [open]);

  const panel = open
    ? createPortal(
        <div
          ref={listRef}
          style={panelStyle}
          className={cn(
            "bg-bg-surface-bright border border-border rounded-xl shadow-2xl",
            "max-h-52 overflow-y-auto custom-scrollbar",
            "animate-in fade-in slide-in-from-top-2 duration-150",
          )}
        >
          {TIMEZONE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant="ghost"
              size="sm"
              data-selected={opt.value === value ? "true" : "false"}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={cn(
                "w-full justify-start px-3 h-9 text-[11px] font-mono",
                opt.value === value
                  ? "bg-primary/20 text-primary font-bold"
                  : "text-text-muted hover:bg-bg-hover hover:text-text-primary",
              )}
            >
              {opt.label}
            </Button>
          ))}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <Button
        ref={triggerRef}
        variant="ghost"
        size="sm"
        onClick={handleOpen}
        className={cn(
          "flex items-center gap-2 h-8 px-3 rounded-md text-[11px] font-mono font-semibold",
          "bg-bg-surface border border-border-subtle text-text-primary",
          open
            ? "border-primary ring-1 ring-primary/40 text-primary"
            : "hover:border-primary/40 hover:text-primary",
        )}
      >
        <Clock className="size-3 opacity-60" />
        <span>{selected.label}</span>
        <ChevronDown
          className={cn(
            "size-3 opacity-60 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </Button>
      {panel}
    </>
  );
}

export function FusionConfigEngine({
  workspaceId,
  availableSources,
  onConfigSaved,
}: FusionConfigEngineProps) {
  const [configs, setConfigs] = useState<FusionSourceConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeParserSource, setActiveParserSource] = useState<string | null>(null);

  useEffect(() => {
    async function loadConfig() {
      try {
        const result = await callSidecar<{ sources: FusionSourceConfig[] }>({
          method: "get_fusion_config",
          params: { workspace_id: workspaceId },
        });

        const merged = availableSources.map((source) => {
          const existing = result.sources.find((s) => s.source_id === source.path);
          return (
            existing ?? {
              source_id: source.path,
              enabled: true,
              tz_offset: 0,
              custom_format: null,
              parser_config: null,
            }
          );
        });

        setConfigs(merged);
      } catch (error) {
        console.error("Failed to load fusion config", error);
        toast.error("Could not sync orchestration settings.");
      } finally {
        setIsLoading(false);
      }
    }
    loadConfig();
  }, [workspaceId, availableSources]);

  const toggleSource = (sourceId: string) => {
    setConfigs((prev) =>
      prev.map((c) => (c.source_id === sourceId ? { ...c, enabled: !c.enabled } : c)),
    );
  };

  const updateOffset = (sourceId: string, offset: number) => {
    setConfigs((prev) =>
      prev.map((c) => (c.source_id === sourceId ? { ...c, tz_offset: offset } : c)),
    );
  };

  const handleParserSaved = (sourceId: string, configJson: string) => {
    setConfigs((prev) =>
      prev.map((c) => (c.source_id === sourceId ? { ...c, parser_config: configJson } : c)),
    );
    toast.success("Extraction pattern updated locally.");
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await callSidecar({
        method: "update_fusion_config",
        params: { workspace_id: workspaceId, sources: configs },
      });
      toast.success("Fusion orchestration updated.");
      onConfigSaved();
    } catch (error) {
      console.error("Save failed", error);
      toast.error("Failed to persist orchestration settings.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted animate-pulse font-mono uppercase tracking-widest text-xs">
        Initializing Fusion Engine...
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="max-w-3xl w-full flex flex-col space-y-6 bg-bg-surface/40 border border-border-subtle rounded-xl p-8 backdrop-blur-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-border/40 pb-6">
          <div className="p-3 rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Globe className="size-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary tracking-tight uppercase italic font-mono">
              Fusion Orchestration
            </h2>
            <p className="text-sm text-text-muted mt-0.5">
              Interleave and synchronize multi-source logs
            </p>
          </div>
        </div>

        {/* Source List */}
        <div className="space-y-3 max-h-[400px] overflow-y-auto px-1 pr-2 custom-scrollbar">
          {configs.map((config) => {
            const sourceInfo = availableSources.find((s) => s.path === config.source_id);
            const label = sourceInfo?.name ?? config.source_id.split("/").pop();
            const hasParser = !!config.parser_config;

            return (
              <div
                key={config.source_id}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-lg border transition-all duration-200",
                  config.enabled
                    ? "bg-primary/5 border-primary/20"
                    : "bg-bg-base/40 border-border-subtle grayscale opacity-60",
                )}
              >
                {/* Enabled toggle */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleSource(config.source_id)}
                  className={cn(
                    "size-5 rounded flex-shrink-0 flex items-center justify-center p-0",
                    config.enabled
                      ? "bg-primary text-text-inverse hover:bg-primary/90"
                      : "bg-bg-surface-bright/5 border border-border-subtle",
                  )}
                >
                  {config.enabled && <Check className="size-3.5 stroke-[3]" />}
                </Button>

                {/* Source label + path */}
                <div className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-text-secondary truncate">
                    {label}
                  </span>
                  <span className="block text-[10px] text-text-muted truncate lowercase font-mono">
                    {config.source_id}
                  </span>
                </div>

                {/* Timezone selector */}
                <div className="flex flex-col gap-1 items-end">
                  <span className="text-[9px] text-text-muted font-bold uppercase tracking-widest">
                    Sync Drift
                  </span>
                  <TimezoneSelect
                    value={config.tz_offset}
                    onChange={(offset) => updateOffset(config.source_id, offset)}
                  />
                </div>

                {/* Parser Trigger */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setActiveParserSource(config.source_id)}
                  className={cn(
                    "p-2.5 rounded-lg border transition-all relative flex-shrink-0",
                    hasParser
                      ? "bg-primary text-text-inverse border-primary shadow-[0_0_10px_var(--primary-glow)] hover:bg-primary/90"
                      : "bg-bg-surface-bright/5 border-border-subtle text-text-muted hover:text-text-primary hover:border-border",
                  )}
                  title="Configure Extraction Parser"
                >
                  <Settings2 className="size-4" />
                  {hasParser && (
                    <div className="absolute -top-1 -right-1 bg-text-primary text-text-inverse p-0.5 rounded-full ring-2 ring-primary">
                      <Sparkles className="size-2 fill-current" />
                    </div>
                  )}
                </Button>
              </div>
            );
          })}

          {configs.length === 0 && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 opacity-40">
              <X className="size-10 stroke-[1]" />
              <p className="text-sm">No log sources added to this workspace yet.</p>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-between pt-6 border-t border-border/40">
          <div className="flex flex-col">
            <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider">
              Sync Strategy
            </span>
            <span className="text-sm font-bold text-primary italic font-mono">
              Interleaved Timestamp Alignment
            </span>
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving || configs.length === 0}
            className="px-6 py-2.5 font-bold shadow-[0_0_20px_var(--primary-glow)]"
          >
            {isSaving ? (
              <div className="animate-spin size-4 border-2 border-text-inverse border-t-transparent rounded-full" />
            ) : (
              <Save className="size-4" />
            )}
            Deploy Fusion
          </Button>
        </div>
      </div>

      {/* Help Note */}
      <div className="max-w-md text-center">
        <p className="text-[11px] text-text-muted leading-relaxed">
          Fusion Mode merges all enabled sources into a single stream. Use{" "}
          <span className="text-text-secondary font-bold">Sync Drift</span> to align logs living in
          different timezones.
        </p>
      </div>

      {/* Parser Modal */}
      {activeParserSource && (
        <CustomParserModal
          workspaceId={workspaceId}
          sourceId={activeParserSource}
          isOpen={true}
          onClose={() => setActiveParserSource(null)}
          initialConfig={
            configs.find((c) => c.source_id === activeParserSource)?.parser_config ?? null
          }
          onSaved={(newConfig) => handleParserSaved(activeParserSource, newConfig)}
        />
      )}
    </div>
  );
}
