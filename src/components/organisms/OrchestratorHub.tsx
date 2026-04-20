import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { cn } from "@/lib/utils";
import { useInvestigationStore } from "@/store/investigationStore";
import type { LogSource } from "@/store/workspaceStore";
import { Check, Clock, Cpu, Layers, Settings2, Sparkles, X, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { CustomParserModal } from "./CustomParserModal";
import { TimeShiftModal } from "./TimeShiftModal";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FusionSourceConfig {
  source_id: string;
  enabled: boolean;
  tz_offset: number;
  custom_format: string | null;
  parser_config: string | null;
}

interface OrchestratorHubProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  availableSources: LogSource[];
  editingFusionId?: string | null;
  editingFusionName?: string | null;
  onFusionSaved: (fusionId: string, fusionName: string, configs: FusionSourceConfig[]) => void;
  onEngineSettingsOpen?: () => void;
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
      className="w-full flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all text-left group"
    >
      <div className="size-8 rounded-md bg-white/5 border border-white/10 text-white/50 flex items-center justify-center group-hover:text-white transition-all shrink-0">
        {icon}
      </div>
      <div className="space-y-0.5 flex-1 min-w-0">
        <p className="text-[13px] font-medium text-white/90 group-hover:text-white transition-colors truncate">
          {name}
        </p>
        <p className="text-[11px] text-white/40 leading-relaxed truncate">{description}</p>
      </div>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface DiscoveryTemplate {
  id: number;
  name: string;
  config: string;
  created_at: string;
}

export function OrchestratorHub({
  isOpen,
  onClose,
  workspaceId,
  availableSources,
  editingFusionId,
  editingFusionName,
  onFusionSaved,
  onEngineSettingsOpen,
}: OrchestratorHubProps) {
  const showDistribution = useInvestigationStore((s) => s.showDistribution);
  const setShowDistribution = useInvestigationStore((s) => s.setShowDistribution);
  const showAnomalies = useInvestigationStore((s) => s.showAnomalies);
  const setShowAnomalies = useInvestigationStore((s) => s.setShowAnomalies);
  const workspaceGlobalContext = useInvestigationStore((s) => s.workspaceGlobalContext);
  const setWorkspaceGlobalContext = useInvestigationStore((s) => s.setWorkspaceGlobalContext);

  const [view, setView] = useState<
    "picker" | "fusion-form" | "ai-context-form" | "time-alignment-form"
  >("picker");
  const [fusionName, setFusionName] = useState("");
  const [configs, setConfigs] = useState<FusionSourceConfig[]>([]);
  const [temporalOffsets, setTemporalOffsets] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [activeParserSource, setActiveParserSource] = useState<string | null>(null);
  const [activeTimeShiftSource, setActiveTimeShiftSource] = useState<string | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [tempContext, setTempContext] = useState("");
  const [templates, setTemplates] = useState<DiscoveryTemplate[]>([]);

  // Initialize
  useEffect(() => {
    if (!isOpen) {
      setView("picker");
      setActiveParserSource(null);
      setActiveTimeShiftSource(null);
      return;
    }

    if (editingFusionId) {
      setFusionName(editingFusionName ?? "");
      setView("fusion-form");
      setIsLoadingConfig(true);
      callSidecar<{ sources: FusionSourceConfig[] }>({
        method: "get_fusion_config",
        params: { workspace_id: workspaceId, fusion_id: editingFusionId },
      })
        .then((res) => setConfigs(res.sources))
        .finally(() => setIsLoadingConfig(false));
    } else {
      setFusionName("");
      setView("picker");
      setConfigs(
        availableSources.map((s) => ({
          source_id: s.path,
          enabled: false,
          tz_offset: 0,
          custom_format: null,
          parser_config: null,
        })),
      );
    }

    // Fetch Templates
    callSidecar<DiscoveryTemplate[]>({
      method: "get_templates",
      params: { workspace_id: workspaceId },
    }).then((res) => setTemplates(res || []));

    callSidecar<{ offsets: Record<string, number> }>({
      method: "get_temporal_offsets",
      params: { workspace_id: workspaceId },
    }).then((res) => setTemporalOffsets(res.offsets || {}));
  }, [isOpen, editingFusionId, editingFusionName, workspaceId, availableSources]);

  const toggleSource = (sourceId: string) => {
    setConfigs((prev) =>
      prev.map((c) => (c.source_id === sourceId ? { ...c, enabled: !c.enabled } : c)),
    );
  };

  const applyTemplateToSource = (sourceId: string, templateId: string) => {
    const template = templates.find((t) => t.id.toString() === templateId);
    if (!template) {
      return;
    }

    // Apply the template's config_json to the source's parser_config
    // We treat discovery templates as source-specific parsers/filters
    setConfigs((prev) =>
      prev.map((c) => (c.source_id === sourceId ? { ...c, parser_config: template.config } : c)),
    );
    toast.success(`Applied "${template.name}" to source.`);
  };

  const handleParserSaved = (sourceId: string, cfg: string | null) => {
    setConfigs((prev) =>
      prev.map((c) => (c.source_id === sourceId ? { ...c, parser_config: cfg } : c)),
    );
    setActiveParserSource(null);
  };

  const saveTemporalOffsets = async () => {
    setIsSaving(true);
    try {
      await callSidecar({
        method: "update_temporal_offsets",
        params: { workspace_id: workspaceId, offsets: temporalOffsets },
      });
      toast.success("Temporal offsets calibrated.");
      setView("picker");
    } catch (e) {
      toast.error("Failed to calibrate temporal offsets.");
    } finally {
      setIsSaving(false);
    }
  };

  const deployFusion = async () => {
    const enabledCount = configs.filter((c) => c.enabled).length;
    if (enabledCount < 2) {
      toast.warning("Enable at least 2 log streams for fusion.");
      return;
    }

    setIsSaving(true);
    try {
      const fusionId = editingFusionId ?? `fusion_${Date.now()}`;
      await callSidecar({
        method: "update_fusion_config",
        params: { workspace_id: workspaceId, fusion_id: fusionId, sources: configs },
      });
      toast.success(`Fusion "${fusionName}" established.`);
      onFusionSaved(fusionId, fusionName.trim() || "Log Fusion", configs);
      onClose();
    } catch (error) {
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
        onPointerDown={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 bottom-0 z-[160] w-[380px] flex flex-col bg-[#111] border-l border-white/10 shadow-2xl animate-in slide-in-from-right duration-300 ease-out"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-md bg-white/5 text-white/70 border border-white/5">
              <Cpu className="size-5" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-white/90 tracking-tight">
                Orchestrator
              </h2>
              <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">
                {
                  {
                    picker: "Command Center",
                    "ai-context-form": "Cognitive State",
                    "time-alignment-form": "Temporal Target",
                    "fusion-form": "Neural Link",
                  }[view]
                }
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
          {view === "picker" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="space-y-3">
                <p className="text-[11px] text-white/40 font-medium px-0.5 uppercase tracking-widest">
                  Visualizers
                </p>
                <div className="grid gap-2">
                  {[
                    {
                      label: "Log Distribution",
                      desc: "Timeline density matching",
                      checked: showDistribution,
                      set: setShowDistribution,
                      icon: <Sparkles className="size-4 text-white/50" />,
                    },
                    {
                      label: "Anomaly Radar",
                      desc: "Detect statistical violations",
                      checked: showAnomalies,
                      set: setShowAnomalies,
                      icon: <Sparkles className="size-4 text-white/50" />,
                    },
                  ].map((layer) => (
                    <div
                      key={layer.label}
                      className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-md bg-white/5 border border-white/10 flex items-center justify-center group-hover:text-white transition-all">
                          {layer.icon}
                        </div>
                        <div className="space-y-0.5">
                          <span className="block text-[13px] font-medium text-white/90 group-hover:text-white transition-colors">
                            {layer.label}
                          </span>
                          <span className="block text-[11px] text-white/40">{layer.desc}</span>
                        </div>
                      </div>
                      <Switch checked={layer.checked} onCheckedChange={layer.set} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] text-white/40 font-medium px-0.5 uppercase tracking-widest">
                  Intelligence
                </p>
                <div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-md bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-all">
                      <Sparkles
                        className={cn(
                          "size-4",
                          workspaceGlobalContext ? "text-white/80" : "text-white/40",
                        )}
                      />
                    </div>
                    <div className="space-y-0.5">
                      <span className="block text-[13px] font-medium text-white/90 group-hover:text-white transition-colors">
                        Knowledge Base
                      </span>
                      <span className="block text-[11px] text-white/40 max-w-[140px] truncate">
                        {workspaceGlobalContext ? "Context active" : "Inject structure"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTempContext(workspaceGlobalContext ?? "");
                      setView("ai-context-form");
                    }}
                    className="px-3 py-1.5 rounded-md text-[11px] font-medium transition-all bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
                  >
                    {workspaceGlobalContext ? "Edit" : "Set"}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] text-white/40 font-medium px-0.5 uppercase tracking-widest">
                  Engine
                </p>
                <div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-md bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-all text-white/40 group-hover:text-white">
                      <Layers className="size-4" />
                    </div>
                    <div className="space-y-0.5">
                      <span className="block text-[13px] font-medium text-white/90 group-hover:text-white transition-colors">
                        Core Parser
                      </span>
                      <span className="block text-[11px] text-white/40 truncate">
                        Drain3 Configuration
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onEngineSettingsOpen?.();
                    }}
                    className="px-3 py-1.5 rounded-md text-[11px] font-medium transition-all bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
                  >
                    Configure
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] text-white/40 font-medium px-0.5 uppercase tracking-widest">
                  Operations
                </p>
                <div className="grid gap-2">
                  <StrategyCard
                    icon={<Zap className="size-4 text-white/50" />}
                    name="Log Fusion"
                    description="Combine different log streams together."
                    onClick={() => setView("fusion-form")}
                  />
                  <StrategyCard
                    icon={<Clock className="size-4 text-white/50" />}
                    name="Temporal Sync"
                    description="Align clocks across multiple files."
                    onClick={() => setView("time-alignment-form")}
                  />
                </div>
              </div>
            </div>
          )}

          {view === "fusion-form" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300 outline-none">
              <button
                type="button"
                onClick={() => setView("picker")}
                className="text-[11px] text-white/50 hover:text-white transition-all flex items-center gap-1.5"
              >
                ← Back
              </button>

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="fusion-name-input"
                    className="text-[11px] font-medium text-white/40 px-0.5 uppercase tracking-wider"
                  >
                    Name
                  </label>
                  <input
                    id="fusion-name-input"
                    type="text"
                    value={fusionName}
                    onChange={(e) => setFusionName(e.target.value)}
                    placeholder="e.g. Cluster Primary 01"
                    className="w-full h-10 bg-white/5 border border-white/10 rounded-lg px-3 text-sm text-white outline-none focus:border-white/30 transition-all placeholder:text-white/20"
                  />
                </div>

                <div className="space-y-3">
                  <p className="text-[11px] font-medium text-white/40 px-0.5 uppercase tracking-wider">
                    Sources
                  </p>
                  {isLoadingConfig ? (
                    <div className="py-10 flex flex-col items-center gap-3">
                      <div className="size-5 rounded-full border-2 border-white/5 border-t-white/50 animate-spin" />
                      <p className="text-[11px] text-white/40">Loading</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1 custom-scrollbar">
                      {configs.map((config) => {
                        const sourceInfo = availableSources.find(
                          (s) => s.path === config.source_id,
                        );
                        const label =
                          sourceInfo?.name ?? config.source_id.split("/").pop() ?? config.source_id;
                        return (
                          <div
                            key={config.source_id}
                            className={cn(
                              "group flex flex-row items-center gap-3 p-3 rounded-lg border transition-all",
                              config.enabled
                                ? "bg-white/[0.04] border-white/20"
                                : "bg-white/[0.01] border-white/5 opacity-60 hover:opacity-100",
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => toggleSource(config.source_id)}
                              className={cn(
                                "size-[18px] rounded border flex items-center justify-center transition-all",
                                config.enabled
                                  ? "bg-white border-white text-black"
                                  : "bg-transparent border-white/20 text-transparent",
                              )}
                            >
                              <Check className="size-3" />
                            </button>
                            <div className="flex-1 min-w-0">
                              <p
                                className={cn(
                                  "text-[13px] font-medium truncate",
                                  config.enabled ? "text-white/90" : "text-white/60",
                                )}
                              >
                                {label}
                              </p>
                              {config.enabled && templates.length > 0 && (
                                <select
                                  className="mt-1 w-full bg-transparent text-[10px] text-white/40 outline-none cursor-pointer hover:text-white/60 transition-colors"
                                  onChange={(e) =>
                                    applyTemplateToSource(config.source_id, e.target.value)
                                  }
                                  defaultValue=""
                                >
                                  <option value="" disabled className="bg-[#111]">
                                    Apply Template...
                                  </option>
                                  {templates.map((t) => (
                                    <option key={t.id} value={t.id} className="bg-[#111]">
                                      {t.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                            {config.enabled && (
                              <button
                                type="button"
                                onClick={() => setActiveParserSource(config.source_id)}
                                className={cn(
                                  "p-1.5 rounded transition-all border",
                                  config.parser_config
                                    ? "bg-white/10 border-white/20 text-white"
                                    : "bg-transparent border-transparent text-white/30 hover:bg-white/5 hover:text-white",
                                )}
                              >
                                <Settings2 className="size-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {view === "time-alignment-form" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
              <button
                type="button"
                onClick={() => setView("picker")}
                className="text-[11px] text-white/50 hover:text-white transition-all flex items-center gap-1.5"
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
                          <p className="text-[13px] font-medium text-white/90 truncate">
                            {source.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Clock className="size-3 text-white/30" />
                            <p className="text-[11px] font-mono text-white/50">
                              {offset === 0 ? "0s" : `${offset > 0 ? "+" : ""}${offset}s`}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTimeShiftSource(source.path)}
                          className="px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-[11px] font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all"
                        >
                          Sync
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {view === "ai-context-form" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300 flex flex-col h-full">
              <button
                type="button"
                onClick={() => setView("picker")}
                className="text-[11px] text-white/50 hover:text-white transition-all flex items-center gap-1.5"
              >
                ← Back
              </button>

              <div className="flex-1 flex flex-col space-y-3">
                <p className="text-[11px] text-white/50 font-medium">
                  Add architecture constraints for AI to know.
                </p>
                <textarea
                  value={tempContext}
                  onChange={(e) => setTempContext(e.target.value)}
                  placeholder="Define schemas or domains..."
                  className="w-full min-h-[300px] bg-white/[0.02] border border-white/10 rounded-lg p-4 text-[13px] text-white/80 outline-none focus:border-white/30 transition-all placeholder:text-white/20 custom-scrollbar font-mono resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {view !== "picker" && (
          <div className="p-4 border-t border-white/5 bg-white/[0.01] shrink-0">
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="flex-1 h-9 text-xs font-medium text-white/60 hover:text-white hover:bg-white/5"
                onClick={() => setView("picker")}
              >
                Cancel
              </Button>
              {view === "ai-context-form" && (
                <Button
                  className="flex-1 h-9 text-xs font-medium bg-white text-black hover:bg-white/90"
                  onClick={() => {
                    setWorkspaceGlobalContext(tempContext.trim() || null);
                    toast.success("Cognition saved");
                    setView("picker");
                  }}
                >
                  Save
                </Button>
              )}
              {view === "time-alignment-form" && (
                <Button
                  className="flex-1 h-9 text-xs font-medium bg-white text-black hover:bg-white/90"
                  onClick={saveTemporalOffsets}
                  disabled={isSaving}
                >
                  {isSaving ? "Syncing..." : "Apply"}
                </Button>
              )}
              {view === "fusion-form" && (
                <Button
                  className="flex-1 h-9 text-xs font-medium bg-white text-black hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed"
                  onClick={deployFusion}
                  disabled={isSaving || configs.filter((c) => c.enabled).length < 2}
                >
                  {isSaving ? "Saving..." : "Deploy"}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <CustomParserModal
        workspaceId={workspaceId}
        sourceId={activeParserSource ?? ""}
        isOpen={!!activeParserSource}
        onClose={() => setActiveParserSource(null)}
        initialConfig={configs.find((c) => c.source_id === activeParserSource)?.parser_config ?? ""}
        onSaved={(config) => handleParserSaved(activeParserSource ?? "", config)}
      />

      {activeTimeShiftSource && (
        <TimeShiftModal
          isOpen={true}
          onClose={() => setActiveTimeShiftSource(null)}
          sourceLabel={
            availableSources.find((s) => s.path === activeTimeShiftSource)?.name ??
            activeTimeShiftSource.split("/").pop() ??
            "Log Source"
          }
          initialShiftSeconds={temporalOffsets[activeTimeShiftSource] ?? 0}
          onSaved={(secs) => {
            setTemporalOffsets((prev) => ({
              ...prev,
              [activeTimeShiftSource]: secs,
            }));
          }}
        />
      )}
    </>,
    document.body,
  );
}
