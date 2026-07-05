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
import { useIngestionStore, type IngestionJob } from "@/store/ingestionStore";
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

  // Orchestrator Hub state
  const [isOrchestratorOpen, setIsOrchestratorOpen] = useState(false);
  const [editingFusionId, setEditingFusionId] = useState<string | null>(null);
  const [editingFusionName, setEditingFusionName] = useState<string | null>(null);

  // Parser Modal state
  const [activeParserSource, setActiveParserSource] = useState<string | null>(null);
  const [initialParserConfig, setInitialParserConfig] = useState<string | null>(null);

  // Ingestion status & notifications
  const { jobs } = useIngestionStatus(activeWorkspaceId ?? "");

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

  // Tracks sources whose job just completed but fetchLogs hasn't returned data yet.
  // Prevents the overlay from dropping the instant the job flips to "completed"
  // before the log rows actually arrive in the table.
  const [retrievingSourceIds, setRetrievingSourceIds] = useState<Set<string>>(new Set());

  // These subscriptions must be declared BEFORE the source-switch useEffect below,
  // which references transitioningSourceIds reactively.
  const ingestingSourceIds = useIngestionStore((state) => state.ingestingSourceIds);
  const transitioningSourceIds = useIngestionStore((state) => state.transitioningSourceIds);

  const lastSourceRef = useRef<string | null>(null);
  const lastWorkspaceRef = useRef<string | null>(null);

  // Clear logs immediately when switching to a DIFFERENT source or workspace to prevent "ghost data".
  // Do NOT clear if we just deselected the source (activeSourceId is null), so the state
  // is preserved when navigating to the workspace overview and back.
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
    } else if (
      activeSourceId &&
      lastSourceRef.current &&
      lastSourceRef.current !== activeSourceId
    ) {
      // Read transitioningSourceIds reactively via the prop already subscribed at line 165,
      // NOT via getState() which is a stale snapshot at the time this effect runs.
      const isTransitioning = transitioningSourceIds.has(activeSourceId);
      const isRetrieving = retrievingSourceIds.has(activeSourceId);
      if (!activeJobForSource && !isTransitioning && !isRetrieving) {
        setLogs([], 0);
        setAvailableFacets({});
        useInvestigationStore.getState().setTimeRange({ start: "", end: "", label: "All Time" });
      }
    }

    if (activeSourceId) {
      lastSourceRef.current = activeSourceId;
    }
    lastWorkspaceRef.current = activeWorkspaceId;
  }, [
    activeWorkspaceId,
    activeSourceId,
    activeJobForSource,
    retrievingSourceIds,
    transitioningSourceIds,
    setLogs,
    setAvailableFacets,
  ]);

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
  } = useLogIngestion(activeWorkspaceId);

  // Combined loading state for the table — covers four scenarios:
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
    // Keep overlay up while we are fetching post-completion logs for this source
    if (activeSourceId && retrievingSourceIds.has(activeSourceId)) {
      return true;
    }
    // Only block the whole view if we don't have any logs loaded yet
    return isFetching && logs.length === 0;
  }, [
    activeSourceId,
    ingestingSourceIds,
    transitioningSourceIds,
    activeJobForSource,
    retrievingSourceIds,
    isFetching,
    logs.length,
  ]);

  // Sync the currently active source's tailing status to the global isTailing store state
  useEffect(() => {
    const isActiveSourceTailing = activeSourceId ? tailingSourceIds.has(activeSourceId) : false;
    setTailing(isActiveSourceTailing);
  }, [activeSourceId, tailingSourceIds, setTailing]);

  // Clear transitioning state once a job for that source is detected.
  // Uses the reactive transitioningSourceIds subscription (not getState snapshot)
  // so this effect sees the latest set on every render.
  useEffect(() => {
    const { removeTransitioningSource } = useIngestionStore.getState();
    for (const srcId of transitioningSourceIds) {
      const job = jobs.find((j) => j.source_id === srcId);
      if (job) {
        // Job is enqueued or processing — no longer just preparing
        removeTransitioningSource(srcId);
      }
    }
  }, [jobs, transitioningSourceIds]);

  // ── P2 FIX: Restore ingestion state from sidecar on mount ──────────────────
  // When the page loads (or after a refresh), query the sidecar for any active
  // ingestion jobs and restore them to the Zustand store. This ensures that:
  // 1. The loading overlay shows correctly if ingestion is still in progress
  // 2. Polling resumes automatically for any interrupted jobs
  // 3. The user sees "Preparing..." or "Indexing..." even after a page reload
  useEffect(() => {
    if (!activeWorkspaceId) {
      return;
    }

    const restoreIngestionState = async () => {
      try {
        const fetchedJobs = await callSidecar<IngestionJob[]>({
          method: "get_ingestion_jobs",
          params: { workspace_id: activeWorkspaceId },
          silent: true,
        });

        if (!fetchedJobs || fetchedJobs.length === 0) {
          return;
        }

        const store = useIngestionStore.getState();

        for (const job of fetchedJobs) {
          // Only restore active jobs (not completed/failed)
          if (job.status === "queued" || job.status === "pending" || job.status === "processing") {
            // Add the job to the store
            store.addOrUpdateJob(job);

            // Restore ingestion tracking for the source
            store.startIngestion(job.source_id);

            // Mark as transitioning if we haven't detected the job yet
            if (job.status === "queued" || job.status === "pending") {
              store.addTransitioningSource(job.source_id);
            }

            // If job is already processing, remove transitioning state
            if (job.status === "processing") {
              store.removeTransitioningSource(job.source_id);
            }
          }
        }

        // Resume polling for active jobs
        const hasActiveJobs = fetchedJobs.some(
          (j) => j.status === "queued" || j.status === "pending" || j.status === "processing",
        );
        if (hasActiveJobs) {
          store.startPolling(activeWorkspaceId);
        }

        console.log(`[InvestigationPage] Restored ${fetchedJobs.length} ingestion jobs from sidecar`);
      } catch (err) {
        console.error("[InvestigationPage] Failed to restore ingestion state:", err);
      }
    };

    restoreIngestionState();
  }, [activeWorkspaceId]);

  // ── Polling logic ──────────────────────────────────────────────────────────
  // NOTE: Log polling during ingestion is handled exclusively by ingestionStore.startPolling().
  // A separate setInterval here was removed because it caused duplicate state transitions
  // that raced with the ingestionStore poller and caused overlay flickering.
  // For live tailing, the isTailing flag drives periodic fetches via the effect below.

  // Tailing-only fetch interval (only active during live tail, NOT during ingestion).
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

  // Initial fetch and fetch-on-demand for filter/search changes
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Search Bar Ref
  const searchRef = useRef<HTMLInputElement>(null);

  // ── P1 FIX: Job completion handler ──────────────────────────────────────────
  // P1 FIX: Removed redundant fetchLogs() call here. The useEffect([fetchLogs])
  // at line ~305 handles fetching logs after job completion. Calling fetchLogs here
  // AND in the useEffect created a race condition where both could fire concurrently.
  //
  // CRITICAL ORDER OF OPERATIONS:
  //   1. Mark source as "retrieving" so the overlay stays up (no flash to "empty")
  //   2. Fetch hierarchy FIRST so is_uploaded becomes true before overlay drops
  //   3. Clear completed job from store
  //   4. Stop ingestion tracking
  //   5. Remove retrieving marker (after brief grace period)
  //
  // NOTE: fetchLogs() is NOT called here anymore. The useEffect([fetchLogs]) above
  // will automatically trigger when the store state changes (jobs updated, activeSourceId
  // stays the same, fetchLogs reference is stable via useCallback).
  //
  // NAVIGATION-SAFETY: Uses the global ingestionStore.handledJobIds instead of a
  // component-local useRef. This prevents InvestigationPage from re-processing the
  // same completion event after unmounting (e.g. Dashboard navigation) and remounting.

  useEffect(() => {
    for (const sourceJob of jobs) {
      if (sourceJob.status !== "completed") {
        continue;
      }

      // Use the global, navigation-persistent handledJobIds instead of a local ref.
      // This prevents re-processing when InvestigationPage remounts after navigation.
      if (useIngestionStore.getState().isJobHandled(sourceJob.id)) {
        continue;
      }

      // Mark handled IMMEDIATELY before any async work so concurrent re-renders
      // and remounts both see this job as already processed.
      useIngestionStore.getState().markJobHandled(sourceJob.id);

      // Snapshot IDs — closures below always use these, never stale reactive values
      const completedSourceId = sourceJob.source_id;
      const completedWorkspaceId = sourceJob.workspace_id;

      // Step 1: Mark as retrieving BEFORE any async work so overlay never drops prematurely
      setRetrievingSourceIds((prev) => {
        const next = new Set(prev);
        next.add(completedSourceId);
        return next;
      });

      (async () => {
        // Step 2: Refresh hierarchy FIRST — this sets is_uploaded=true on the source node.
        if (completedWorkspaceId) {
          await useWorkspaceStore.getState().fetchHierarchy(completedWorkspaceId);
        }

        // P1 FIX: Removed await fetchLogs({ forceFull: true }) here.
        // The useEffect([fetchLogs]) at the top of this component will automatically
        // detect the state change and trigger a fresh log fetch. This eliminates the
        // race condition between the completion handler and the useEffect.

        // Step 3: Clear the completed job from the store (happens AFTER hierarchy refresh)
        if (completedWorkspaceId) {
          useIngestionStore.getState().clearCompletedState(completedWorkspaceId, completedSourceId);
        }

        // Step 4: Stop ingestion tracking unconditionally for the source
        useIngestionStore.getState().stopIngestion(completedSourceId);

        // Brief grace period before removing the retrieving marker
        setTimeout(() => {
          setRetrievingSourceIds((prev) => {
            const next = new Set(prev);
            next.delete(completedSourceId);
            return next;
          });
          // Ensure ingestion is always cleared
          useIngestionStore.getState().stopIngestion(completedSourceId);
        }, 300);
      })();
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
        onImportOpen={handleOpenImport}
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
            onImport={handleOpenImport}
          />
        ) : (
          <ExplorerView
            folderId={activeFolderId}
            hierarchy={hierarchy}
            onSelectFolder={(id) => setActiveFolder(activeWorkspaceId ?? "", id)}
            onSelectSource={(id) => setActiveSource(activeWorkspaceId ?? "", id)}
            onCreateFolder={(name) => createFolder(activeWorkspaceId ?? "", name)}
            onImportOpen={handleOpenImport}
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
                // For now, we assume we update the fusion config for the active source
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