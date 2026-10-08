// Assume Role: Frontend Engineer (@frontend)

import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { useClusteringStore } from "@/store/clusteringStore";
import { useInvestigationStore } from "@/store/investigationStore";
import { Suspense, lazy, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { AiContextView } from "./components/AiContextView";
import { FusionFormView } from "./components/FusionFormView";
import { OrchestratorFooter } from "./components/OrchestratorFooter";
import { OrchestratorHeader } from "./components/OrchestratorHeader";
import { OrchestratorPickerView } from "./components/OrchestratorPickerView";
import { TimeAlignmentView } from "./components/TimeAlignmentView";
import type {
  DiscoveryTemplate,
  FusionSourceConfig,
  OrchestratorHubProps,
  OrchestratorView,
} from "./types";

const CustomParserModal = lazy(() =>
  import("../custom-parser").then((m) => ({ default: m.CustomParserModal })),
);
const TimeShiftModal = lazy(() =>
  import("../TimeShiftModal").then((m) => ({ default: m.TimeShiftModal })),
);

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
  const { status: clusteringStatus, fetchStatus, setPaused } = useClusteringStore();

  const [view, setView] = useState<OrchestratorView>("picker");
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

    fetchStatus(workspaceId);

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

    callSidecar<DiscoveryTemplate[]>({
      method: "get_templates",
      params: { workspace_id: workspaceId },
    }).then((res) => setTemplates(res || []));

    callSidecar<{ offsets: Record<string, number> }>({
      method: "get_temporal_offsets",
      params: { workspace_id: workspaceId },
    }).then((res) => setTemporalOffsets(res.offsets || {}));
  }, [isOpen, editingFusionId, editingFusionName, workspaceId, availableSources, fetchStatus]);

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
      console.error("Failed to calibrate temporal offsets", e);
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
    } catch (e) {
      console.error("Failed to deploy fusion", e);
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
      <div
        className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
        onPointerDown={onClose}
      />

      <div
        className="fixed top-0 right-0 bottom-0 z-[160] w-[380px] flex flex-col bg-bg-tooltip border-l border-border-subtle shadow-2xl animate-in slide-in-from-right duration-300 ease-out"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <OrchestratorHeader view={view} onClose={onClose} />

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
          {view === "picker" && (
            <OrchestratorPickerView
              showDistribution={showDistribution}
              setShowDistribution={setShowDistribution}
              showAnomalies={showAnomalies}
              setShowAnomalies={setShowAnomalies}
              workspaceGlobalContext={workspaceGlobalContext}
              onOpenAiContext={() => {
                setTempContext(workspaceGlobalContext ?? "");
                setView("ai-context-form");
              }}
              clusteringStatus={clusteringStatus}
              onToggleClustering={(checked) => setPaused(!checked, workspaceId)}
              onConfigureEngine={() => {
                onClose();
                onEngineSettingsOpen?.();
              }}
              onSelectView={setView}
            />
          )}

          {view === "fusion-form" && (
            <FusionFormView
              fusionName={fusionName}
              setFusionName={setFusionName}
              configs={configs}
              availableSources={availableSources}
              templates={templates}
              isLoadingConfig={isLoadingConfig}
              onToggleSource={toggleSource}
              onApplyTemplate={applyTemplateToSource}
              onOpenParser={setActiveParserSource}
              onBack={() => setView("picker")}
            />
          )}

          {view === "time-alignment-form" && (
            <TimeAlignmentView
              availableSources={availableSources}
              temporalOffsets={temporalOffsets}
              onSyncSource={setActiveTimeShiftSource}
              onBack={() => setView("picker")}
            />
          )}

          {view === "ai-context-form" && (
            <AiContextView
              tempContext={tempContext}
              setTempContext={setTempContext}
              onBack={() => setView("picker")}
            />
          )}
        </div>

        <OrchestratorFooter
          view={view}
          onCancel={() => setView("picker")}
          onSaveAiContext={() => {
            setWorkspaceGlobalContext(tempContext.trim() || null);
            toast.success("Cognition saved");
            setView("picker");
          }}
          onSaveTemporalOffsets={saveTemporalOffsets}
          onDeployFusion={deployFusion}
          isSaving={isSaving}
          canDeployFusion={configs.filter((c) => c.enabled).length >= 2}
        />
      </div>

      {activeParserSource && (
        <Suspense fallback={null}>
          <CustomParserModal
            workspaceId={workspaceId}
            sourceId={activeParserSource}
            isOpen={!!activeParserSource}
            onClose={() => setActiveParserSource(null)}
            initialConfig={
              configs.find((c) => c.source_id === activeParserSource)?.parser_config ?? ""
            }
            onSaved={(config) => handleParserSaved(activeParserSource, config)}
          />
        </Suspense>
      )}

      {activeTimeShiftSource && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}
    </>,
    document.body,
  );
}
