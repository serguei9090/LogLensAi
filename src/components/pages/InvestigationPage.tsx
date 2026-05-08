import { AIInvestigationSidebar } from "@/components/organisms/AIInvestigationSidebar";
import { CustomParserModal } from "@/components/organisms/CustomParserModal";
import { ExplorerView } from "@/components/organisms/ExplorerView";
import { FacetSidebar } from "@/components/organisms/FacetSidebar";
import { ImportFeedModal } from "@/components/organisms/ImportFeedModal";
import { OrchestratorHub } from "@/components/organisms/OrchestratorHub";
import type { LogEntry } from "@/components/organisms/VirtualLogTable";
import { VirtualLogTable } from "@/components/organisms/VirtualLogTable";
import { WorkspaceEngineSettings } from "@/components/organisms/WorkspaceEngineSettings";
import { InvestigationLayout } from "@/components/templates/InvestigationLayout";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { useIngestionStatus } from "@/lib/hooks/useIngestionStatus";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { useAiStore } from "@/store/aiStore";
import { useInvestigationStore } from "@/store/investigationStore";
import { useSettingsStore } from "@/store/settingsStore";
import { type LogSource, selectActiveWorkspace, useWorkspaceStore } from "@/store/workspaceStore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// ─── Local helpers ────────────────────────────────────────────────────────────

interface ManualLogEntry {
  raw_text: string;
  timestamp: string;
  level: string;
  source_id: string;
}

/** Parse raw pasted text into structured ManualLogEntry objects */
function parseManualLogs(raw: string): ManualLogEntry[] {
  const TS_RE = /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})\s*/;
  const LEVEL_RE = /\b(ERROR|WARN|WARNING|INFO|DEBUG|TRACE|FATAL|CRITICAL)\b/i;

  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const tsMatch = TS_RE.exec(line);
      const remainder = tsMatch ? line.slice(tsMatch[0].length) : line;
      const levelMatch = LEVEL_RE.exec(remainder);
      return {
        raw_text: line,
        timestamp: tsMatch ? tsMatch[1] : new Date().toISOString(),
        level: levelMatch ? levelMatch[1].toUpperCase() : "INFO",
        source_id: "manual",
      };
    });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InvestigationPage() {
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
    showAnomalies,
    timeRange,
    syncActiveSource,
    setAvailableFacets,
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
  } = useWorkspaceStore();
  const { fetchSettings } = useSettingsStore();
  const activeWorkspace = useWorkspaceStore(selectActiveWorkspace);
  const { setSidebarOpen, sendMessage, setSession } = useAiStore();

  const sources: LogSource[] = activeWorkspace?.sources ?? [];
  const activeSourceId = activeWorkspace?.activeSourceId ?? null;
  const activeFolderId = activeWorkspace?.activeFolderId ?? null;
  const hierarchy = activeWorkspace?.hierarchy;

  const [tailingSourceIds, setTailingSourceIds] = useState<Set<string>>(new Set());
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isEngineSettingsOpen, setIsEngineSettingsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  // Orchestrator Hub state
  const [isOrchestratorOpen, setIsOrchestratorOpen] = useState(false);
  const [editingFusionId, setEditingFusionId] = useState<string | null>(null);
  const [editingFusionName, setEditingFusionName] = useState<string | null>(null);

  // Parser Modal state
  const [activeParserSource, setActiveParserSource] = useState<string | null>(null);
  const [initialParserConfig, setInitialParserConfig] = useState<string | null>(null);

  // Anomalies state
  const [anomalousClusters, setAnomalousClusters] = useState<Set<string>>(new Set());

  // Ingestion status & notifications
  const { lastJob, jobs } = useIngestionStatus(activeWorkspaceId ?? "");
  const prevJobStatus = useRef<string | null>(null);
  const lastJobId = useRef<number | null>(null);

  // Ingestion transition state - tracks which source we just triggered ingestion for
  const [transitioningSourceId, setTransitioningSourceId] = useState<string | null>(null);

  // Clear transitioning state once a job for that source is detected
  useEffect(() => {
    if (jobs.some(j => j.source_id === transitioningSourceId && (j.status === 'processing' || j.status === 'pending'))) {
      setTransitioningSourceId(null);
    }
  }, [jobs, transitioningSourceId]);

  // Find the active job for the CURRENTLY SELECTED source
  const activeJobForSource = useMemo(() => {
    const job = jobs.find(j => j.source_id === activeSourceId && (j.status === 'processing' || j.status === 'pending'));
    // If we have an active job, we should also consider it "transitioning" to show the loading screen immediately
    return job || null;
  }, [jobs, activeSourceId]);

  // Combined loading state for the table
  const isSourceLoading = useMemo(() => {
    return transitioningSourceId === activeSourceId || !!activeJobForSource;
  }, [transitioningSourceId, activeSourceId, activeJobForSource]);

  // ── Log fetching ──────────────────────────────────────────────────────────

  const fetchLogs = useCallback(async () => {
    if (!activeWorkspaceId) {
      return;
    }

    // If no source is selected (Explorer/Folder view) or no sources exist,
    // clear everything to avoid stale data display.
    if (sources.length === 0 || !activeSourceId) {
      setLogs([], 0);
      setAvailableFacets({});
      return;
    }

    const currentSourceRef = activeSourceId;
    try {
      if (showAnomalies) {
        const anomRes = await callSidecar<{ anomalies: { cluster_id: string }[] }>({
          method: "get_anomalies",
          params: { workspace_id: activeWorkspaceId },
          silent: true,
        });
        if (currentSourceRef !== activeSourceId) return;
        setAnomalousClusters(new Set(anomRes.anomalies.map((a) => a.cluster_id)));
      } else {
        setAnomalousClusters(new Set());
      }

      const activeSrc = sources.find((s) => s.id === activeSourceId);
      const isFusion = activeSrc?.type === "fusion";
      const sourceFilter =
        activeSrc && !isFusion
          ? [{ field: "source_id", operator: "equals", value: activeSrc.id }]
          : [];
      const combinedFilters =
        filters.length > 0 || sourceFilter.length > 0 ? [...sourceFilter, ...filters] : undefined;
      const fusionId = isFusion ? activeSrc?.path : undefined;

      const result = await callSidecar<{ logs: LogEntry[]; total: number }>({
        method: isFusion ? "get_fused_logs" : "get_logs",
        params: {
          workspace_id: activeWorkspaceId,
          ...(fusionId ? { fusion_id: fusionId } : {}),
          offset: 0,
          limit: 1000,
          query: searchQuery || undefined,
          filters: combinedFilters,
          sort_by: sortBy,
          sort_order: sortOrder,
          start_time: timeRange.start || undefined,
          end_time: timeRange.end || undefined,
        },
        silent: true,
      });

      if (currentSourceRef !== activeSourceId) return;
      setLogs(result.logs ?? [], result.total ?? 0);

      const facetRes = await callSidecar<Record<string, { value: string; count: number }[]>>({
        method: "get_metadata_facets",
        params: {
          workspace_id: activeWorkspaceId,
          source_ids: activeSrc && !isFusion ? [activeSrc.id] : undefined,
        },
        silent: true,
      });
      
      if (currentSourceRef !== activeSourceId) return;
      setAvailableFacets(facetRes);
      setIsConnected(true);
    } catch (e) {
      console.error("Fetch logs/facets failed", e);
      setIsConnected(false);
    }
  }, [
    activeWorkspaceId,
    activeSourceId,
    sources,
    searchQuery,
    filters,
    sortBy,
    sortOrder,
    setLogs,
    setAvailableFacets,
    showAnomalies,
    timeRange,
  ]);

  // Orchestrator Hub state

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 2500);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  // Search Bar Ref
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!lastJob) {
      // If we had an active job that disappeared without reaching 'completed' or 'failed'
      // (e.g. workspace switch), we might want to clear the toast.
      // But typically, sonner toasts should have a timeout or be manually dismissible.
      return;
    }

    // Initialize refs on first job discovery to avoid "phantom" toasts for old jobs
    if (lastJobId.current === null) {
      lastJobId.current = lastJob.id;
      prevJobStatus.current = lastJob.status;
      return;
    }

    // Only trigger if it's a new job or a status transition for the same job
    if (lastJob.id !== lastJobId.current || lastJob.status !== prevJobStatus.current) {
      if (lastJob.status === "completed") {
        toast.success("Ingestion complete", {
          id: "ingest",
          description: `Processed ${lastJob.total_lines.toLocaleString()} lines.`,
        });
        fetchLogs();
      } else if (lastJob.status === "failed") {
        toast.error("Ingestion failed", { id: "ingest", description: "Check sidecar logs for details." });
      }

      lastJobId.current = lastJob.id;
      prevJobStatus.current = lastJob.status;
    }
  }, [lastJob, fetchLogs]);

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

    window.addEventListener("loglens:refresh-logs", handleRefresh);
    window.addEventListener("loglens:clear-filters", handleClear);
    return () => {
      window.removeEventListener("loglens:refresh-logs", handleRefresh);
      window.removeEventListener("loglens:clear-filters", handleClear);
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

  const handleImportLocal = async (path: string, tail: boolean, folderId?: string | null) => {
    const normalizedPath = path.replaceAll("\\", "/");
    const newSource = await createSource(
      activeWorkspaceId,
      {
        name: path.split(/[/\\]/).pop() ?? path,
        type: "local",
        path: normalizedPath,
      },
      folderId,
    );

    setActiveSource(activeWorkspaceId, newSource.id);

    try {
      setTransitioningSourceId(newSource.id);
      setLogs([], 0); // Clear current logs immediately
      
      await callSidecar({
        method: "ingest_local_file",
        params: { 
          filepath: normalizedPath,
          workspace_id: activeWorkspaceId,
          source_id: newSource.id
        },
      });

      if (tail) {
        await callSidecar({
          method: "start_tail",
          params: {
            filepath: normalizedPath,
            workspace_id: activeWorkspaceId,
            source_id: newSource.id,
          },
        });
        setTailingSourceIds((prev) => new Set(prev).add(newSource.id));
        setTailing(true);
        toast.success(`Live monitoring active for ${path}`);
      }
    } catch (e: unknown) {
      setTransitioningSourceId(null);
      toast.error(e instanceof Error ? e.message : "Failed to import file.", { id: "ingest" });
    }
  };

  const handleImportSSH = async (
    host: string,
    port: number,
    user: string,
    pass: string,
    path: string,
    tail: boolean,
    folderId?: string | null,
  ) => {
    const connectionPath = `${user}@${host}:${path}`;
    const newSource = await createSource(
      activeWorkspaceId,
      {
        name: `${host}: ${path.split("/").pop() ?? path}`,
        type: "ssh",
        path: connectionPath,
      },
      folderId,
    );
    setActiveSource(activeWorkspaceId, newSource.id);
    if (!tail) {
      toast.info("Non-tail SSH import is not yet supported. Enable Live Stream.");
      return;
    }
    try {
      setTransitioningSourceId(newSource.id);
      // Clear logs immediately
      setLogs([], 0);

      await callSidecar<{ status: string }>("start_ssh_tail", {
        host,
        port,
        username: user,
        password: pass,
        filepath: path,
        workspace_id: activeWorkspaceId,
        folder_id: folderId,
      });

      setTailingSourceIds((prev) => new Set(prev).add(newSource.id));
      setTailing(true);
      toast.success(`SSH tailing started for ${connectionPath}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "SSH connection failed.");
    }
  };

  const handleIngestManual = async (rawText: string, folderId?: string | null) => {
    const newSource = await createSource(
      activeWorkspaceId,
      {
        name: `Paste (${new Date().toLocaleTimeString()})`,
        type: "manual",
        path: "manual-buffer",
      },
      folderId,
    );
    setActiveSource(activeWorkspaceId, newSource.id);

    const entries = parseManualLogs(rawText).map((e) => ({
      ...e,
      workspace_id: activeWorkspaceId,
      source_id: newSource.id,
    }));
    if (entries.length === 0) {
      toast.warning("Manual buffer is empty or invalid.");
      return;
    }
    try {
      setTransitioningSourceId(newSource.id);
      setLogs([], 0);
      // Lean INSERT — fast because Drain3/metadata are deferred to background worker
      await callSidecar({ method: "ingest_logs", params: { logs: entries } });
    } catch (error) {
      setTransitioningSourceId(null);
      toast.error(error instanceof Error ? error.message : "Manual ingestion failed.", {
        id: "ingest",
      });
    }
  };

  const handleImportLive = async (
    name: string,
    types: { syslog: boolean; http: boolean },
    folderId?: string | null,
  ) => {
    const { settings } = useSettingsStore.getState();
    try {
      const promises = [];
      if (types.syslog) {
        promises.push(
          callSidecar({
            method: "create_log_stream",
            params: {
              workspace_id: activeWorkspaceId,
              type: "syslog",
              name: name,
              port: settings.ingestion_syslog_port,
            },
          }),
        );
      }
      if (types.http) {
        promises.push(
          callSidecar({
            method: "create_log_stream",
            params: {
              workspace_id: activeWorkspaceId,
              type: "http",
              name: name,
              port: settings.ingestion_http_port,
            },
          }),
        );
      }

      await Promise.all(promises);

      // Add as a formal source to the workspace so it gets a tab
      const newSource = await createSource(
        activeWorkspaceId,
        {
          name: name,
          type: "live",
          path: name, // We'll filter by source_id matching this name
        },
        folderId,
      );

      setActiveSource(activeWorkspaceId, newSource.id);

      toast.success(`Live collection "${name}" active`, {
        id: "live-ingest",
        description: `Listening on ${types.syslog ? `UDP:${settings.ingestion_syslog_port} ` : ""}${
          types.http ? `HTTP:${settings.ingestion_http_port}` : ""
        }`,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to start live collection.", {
        id: "live-ingest",
      });
    }
  };

  const handleToggleTail = async (tail: boolean) => {
    try {
      if (!tail) {
        await callSidecar({
          method: "stop_tail",
          params: { filepath: "ALL", workspace_id: activeWorkspaceId },
        });
        setTailingSourceIds(new Set());
      }
      setTailing(tail);
    } catch {
      toast.error("Failed to update monitoring state.");
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

    // Also wipe the logs from the database for this specific source to avoid "ghost logs"
    try {
      await callSidecar({
        method: "delete_logs",
        params: { workspace_id: activeWorkspaceId, source_id: src?.id },
      });
      fetchLogs();
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
    if (!existingSrc) {
      const newSrc = await createSource(activeWorkspaceId, {
        name: fusionName,
        type: "fusion",
        path: fusionId,
      });
      setActiveSource(activeWorkspaceId, newSrc.id);
    } else {
      updateSource(activeWorkspaceId, existingSrc.id, { name: fusionName });
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
        showDistribution={showDistribution}
        onDistributionClose={() => setShowDistribution(!showDistribution)}
        workspaceId={activeWorkspaceId}
        leftPanel={<FacetSidebar />}
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
          />
        )}
      </InvestigationLayout>

      <CustomParserModal
        workspaceId={activeWorkspaceId ?? ""}
        sourceId={activeParserSource ?? ""}
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
      <WorkspaceEngineSettings
        isOpen={isEngineSettingsOpen}
        onClose={() => setIsEngineSettingsOpen(false)}
        workspaceId={activeWorkspaceId}
      />
    </>
  );
}
