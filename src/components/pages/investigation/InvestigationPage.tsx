// Assume Role: Frontend Engineer (@frontend)

import { InvestigationLayout } from "@/components/templates/InvestigationLayout";
import { useLogIngestion } from "@/lib/hooks/ingestion";
import { useIngestionStatus } from "@/lib/hooks/useIngestionStatus";
import { useLogFetching } from "@/lib/hooks/useLogFetching";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { useIngestionStore } from "@/store/ingestion";
import { useInvestigationStore } from "@/store/investigationStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUIStore } from "@/store/uiStore";
import { type LogSource, selectActiveWorkspace, useWorkspaceStore } from "@/store/workspaceStore";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { InvestigationModals } from "./components/InvestigationModals";
import {
  InvestigationLeftSidebar,
  InvestigationRightSidebar,
} from "./components/InvestigationSidebars";
import { InvestigationTableArea } from "./components/InvestigationTableArea";
import { useInvestigationExport } from "./hooks/useInvestigationExport";
import { useInvestigationShortcuts } from "./hooks/useInvestigationShortcuts";

function InvestigationPageImpl() {
  const {
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    highlights,
    setHighlights,
    logs,
    setLogs,
    updateLog,
    isTailing,
    setTailing,
    sortBy,
    sortOrder,
    setSort,
    showDistribution,
    setShowDistribution,
    timeRange,
    syncActiveSource,
    setAvailableFacets,
    total,
  } = useInvestigationStore();

  const {
    activeWorkspaceId,
    createSource,
    removeSource,
    setActiveSource,
    renameSource,
    updateSource,
    setActiveFolder,
    createFolder,
    deleteFolder,
    updateFolder,
  } = useWorkspaceStore();
  const { fetchSettings } = useSettingsStore();
  const activeWorkspace = useWorkspaceStore(selectActiveWorkspace);

  const sources: LogSource[] = activeWorkspace?.sources ?? [];
  const activeSourceId = activeWorkspace?.activeSourceId ?? null;
  const activeFolderId = activeWorkspace?.activeFolderId ?? null;

  const isImportOpen = useIngestionStore((state) => state.isImportOpen);
  const setIsImportOpen = useIngestionStore((state) => state.setImportOpen);

  const handleOpenImport = () => {
    const isProcessing = useIngestionStore.getState().isImportProcessing;
    if (!isProcessing) {
      useIngestionStore.getState().resetImportForm();
    }
    setIsImportOpen(true);
  };

  const [isEngineSettingsOpen, setIsEngineSettingsOpen] = useState(false);
  const [isOrchestratorOpen, setIsOrchestratorOpen] = useState(false);
  const [editingFusionId, setEditingFusionId] = useState<string | null>(null);
  const [editingFusionName, setEditingFusionName] = useState<string | null>(null);
  const [activeParserSource, setActiveParserSource] = useState<string | null>(null);
  const [initialParserConfig, setInitialParserConfig] = useState<string | null>(null);

  const { jobs } = useIngestionStatus(activeWorkspaceId ?? "");

  const activeJobForSource = useMemo(() => {
    return (
      jobs.find(
        (j) =>
          j.source_id === activeSourceId &&
          (j.status === "queued" || j.status === "pending" || j.status === "processing"),
      ) || null
    );
  }, [jobs, activeSourceId]);

  const retrievingSourceIds = useIngestionStore((state) => state.retrievingSourceIds);
  const ingestingSourceIds = useIngestionStore((state) => state.ingestingSourceIds);
  const transitioningSourceIds = useIngestionStore((state) => state.transitioningSourceIds);

  const lastSourceRef = useRef<string | null>(null);
  const lastWorkspaceRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeWorkspaceId) {
      return;
    }

    const isWorkspaceChanged =
      lastWorkspaceRef.current && lastWorkspaceRef.current !== activeWorkspaceId;

    if (isWorkspaceChanged) {
      setLogs([], 0);
      setAvailableFacets({});
      useInvestigationStore.getState().setTimeRange({ start: "", end: "", label: "All Time" });
    }

    if (activeSourceId) {
      lastSourceRef.current = activeSourceId;
    }
    lastWorkspaceRef.current = activeWorkspaceId;
  }, [activeWorkspaceId, activeSourceId, setLogs, setAvailableFacets]);

  const { isFetching, isConnected, anomalousClusters, fetchLogs, fetchMoreLogs, loadedSourceId } =
    useLogFetching(activeWorkspaceId, activeSourceId);

  const {
    tailingSourceIds,
    setTailingSourceIds,
    handleImportLocal,
    duplicateSource,
    handleImportSSH,
    handleIngestManual,
    handleImportLive,
  } = useLogIngestion(activeWorkspaceId);

  const isSourceLoading = useMemo(() => {
    if (activeSourceId && ingestingSourceIds.includes(activeSourceId)) {
      return true;
    }
    if (activeSourceId && transitioningSourceIds.has(activeSourceId)) {
      return true;
    }
    if (activeJobForSource) {
      return true;
    }
    if (activeSourceId && retrievingSourceIds.has(activeSourceId)) {
      return true;
    }
    if (activeSourceId && loadedSourceId !== activeSourceId) {
      return true;
    }
    return isFetching && logs.length === 0;
  }, [
    activeSourceId,
    loadedSourceId,
    ingestingSourceIds,
    transitioningSourceIds,
    activeJobForSource,
    retrievingSourceIds,
    isFetching,
    logs.length,
  ]);

  useEffect(() => {
    const isActiveSourceTailing = activeSourceId ? tailingSourceIds.has(activeSourceId) : false;
    setTailing(isActiveSourceTailing);
  }, [activeSourceId, tailingSourceIds, setTailing]);

  useEffect(() => {
    const { removeTransitioningSource } = useIngestionStore.getState();
    for (const srcId of transitioningSourceIds) {
      const job = jobs.find((j) => j.source_id === srcId);
      if (job) {
        removeTransitioningSource(srcId);
      }
    }
  }, [jobs, transitioningSourceIds]);

  useEffect(() => {
    if (!activeWorkspaceId || !activeSourceId || !isTailing) {
      return;
    }
    const interval = setInterval(() => {
      if (!isFetching) {
        fetchLogs();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [activeWorkspaceId, activeSourceId, isTailing, isFetching, fetchLogs]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const prevActiveJobRef = useRef<boolean>(false);
  useEffect(() => {
    const hasJob = !!activeJobForSource;
    if (prevActiveJobRef.current && !hasJob) {
      fetchLogs({ forceFull: true });
    }
    prevActiveJobRef.current = hasJob;
  }, [activeJobForSource, fetchLogs]);

  const searchRef = useRef<HTMLInputElement>(null);
  const nonFusionSources = useMemo(() => sources.filter((s) => s.type !== "fusion"), [sources]);

  useInvestigationShortcuts({
    searchRef,
    fetchLogs,
    setSearchQuery,
    setFilters,
    setHighlights,
  });

  const { handleExport } = useInvestigationExport({
    activeWorkspaceId,
    activeSourceId,
    sources,
    searchQuery,
    filters,
    sortBy,
    sortOrder,
    timeRange,
  });

  useEffect(() => {
    if (activeWorkspaceId) {
      fetchSettings(activeWorkspaceId);
    }
  }, [activeWorkspaceId, fetchSettings]);

  useEffect(() => {
    syncActiveSource(activeSourceId);
  }, [activeSourceId, syncActiveSource]);

  const handleSort = (field: string) => {
    setSort(field, sortBy === field && sortOrder === "asc" ? "desc" : "asc");
  };

  const handleToggleTail = async (tail: boolean) => {
    if (!activeSourceId) {
      toast.warning("No active log source selected.");
      return;
    }
    const src = sources.find((s) => s.id === activeSourceId);
    if (!src) {
      toast.error("Active source not found.");
      return;
    }

    try {
      if (tail) {
        await callSidecar({
          method: "start_tail",
          params: {
            filepath: src.path,
            workspace_id: activeWorkspaceId,
            source_id: src.id,
          },
        });
        setTailingSourceIds((prev) => {
          const next = new Set(prev);
          next.add(src.id);
          return next;
        });
        useIngestionStore.getState().addLiveSource();
        useIngestionStore.getState().startPolling(activeWorkspaceId ?? "");

        toast.success(`Live monitoring active for ${src.name}`);
      } else {
        await callSidecar({
          method: "stop_tail",
          params: {
            filepath: src.path,
            workspace_id: activeWorkspaceId,
            source_id: src.id,
          },
        });
        setTailingSourceIds((prev) => {
          const next = new Set(prev);
          next.delete(src.id);
          return next;
        });
        useIngestionStore.getState().removeLiveSource();

        toast.info(`Live monitoring stopped for ${src.name}`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to update monitoring state.");
    }
  };

  const handleSelectSource = (sourceId: string | null) => {
    setActiveSource(activeWorkspaceId, sourceId);
  };

  const handleRemoveSource = async (sourceId: string) => {
    const src = sources.find((s) => s.id === sourceId);
    if (src && tailingSourceIds.has(sourceId)) {
      try {
        await callSidecar({
          method: "stop_tail",
          params: {
            filepath: src.path,
            workspace_id: activeWorkspaceId,
            source_id: src.id,
          },
        });
      } catch {
        /* Ignored */
      }
      setTailingSourceIds((prev) => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
    }
    removeSource(activeWorkspaceId, sourceId);

    if (activeSourceId === sourceId) {
      setLogs([], 0);
      setAvailableFacets({});
    }

    try {
      await callSidecar({
        method: "delete_logs",
        params: { workspace_id: activeWorkspaceId, source_id: src?.id },
      });
      if (activeSourceId && activeSourceId !== sourceId) {
        fetchLogs();
      }
    } catch (e) {
      console.warn("Failed to delete logs for removed source:", e);
    }
  };

  const handleOrchestrateOpen = () => {
    setEditingFusionId(null);
    setEditingFusionName(null);
    setIsOrchestratorOpen(true);
  };

  const handleEditFusion = (sourceId: string) => {
    const src = sources.find((s) => s.id === sourceId);
    if (!src) {
      return;
    }
    setEditingFusionId(src.path);
    setEditingFusionName(src.name);
    setIsOrchestratorOpen(true);
  };

  const handleFusionSaved = async (fusionId: string, fusionName: string) => {
    const existingSrc = sources.find((s) => s.path === fusionId);
    if (existingSrc) {
      updateSource(activeWorkspaceId, existingSrc.id, { name: fusionName });
    } else {
      const newSrc = await createSource(activeWorkspaceId, {
        name: fusionName,
        type: "fusion",
        path: fusionId,
      });
      setActiveSource(activeWorkspaceId, newSrc.id);
    }
  };

  const handleAnalyzeCluster = async (clusterId: string) => {
    const clusterLogs = logs.filter((l) => l.cluster_id === clusterId);
    if (clusterLogs.length === 0) {
      toast.warning(`No logs found for cluster #${clusterId}`);
      return;
    }

    // Launch instant RAG diagnostic pre-check in DiagnosticSidebar
    await useUIStore.getState().openDiagnostic(clusterId, activeWorkspaceId);
  };

  return (
    <>
      <InvestigationLayout
        searchRef={searchRef}
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        onExport={handleExport}
        activeFilters={filters}
        onFilterChange={setFilters}
        activeHighlights={highlights}
        onHighlightChange={setHighlights}
        isTailing={isTailing}
        onTailToggle={handleToggleTail}
        status={isConnected}
        onImportOpen={handleOpenImport}
        onOrchestrateOpen={handleOrchestrateOpen}
        sources={sources}
        activeSourceId={activeSourceId}
        tailingSourceIds={tailingSourceIds}
        onSelectSource={handleSelectSource}
        onRemoveSource={handleRemoveSource}
        onDuplicateSource={duplicateSource}
        onEditFusion={handleEditFusion}
        onRenameSource={renameSource}
        showDistribution={showDistribution && !!activeSourceId}
        onDistributionClose={() => setShowDistribution(!showDistribution)}
        workspaceId={activeWorkspaceId}
        leftPanel={
          <InvestigationLeftSidebar
            isSourceLoading={isSourceLoading}
            isFetching={isFetching}
            hasActiveJob={!!activeJobForSource}
          />
        }
        rightPanel={
          <InvestigationRightSidebar onEngineSettingsOpen={() => setIsEngineSettingsOpen(true)} />
        }
      >
        <InvestigationTableArea
          activeSourceId={activeSourceId}
          activeWorkspaceId={activeWorkspaceId}
          activeWorkspace={activeWorkspace}
          activeFolderId={activeFolderId}
          logs={logs}
          highlights={highlights}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          anomalousClusters={anomalousClusters}
          activeJobForSource={activeJobForSource}
          isSourceLoading={isSourceLoading}
          fetchMoreLogs={fetchMoreLogs}
          total={total}
          isFetching={isFetching}
          updateLog={updateLog}
          onAnalyzeCluster={handleAnalyzeCluster}
          onOpenParser={(sourceId) => {
            setActiveParserSource(sourceId);
            setInitialParserConfig(null);
          }}
          onOpenImport={handleOpenImport}
          setActiveFolder={setActiveFolder}
          setActiveSource={setActiveSource}
          createFolder={createFolder}
          updateFolder={updateFolder}
          deleteFolder={deleteFolder}
          renameSource={renameSource}
          handleRemoveSource={handleRemoveSource}
        />
      </InvestigationLayout>

      <InvestigationModals
        activeWorkspaceId={activeWorkspaceId}
        activeFolderId={activeFolderId}
        activeParserSource={activeParserSource}
        initialParserConfig={initialParserConfig}
        onCloseParser={() => setActiveParserSource(null)}
        onParserSaved={fetchLogs}
        isImportOpen={isImportOpen}
        onImportLocal={handleImportLocal}
        onImportSSH={handleImportSSH}
        onIngestManual={handleIngestManual}
        onImportLive={handleImportLive}
        isOrchestratorOpen={isOrchestratorOpen}
        onCloseOrchestrator={() => setIsOrchestratorOpen(false)}
        nonFusionSources={nonFusionSources}
        editingFusionId={editingFusionId}
        editingFusionName={editingFusionName}
        onEngineSettingsOpen={() => setIsEngineSettingsOpen(true)}
        onFusionSaved={handleFusionSaved}
        isEngineSettingsOpen={isEngineSettingsOpen}
        onCloseEngineSettings={() => setIsEngineSettingsOpen(false)}
      />
    </>
  );
}

export const InvestigationPage = memo(InvestigationPageImpl);
