// Assume Role: Frontend Engineer (@frontend)

import { lazy, memo, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AIInvestigationSidebar } from "@/components/organisms/AIInvestigationSidebar";
import { ColumnManagerSidebar } from "@/components/organisms/ColumnManagerSidebar";
import { ExplorerView } from "@/components/organisms/ExplorerView";
import { FacetSidebar } from "@/components/organisms/FacetSidebar";
import { VirtualLogTable } from "@/components/organisms/VirtualLogTable";
import { InvestigationLayout } from "@/components/templates/InvestigationLayout";

const CustomParserModal = lazy(() =>
  import("@/components/organisms/CustomParserModal").then((m) => ({
    default: m.CustomParserModal,
  })),
);
const ImportFeedModal = lazy(() =>
  import("@/components/organisms/ImportFeedModal").then((m) => ({ default: m.ImportFeedModal })),
);
const OrchestratorHub = lazy(() =>
  import("@/components/organisms/OrchestratorHub").then((m) => ({ default: m.OrchestratorHub })),
);
const WorkspaceEngineSettings = lazy(() =>
  import("@/components/organisms/WorkspaceEngineSettings").then((m) => ({
    default: m.WorkspaceEngineSettings,
  })),
);

import { useIngestionStatus } from "@/lib/hooks/useIngestionStatus";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { useLogFetching } from "@/lib/hooks/useLogFetching";
import { useLogIngestion } from "@/lib/hooks/useLogIngestion";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { useAiStore } from "@/store/aiStore";
import { useIngestionStore } from "@/store/ingestionStore";
import { useInvestigationStore } from "@/store/investigationStore";
import { useSettingsStore } from "@/store/settingsStore";
import { type LogSource, selectActiveWorkspace, useWorkspaceStore } from "@/store/workspaceStore";

// ─── Component ────────────────────────────────────────────────────────────────

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
  const { setSidebarOpen, sendMessage, setSession } = useAiStore();

  const sources: LogSource[] = activeWorkspace?.sources ?? [];
  const activeSourceId = activeWorkspace?.activeSourceId ?? null;
  const activeFolderId = activeWorkspace?.activeFolderId ?? null;
  const hierarchy = activeWorkspace?.hierarchy;

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isEngineSettingsOpen, setIsEngineSettingsOpen] = useState(false);

  // Orchestrator Hub state
  const [isOrchestratorOpen, setIsOrchestratorOpen] = useState(false);
  const [editingFusionId, setEditingFusionId] = useState<string | null>(null);
  const [editingFusionName, setEditingFusionName] = useState<string | null>(null);

  // Parser Modal state
  const [activeParserSource, setActiveParserSource] = useState<string | null>(null);
  const [initialParserConfig, setInitialParserConfig] = useState<string | null>(null);

  // Ingestion status & notifications
  const { lastJob, jobs } = useIngestionStatus(activeWorkspaceId ?? "");
  const prevJobStatus = useRef<string | null>(null);
  const lastJobId = useRef<number | null>(null);
  const notifiedJobIds = useRef<Set<number>>(new Set());

  // Find the active job for the CURRENTLY SELECTED source
  const activeJobForSource = useMemo(() => {
    // Match any non-completed job (queued, pending, processing)
    // so the loading guard persists until ingestion is explicitly finished
    // even during tab switches when job state might briefly fluctuate.
    return (
      jobs.find(
        (j) =>
          j.source_id === activeSourceId &&
          (j.status === "queued" || j.status === "pending" || j.status === "processing"),
      ) || null
    );
  }, [jobs, activeSourceId]);

  // Clear logs immediately when the source or workspace changes to prevent "ghost data"
  useEffect(() => {
    if (!activeWorkspaceId || !activeSourceId) {
      return;
    }

    setLogs([], 0);
    setAvailableFacets({});
    useInvestigationStore.getState().setTimeRange({ start: "", end: "", label: "All Time" });
  }, [activeWorkspaceId, activeSourceId, setLogs, setAvailableFacets]);

  // Memoize the query params to reduce complexity in fetchLogs
  const { isFetching, isConnected, anomalousClusters, fetchLogs, fetchMoreLogs } = useLogFetching(
    activeWorkspaceId,
    activeSourceId,
  );

  const {
    tailingSourceIds,
    setTailingSourceIds,
    handleImportLocal,
    handleImportSSH,
    handleIngestManual,
    handleImportLive,
  } = useLogIngestion(activeWorkspaceId, fetchLogs);

  const ingestingSourceIds = useIngestionStore((state) => state.ingestingSourceIds);
  const transitioningSourceIds = useIngestionStore((state) => state.transitioningSourceIds);

  // Combined loading state for the table — covers three scenarios:
  // 1. Source is in the ingestingSourceIds set (startIngestion called)
  // 2. Source is transitioning (between callSidecar returning and first poll detecting a job)
  // 3. A queued/pending/processing job exists for this source
  // 4. Data is being fetched and no logs are loaded yet
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
    // Only block the whole view if we don't have any logs loaded yet
    return isFetching && logs.length === 0;
  }, [
    activeSourceId,
    ingestingSourceIds,
    transitioningSourceIds,
    activeJobForSource,
    isFetching,
    logs.length,
  ]);

  // Sync the currently active source's tailing status to the global isTailing store state
  useEffect(() => {
    const isActiveSourceTailing = activeSourceId ? tailingSourceIds.has(activeSourceId) : false;
    setTailing(isActiveSourceTailing);
  }, [activeSourceId, tailingSourceIds, setTailing]);

  // Clear transitioning state once a job for that source is detected as processing/completed
  useEffect(() => {
    const { removeTransitioningSource, transitioningSourceIds } = useIngestionStore.getState();
    for (const srcId of transitioningSourceIds) {
      const job = jobs.find((j) => j.source_id === srcId && j.status !== "queued");
      if (job) {
        // Job is now in processing/completed/failed — no longer just transitioning
        removeTransitioningSource(srcId);
      }
    }
  }, [jobs]);

  // Orchestrator Hub state

  // ── Polling logic ──────────────────────────────────────────────────────────

  // Stabilized polling interval.
  useEffect(() => {
    if (!activeWorkspaceId || !activeSourceId) {
      return;
    }

    const interval = setInterval(
      () => {
        // Only poll if we are tailing OR if there is an active ingestion job for this source.
        const shouldPoll = isTailing || !!activeJobForSource;

        if (shouldPoll && !isFetching) {
          fetchLogs();
        }
      },
      isTailing ? 1000 : 3000,
    ); // 1s for tailing, 3s for background ingestion monitoring

    return () => clearInterval(interval);
  }, [activeWorkspaceId, activeSourceId, isTailing, activeJobForSource, isFetching, fetchLogs]);

  // Initial fetch and fetch-on-demand for filter/search changes
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Search Bar Ref
  const searchRef = useRef<HTMLInputElement>(null);

  // Reset job tracking refs when activeWorkspaceId changes to prevent phantom notifications
  useEffect(() => {
    if (activeWorkspaceId) {
      lastJobId.current = null;
      prevJobStatus.current = null;
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (!lastJob) {
      return;
    }

    // Initialize refs on first job discovery to avoid "phantom" toasts for old jobs
    if (lastJobId.current === null) {
      lastJobId.current = lastJob.id;
      prevJobStatus.current = lastJob.status;
      if (lastJob.status === "completed" || lastJob.status === "failed") {
        notifiedJobIds.current.add(lastJob.id);
      }
      return;
    }

    // Monitor status transitions for the global lastJob (for toasts)
    if (lastJob.id !== lastJobId.current || lastJob.status !== prevJobStatus.current) {
      if (lastJob.status === "completed" && !notifiedJobIds.current.has(lastJob.id)) {
        notifiedJobIds.current.add(lastJob.id);
        toast.success("Ingestion complete", {
          id: "ingest",
          description: `Processed ${lastJob.total_lines.toLocaleString()} lines.`,
        });
        useIngestionStore.getState().stopIngestion(lastJob.source_id);
      } else if (lastJob.status === "failed" && !notifiedJobIds.current.has(lastJob.id)) {
        notifiedJobIds.current.add(lastJob.id);
        toast.error("Ingestion failed", {
          id: "ingest",
          description: "Check sidecar logs for details.",
        });
        useIngestionStore.getState().stopIngestion(lastJob.source_id);
      }

      lastJobId.current = lastJob.id;
      prevJobStatus.current = lastJob.status;
    }
  }, [lastJob]);

  // Specific effect to trigger fetchLogs when the job for the ACTIVE source completes
  const completedJobIds = useRef<Set<number>>(new Set());
  useEffect(() => {
    const sourceJob = jobs.find((j) => j.source_id === activeSourceId);
    if (!sourceJob) {
      return;
    }

    if (sourceJob.status === "completed" && !completedJobIds.current.has(sourceJob.id)) {
      completedJobIds.current.add(sourceJob.id);
      fetchLogs({ forceFull: true });
    }
  }, [jobs, activeSourceId, fetchLogs]);

  // Memoized non-fusion sources
  const nonFusionSources = useMemo(() => sources.filter((s) => s.type !== "fusion"), [sources]);

  // ── Event Listeners ────────────────────────────────────────────────────────

  useEffect(() => {
    const handleRefresh = () => fetchLogs();
    const handleClear = () => {
      setSearchQuery("");
      setFilters([]);
      setHighlights([]);
      toast.info("Filters cleared");
    };

    globalThis.addEventListener("loglens:refresh-logs", handleRefresh);
    globalThis.addEventListener("loglens:clear-filters", handleClear);
    return () => {
      globalThis.removeEventListener("loglens:refresh-logs", handleRefresh);
      globalThis.removeEventListener("loglens:clear-filters", handleClear);
    };
  }, [fetchLogs, setSearchQuery, setFilters, setHighlights]);

  // ── Keyboard Shortcuts ─────────────────────────────────────────────────────

  useKeyboardShortcuts([
    {
      key: "f",
      ctrl: true,
      description: "Focus Search",
      handler: () => searchRef.current?.focus(),
    },
    {
      key: "r",
      description: "Refresh Logs",
      handler: () => fetchLogs(),
    },
    {
      key: "Escape",
      description: "Clear Filters",
      handler: () => {
        setSearchQuery("");
        setFilters([]);
        setHighlights([]);
      },
    },
  ]);

  // ── State Synchronization ──────────────────────────────────────────────────

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
        const { useIngestionStore } = await import("@/store/ingestionStore");
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
        const { useIngestionStore } = await import("@/store/ingestionStore");
        useIngestionStore.getState().removeLiveSource();

        toast.info(`Live monitoring stopped for ${src.name}`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to update monitoring state.");
    }
  };

  const handleSelectSource = (sourceId: string | null) =>
    setActiveSource(activeWorkspaceId, sourceId);
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

    // If we just removed the active source, clear the logs immediately to avoid "ghost logs"
    if (activeSourceId === sourceId) {
      setLogs([], 0);
      setAvailableFacets({});
    }

    // Also wipe the logs from the database for this specific source
    try {
      await callSidecar({
        method: "delete_logs",
        params: { workspace_id: activeWorkspaceId, source_id: src?.id },
      });
      // Refresh to ensure any aggregate views are updated,
      // but only if we still have a valid selection context
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

  const handleExport = async () => {
    if (!activeWorkspaceId) {
      return;
    }

    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const path = await save({
        title: "Export Logs",
        filters: [
          { name: "CSV", extensions: ["csv"] },
          { name: "JSON", extensions: ["json"] },
        ],
        defaultPath: `loglens_export_${new Date().toISOString().split("T")[0]}.csv`,
      });

      if (!path) {
        return;
      }

      const format = path.endsWith(".json") ? "json" : "csv";

      toast.loading(`Exporting logs to ${format.toUpperCase()}...`, { id: "export" });

      const activeSource = sources.find((s) => s.id === activeSourceId);
      const isFusion = activeSource?.type === "fusion";
      const fusionId = isFusion ? activeSource.path : null;

      await callSidecar({
        method: "export_logs",
        params: {
          workspace_id: activeWorkspaceId,
          filepath: path,
          format,
          query: searchQuery || undefined,
          filters: filters.length > 0 ? filters : undefined,
          fusion_id: fusionId,
          start_time: timeRange.start || undefined,
          end_time: timeRange.end || undefined,
        },
      });

      toast.success("Export complete", { id: "export", description: `Saved to ${path}` });
    } catch (e) {
      console.error("Export failed", e);
      toast.error("Export failed", { id: "export" });
    }
  };

  const handleAnalyzeCluster = async (clusterId: string) => {
    // Collect up to 5 log IDs belonging to this cluster to avoid token explosion
    const clusterLogs = logs.filter((l) => l.cluster_id === clusterId);
    const logIds = clusterLogs.slice(0, 5).map((l) => l.id);
    const template = clusterLogs[0]?.cluster_template || "N/A";

    if (logIds.length === 0) {
      toast.warning(`No logs found for cluster #${clusterId}`);
      return;
    }

    // Open sidebar and start a fresh session for this cluster
    setSession(null);
    setSidebarOpen(true);

    // Auto-send a focused analysis prompt with cluster logs as context
    const prompt = `Analyze log cluster #${clusterId} (${logIds.length} logs, template: "${template}"). What pattern do these logs represent? Are there any anomalies, errors, or performance concerns? Provide a root cause analysis and recommended actions.`;

    await sendMessage({
      workspace_id: activeWorkspaceId,
      message: prompt,
      context_logs: logIds,
      session_name: `Cluster #${clusterId}`,
    });
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
        onImportOpen={() => setIsImportOpen(true)}
        onOrchestrateOpen={handleOrchestrateOpen}
        sources={sources}
        activeSourceId={activeSourceId}
        tailingSourceIds={tailingSourceIds}
        onSelectSource={handleSelectSource}
        onRemoveSource={handleRemoveSource}
        onEditFusion={handleEditFusion}
        onRenameSource={renameSource}
        showDistribution={showDistribution && !!activeSourceId}
        onDistributionClose={() => setShowDistribution(!showDistribution)}
        workspaceId={activeWorkspaceId}
        leftPanel={
          <>
            <FacetSidebar />
            <ColumnManagerSidebar />
          </>
        }
        rightPanel={
          <AIInvestigationSidebar onEngineSettingsOpen={() => setIsEngineSettingsOpen(true)} />
        }
      >
        {activeSourceId ? (
          <VirtualLogTable
            logs={logs}
            highlights={highlights}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            anomalousClusters={anomalousClusters}
            activeJob={activeJobForSource}
            isTransitioning={isSourceLoading}
            fetchMoreLogs={fetchMoreLogs}
            total={total}
            isFetching={isFetching}
            onAddComment={(id, comment) => {
              const has_comment = comment.trim().length > 0;
              const originalLog = logs.find((l) => l.id === id);
              updateLog(id, { comment, has_comment });
              callSidecar({ method: "update_log_comment", params: { log_id: id, comment } })
                .then(() => toast.success("Annotation saved"))
                .catch(() => {
                  if (originalLog) {
                    updateLog(id, {
                      comment: originalLog.comment,
                      has_comment: originalLog.has_comment,
                    });
                  }
                  toast.error("Failed to save annotation");
                });
            }}
            onAnalyzeCluster={handleAnalyzeCluster}
            onOpenParser={(sourceId) => {
              setActiveParserSource(sourceId);
              setInitialParserConfig(null); // Fetch latest from sidecar if needed
            }}
            onImport={() => setIsImportOpen(true)}
          />
        ) : (
          <ExplorerView
            folderId={activeFolderId}
            hierarchy={hierarchy}
            onSelectFolder={(id) => setActiveFolder(activeWorkspaceId ?? "", id)}
            onSelectSource={(id) => setActiveSource(activeWorkspaceId ?? "", id)}
            onCreateFolder={(name) => createFolder(activeWorkspaceId ?? "", name)}
            onImportOpen={() => setIsImportOpen(true)}
            workspaceName={activeWorkspace?.name}
            onRenameFolder={async (id, name) => {
              await updateFolder(id, name);
            }}
            onDeleteFolder={async (id) => {
              await deleteFolder(id);
            }}
            onRenameSource={(id, name) => {
              if (activeWorkspaceId) {
                renameSource(activeWorkspaceId, id, name);
              }
            }}
            onDeleteSource={(id) => {
              handleRemoveSource(id);
            }}
          />
        )}
      </InvestigationLayout>

      {activeParserSource && (
        <Suspense fallback={null}>
          <CustomParserModal
            workspaceId={activeWorkspaceId ?? ""}
            sourceId={activeParserSource}
            isOpen={!!activeParserSource}
            onClose={() => setActiveParserSource(null)}
            initialConfig={initialParserConfig}
            onSaved={async (config) => {
              if (!activeWorkspaceId || !activeParserSource) {
                return;
              }
              try {
                // Update the source-specific parser in the DB
                // This is typically stored in fusion_configs or a dedicated table
                // For now, we'll assume we update the fusion config for the active source
                await callSidecar({
                  method: "update_source_parser",
                  params: {
                    workspace_id: activeWorkspaceId,
                    source_id: activeParserSource,
                    parser_config: config,
                  },
                });
                toast.success("Log parser re-calibrated.");
                fetchLogs();
              } catch (e) {
                console.error("Failed to update parser", e);
                toast.error("Failed to update log parser.");
              }
            }}
          />
        </Suspense>
      )}
      {isImportOpen && (
        <Suspense fallback={null}>
          <ImportFeedModal
            open={isImportOpen}
            onOpenChange={setIsImportOpen}
            onImportLocal={(path, tail) => handleImportLocal(path, tail, activeFolderId)}
            onImportSSH={(host, port, user, pass, path, tail) =>
              handleImportSSH(host, port, user, pass, path, tail, activeFolderId)
            }
            onIngestManual={(logs) => handleIngestManual(logs, activeFolderId)}
            onImportLive={(name, types) => handleImportLive(name, types, activeFolderId)}
          />
        </Suspense>
      )}

      {isOrchestratorOpen && (
        <Suspense fallback={null}>
          <OrchestratorHub
            isOpen={isOrchestratorOpen}
            onClose={() => setIsOrchestratorOpen(false)}
            workspaceId={activeWorkspaceId}
            availableSources={nonFusionSources}
            editingFusionId={editingFusionId}
            editingFusionName={editingFusionName}
            onEngineSettingsOpen={() => setIsEngineSettingsOpen(true)}
            onFusionSaved={handleFusionSaved}
          />
        </Suspense>
      )}
      {isEngineSettingsOpen && (
        <Suspense fallback={null}>
          <WorkspaceEngineSettings
            isOpen={isEngineSettingsOpen}
            onClose={() => setIsEngineSettingsOpen(false)}
            workspaceId={activeWorkspaceId}
          />
        </Suspense>
      )}
    </>
  );
}

export const InvestigationPage = memo(InvestigationPageImpl);
