import { Switch } from "@/components/ui/switch";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { cn } from "@/lib/utils";
import { useInvestigationStore } from "@/store/investigationStore";
import type { LogSource } from "@/store/workspaceStore";
import {
  Check,
  ChevronDown,
  Clock,
  Cpu,
  Edit2,
  Plus,
  Save,
  Settings2,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { CustomParserModal } from "./CustomParserModal";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TimezoneOption {
  value: number;
  label: string;
}

const TIMEZONE_OPTIONS: TimezoneOption[] = Array.from({ length: 27 }, (_, i) => {
  const offset = i - 12;
  const sign = offset >= 0 ? "+" : "−";
  const abs = Math.abs(offset);
  return { value: offset, label: `UTC ${sign}${abs.toString().padStart(2, "0")}:00` };
});

interface FusionSourceConfig {
  source_id: string;
  enabled: boolean;
  tz_offset: number;
  custom_format: string | null;
  parser_config: string | null;
}

interface OrchestratorHubProps {
  /** Hub open state */
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  availableSources: LogSource[];
  /** Source being edited (null = create new) */
  editingFusionId?: string | null;
  editingFusionName?: string | null;
  /** Called when a fusion is successfully saved */
  onFusionSaved: (fusionId: string, fusionName: string, configs: FusionSourceConfig[]) => void;
}

// ─── TimezoneSelect (portal-based to escape scroll clipping) ─────────────────

function TimezoneSelect({
  value,
  onChange,
}: { readonly value: number; readonly onChange: (v: number) => void }) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = TIMEZONE_OPTIONS.find((o) => o.value === value) ?? TIMEZONE_OPTIONS[12];

  const updatePosition = () => {
    if (!triggerRef.current) {
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    setPanelStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 148),
      zIndex: 9999,
    });
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    const handler = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !listRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.querySelector("[data-selected='true']")?.scrollIntoView({ block: "center" });
    }
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          updatePosition();
          setOpen((o) => !o);
        }}
        className={cn(
          "flex items-center gap-2 h-8 px-3 rounded-md text-[11px] font-mono font-semibold transition-all",
          "bg-[#0D0F0E] border text-white",
          open
            ? "border-violet-500 ring-1 ring-violet-500/40 text-violet-400"
            : "border-white/10 hover:border-violet-400/40 hover:text-violet-300",
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
      </button>
      {open &&
        createPortal(
          <div
            ref={listRef}
            style={panelStyle}
            className="bg-[#111613] border border-white/10 rounded-xl shadow-2xl max-h-52 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150"
          >
            {TIMEZONE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                data-selected={opt.value === value ? "true" : "false"}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 text-[11px] font-mono transition-colors",
                  opt.value === value
                    ? "bg-violet-500/20 text-violet-400 font-bold"
                    : "text-white/70 hover:bg-white/5 hover:text-white",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

// ─── Strategy Card ────────────────────────────────────────────────────────────

function StrategyCard({
  icon,
  name,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  name: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-violet-500/10 hover:border-violet-500/30 transition-all text-left group"
    >
      <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 group-hover:bg-violet-500/20 transition-colors shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-text-primary">{name}</p>
        <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">{description}</p>
      </div>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * OrchestratorHub is a slide-in right-side drawer that serves as the entry point
 * for creating and editing orchestration sessions (Fusion, and future strategy types).
 *
 * Flow:
 *   1. Strategy picker → user selects "Fusion"
 *   2. Inline form → name + source config
 *   3. Deploy → creates a fusion source tab in the workspace
 */
export function OrchestratorHub({
  isOpen,
  onClose,
  workspaceId,
  availableSources,
  editingFusionId,
  editingFusionName,
  onFusionSaved,
}: OrchestratorHubProps) {
  // "picker" = strategy selection, "fusion-form" = fusion configuration, "ai-context-form" = edit global context
  const [view, setView] = useState<"picker" | "fusion-form" | "ai-context-form">("picker");
  const showDistribution = useInvestigationStore((s) => s.showDistribution);
  const setShowDistribution = useInvestigationStore((s) => s.setShowDistribution);
  const showAnomalies = useInvestigationStore((s) => s.showAnomalies);
  const setShowAnomalies = useInvestigationStore((s) => s.setShowAnomalies);
  const workspaceGlobalContext = useInvestigationStore((s) => s.workspaceGlobalContext);
  const setWorkspaceGlobalContext = useInvestigationStore((s) => s.setWorkspaceGlobalContext);
  const [fusionName, setFusionName] = useState("");
  const [configs, setConfigs] = useState<FusionSourceConfig[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [activeParserSource, setActiveParserSource] = useState<string | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [tempContext, setTempContext] = useState("");

  // Reset or pre-fill when opening
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (editingFusionId) {
      // Pre-fill for editing
      setFusionName(editingFusionName ?? "");
      setView("fusion-form");
      setIsLoadingConfig(true);
      callSidecar<{ sources: FusionSourceConfig[] }>({
        method: "get_fusion_config",
        params: { workspace_id: workspaceId, fusion_id: editingFusionId },
      })
        .then((res) => {
          const merged = availableSources.map((src) => {
            const existing = res.sources.find((s) => s.source_id === src.path);
            return (
              existing ?? {
                source_id: src.path,
                enabled: false,
                tz_offset: 0,
                custom_format: null,
                parser_config: null,
              }
            );
          });
          setConfigs(merged);
        })
        .catch(() => {
          toast.error("Failed to load fusion config for editing.");
        })
        .finally(() => setIsLoadingConfig(false));
    } else {
      // New fusion
      setView("picker");
      setFusionName("");
      const defaults = availableSources.map((src) => ({
        source_id: src.path,
        enabled: true,
        tz_offset: 0,
        custom_format: null,
        parser_config: null,
      }));
      setConfigs(defaults);
    }
  }, [isOpen, editingFusionId, editingFusionName, workspaceId, availableSources]);

  const toggleSource = (sourceId: string) =>
    setConfigs((prev) =>
      prev.map((c) => (c.source_id === sourceId ? { ...c, enabled: !c.enabled } : c)),
    );

  const updateOffset = (sourceId: string, offset: number) =>
    setConfigs((prev) =>
      prev.map((c) => (c.source_id === sourceId ? { ...c, tz_offset: offset } : c)),
    );

  const handleParserSaved = (sourceId: string, configJson: string) => {
    setConfigs((prev) =>
      prev.map((c) => (c.source_id === sourceId ? { ...c, parser_config: configJson } : c)),
    );
    toast.success("Extraction pattern updated.");
  };

  const handleDeploy = async () => {
    if (!fusionName.trim()) {
      toast.warning("Please give your fusion a name.");
      return;
    }
    const enabledCount = configs.filter((c) => c.enabled).length;
    if (enabledCount < 2) {
      toast.warning("Enable at least 2 log sources to fuse.");
      return;
    }

    setIsSaving(true);
    try {
      // Generate a stable fusion ID from the name
      const fusionId = editingFusionId ?? `fusion_${Date.now()}`;
      await callSidecar({
        method: "update_fusion_config",
        params: { workspace_id: workspaceId, fusion_id: fusionId, sources: configs },
      });
      toast.success(`Fusion "${fusionName}" deployed.`);
      onFusionSaved(fusionId, fusionName.trim(), configs);
      onClose();
    } catch (error) {
      console.error("Deploy failed", error);
      toast.error("Failed to deploy fusion.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <>
      {/* Backdrop: only closes when clicking OUTSIDE the drawer.
          The drawer uses onPointerDown+stopPropagation so events inside
          the drawer never reach this backdrop handler. */}
      <div
        className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onPointerDown={onClose}
      />

      {/* Drawer: stopPropagation ensures pointer events stay inside the drawer
          and never bubble up to the backdrop div above. */}
      <div
        className="fixed top-0 right-0 bottom-0 z-[160] w-[420px] flex flex-col bg-[#0D1110] border-l border-border/60 shadow-2xl animate-in slide-in-from-right duration-300"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/40 bg-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <Cpu className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary tracking-tight">Orchestrator</h2>
              <p className="text-[10px] text-text-muted uppercase tracking-widest font-medium">
                {view === "picker"
                  ? "Choose a Strategy"
                  : view === "ai-context-form"
                    ? "Global Context"
                    : editingFusionId
                      ? "Edit Fusion"
                      : "New Fusion"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-text-muted hover:text-text-primary"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {view === "picker" && (
            <div className="p-5 space-y-4">
              <div className="space-y-3">
                <p className="text-[11px] text-text-muted uppercase tracking-widest font-bold">
                  Visual Layers
                </p>
                <div className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-black/20">
                  <div>
                    <span className="block text-sm font-semibold text-text-primary">
                      Log Distribution
                    </span>
                    <span className="block text-[11px] text-text-muted mt-0.5">
                      Timeline histogram of log volume
                    </span>
                  </div>
                  <Switch
                    checked={showDistribution}
                    onCheckedChange={setShowDistribution}
                    className="data-[checked]:bg-violet-500"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-black/20 mt-2">
                  <div>
                    <span className="block text-sm font-semibold text-text-primary">
                      Anomaly Engine
                    </span>
                    <span className="block text-[11px] text-text-muted mt-0.5">
                      Highlight statistical outliers in logs
                    </span>
                  </div>
                  <Switch
                    checked={showAnomalies}
                    onCheckedChange={setShowAnomalies}
                    className="data-[checked]:bg-orange-500"
                  />
                </div>
              </div>

              <div className="w-full h-px bg-border/40 my-2" />

              <div className="space-y-3">
                <p className="text-[11px] text-text-muted uppercase tracking-widest font-bold">
                  AI Layer
                </p>
                <div className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-black/20">
                  <div>
                    <span className="block text-sm font-semibold text-text-primary">
                      Workspace Global Context
                    </span>
                    <span className="block text-[11px] text-text-muted mt-0.5">
                      Enable AI context ingestion across the entire workspace
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTempContext(workspaceGlobalContext ?? "");
                      setView("ai-context-form");
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border",
                      workspaceGlobalContext
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-white/5 text-text-muted border-white/10 hover:text-white",
                    )}
                  >
                    <Edit2 className="size-3" />
                    {workspaceGlobalContext ? "Edit Context" : "Add Context"}
                  </button>
                </div>
              </div>

              <div className="w-full h-px bg-border/40 my-2" />

              <p className="text-[11px] text-text-muted uppercase tracking-widest font-bold">
                Available Strategies
              </p>
              <StrategyCard
                icon={<Zap className="size-5" />}
                name="Fusion"
                description="Interleave and synchronize logs from multiple sources into a single unified timeline."
                onClick={() => setView("fusion-form")}
              />
              {/* Placeholder for future strategies */}
              <div className="p-4 rounded-xl border border-dashed border-white/10 text-center text-[11px] text-text-muted/40 italic">
                More strategies coming soon...
              </div>
            </div>
          )}

          {view === "fusion-form" && (
            <div className="p-5 space-y-6">
              {/* Back button (only on new) */}
              {!editingFusionId && (
                <button
                  type="button"
                  onClick={() => setView("picker")}
                  className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-secondary transition-colors"
                >
                  ← Back to strategies
                </button>
              )}

              {/* Fusion Name */}
              <div className="space-y-2">
                <label
                  htmlFor="fusion-name"
                  className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-2"
                >
                  <Zap className="size-3 text-violet-400" /> Fusion Name
                </label>
                <input
                  id="fusion-name"
                  type="text"
                  value={fusionName}
                  onChange={(e) => setFusionName(e.target.value)}
                  placeholder="e.g. Production Stack"
                  className="w-full h-10 bg-black/60 border border-border/40 rounded-xl px-4 text-sm text-text-primary outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 transition-all placeholder:text-text-muted/40"
                />
              </div>

              {/* Source List */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                  Log Sources
                </p>
                {isLoadingConfig ? (
                  <div className="py-8 text-center text-text-muted/40 animate-pulse text-sm">
                    Loading config...
                  </div>
                ) : configs.length === 0 ? (
                  <div className="py-8 text-center text-text-muted/40 text-sm italic">
                    No log sources in workspace yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {configs.map((config) => {
                      const sourceInfo = availableSources.find((s) => s.path === config.source_id);
                      const label =
                        sourceInfo?.name ?? config.source_id.split("/").pop() ?? config.source_id;
                      const hasParser = !!config.parser_config;

                      return (
                        <div
                          key={config.source_id}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-xl border transition-all",
                            config.enabled
                              ? "bg-violet-500/5 border-violet-500/20"
                              : "bg-black/20 border-border/20 opacity-60",
                          )}
                        >
                          {/* Toggle */}
                          <button
                            type="button"
                            onClick={() => toggleSource(config.source_id)}
                            className={cn(
                              "size-5 rounded flex-shrink-0 flex items-center justify-center transition-colors",
                              config.enabled
                                ? "bg-violet-500 text-white"
                                : "bg-white/5 border border-white/10",
                            )}
                          >
                            {config.enabled && <Check className="size-3.5 stroke-[3]" />}
                          </button>

                          {/* Label */}
                          <div className="flex-1 min-w-0">
                            <span className="block text-sm font-semibold text-text-secondary truncate">
                              {label}
                            </span>
                            <span className="block text-[10px] text-text-muted truncate lowercase font-mono">
                              {config.source_id}
                            </span>
                          </div>

                          {/* Timezone */}
                          <TimezoneSelect
                            value={config.tz_offset}
                            onChange={(tz) => updateOffset(config.source_id, tz)}
                          />

                          {/* Parser */}
                          <button
                            type="button"
                            onClick={() => setActiveParserSource(config.source_id)}
                            className={cn(
                              "p-2 rounded-lg border transition-all flex-shrink-0 flex items-center justify-center relative",
                              hasParser
                                ? "bg-violet-500 text-white border-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.3)]"
                                : "bg-white/5 border-white/10 text-text-muted hover:text-text-primary hover:border-white/20",
                            )}
                            title="Configure Timestamp Parser"
                          >
                            <Settings2 className="size-4" />
                            {hasParser && (
                              <div className="absolute -top-1 -right-1 bg-white text-violet-600 p-0.5 rounded-full ring-2 ring-violet-500">
                                <Sparkles className="size-2 fill-current" />
                              </div>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sync info */}
              <div className="p-3 rounded-xl bg-violet-500/5 border border-violet-500/10 text-[11px] text-text-muted leading-relaxed">
                <span className="font-bold text-violet-400">Sync Strategy:</span> Interleaved
                Timestamp Alignment. Use{" "}
                <span className="text-text-secondary font-bold">Sync Drift</span> to offset logs
                from different timezones.
              </div>
            </div>
          )}

          {view === "ai-context-form" && (
            <div className="p-5 space-y-6 flex flex-col h-full">
              <button
                type="button"
                onClick={() => setView("picker")}
                className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-secondary transition-colors"
              >
                ← Back to settings
              </button>

              <div className="space-y-3 flex-1 flex flex-col">
                <div>
                  <p className="text-sm font-bold text-text-primary">Workspace Global Context</p>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    Provide instructions, service specifics, or architectural details about this
                    workspace. This context will constantly guide the AI investigator.
                  </p>
                </div>
                <textarea
                  value={tempContext}
                  onChange={(e) => setTempContext(e.target.value)}
                  className="flex-1 w-full bg-black/60 border border-border/40 rounded-xl p-4 text-sm text-text-primary outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/60 transition-all placeholder:text-text-muted/40 resize-none font-mono min-h-[200px]"
                  placeholder="e.g. This workspace logs the Redis anomalies for the user Auth service. We are mostly looking for memory leak patterns..."
                />
              </div>
              <div className="pt-2 flex justify-end gap-3 mt-auto shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceGlobalContext(null);
                    setView("picker");
                  }}
                  className="px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent"
                >
                  Clear & Disable
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceGlobalContext(tempContext.trim() || null);
                    setView("picker");
                  }}
                  className="px-6 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-lg active:scale-95"
                >
                  Save Context
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer (only during fusion form) */}
        {view === "fusion-form" && (
          <div className="p-5 border-t border-border/40 bg-white/5 shrink-0 space-y-3">
            <button
              type="button"
              onClick={handleDeploy}
              disabled={
                isSaving || !fusionName.trim() || configs.filter((c) => c.enabled).length < 2
              }
              className={cn(
                "w-full flex items-center justify-center gap-2 h-11 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95",
                "bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 disabled:active:scale-100",
              )}
            >
              {isSaving ? (
                <div className="animate-spin size-4 border-2 border-white border-t-transparent rounded-full" />
              ) : editingFusionId ? (
                <>
                  <Save className="size-4" /> Update Fusion
                </>
              ) : (
                <>
                  <Plus className="size-4" /> Deploy Fusion
                </>
              )}
            </button>
          </div>
        )}
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
          onSaved={(cfg) => handleParserSaved(activeParserSource, cfg)}
        />
      )}
    </>,
    document.body,
  );
}
