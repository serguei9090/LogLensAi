import { AIInvestigationSidebar } from "@/components/organisms/AIInvestigationSidebar";
import { ImportFeedModal } from "@/components/organisms/ImportFeedModal";
import { OrchestratorHub } from "@/components/organisms/OrchestratorHub";
import { VirtualLogTable } from "@/components/organisms/VirtualLogTable";
import type { LogEntry } from "@/components/organisms/VirtualLogTable";
import { WorkspaceEngineSettings } from "@/components/organisms/WorkspaceEngineSettings";
import { InvestigationLayout } from "@/components/templates/InvestigationLayout";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { useAiStore } from "@/store/aiStore";
import { useInvestigationStore } from "@/store/investigationStore";
import { useSettingsStore } from "@/store/settingsStore";
import {
  type LogSource,
  selectActiveSource,
  selectActiveWorkspace,
  useWorkspaceStore,
} from "@/store/workspaceStore";
import { useEffect, useMemo, useState } from "react";
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
  } = useInvestigationStore();

  const { activeWorkspaceId, addSource, removeSource, setActiveSource, renameSource } =
    useWorkspaceStore();
  const { fetchSettings } = useSettingsStore();
  const activeWorkspace = useWorkspaceStore(selectActiveWorkspace);
  const { setSidebarOpen, sendMessage, setSession } = useAiStore();

  const sources: LogSource[] = activeWorkspace?.sources ?? [];
  const activeSourceId = activeWorkspace?.activeSourceId ?? null;

  const [tailingSourceIds, setTailingSourceIds] = useState<Set<string>>(new Set());
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isEngineSettingsOpen, setIsEngineSettingsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  // Orchestrator Hub state
  const [isOrchestratorOpen, setIsOrchestratorOpen] = useState(false);
  const [editingFusionId, setEditingFusionId] = useState<string | null>(null);
  const [editingFusionName, setEditingFusionName] = useState<string | null>(null);

  // Anomalies state
  const [anomalousClusters, setAnomalousClusters] = useState<Set<string>>(new Set());

  // Memoized non-fusion sources
  const nonFusionSources = useMemo(() => sources.filter((s) => s.type !== "fusion"), [sources]);

  // ── State Synchronization ──────────────────────────────────────────────────

  useEffect(() => {
    if (activeWorkspaceId) {
      fetchSettings(activeWorkspaceId);
    }
  }, [activeWorkspaceId, fetchSettings]);

  useEffect(() => {
    syncActiveSource(activeSourceId);
  }, [activeSourceId, syncActiveSource]);

  // ── Log fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeWorkspaceId) {
      return;
    }

    const fetchLogs = async () => {
      try {
        if (showAnomalies) {
          const anomRes = await callSidecar<{ anomalies: { cluster_id: string }[] }>({
            method: "get_anomalies",
            params: { workspace_id: activeWorkspaceId },
          });
          setAnomalousClusters(new Set(anomRes.anomalies.map((a) => a.cluster_id)));
        } else {
          setAnomalousClusters(new Set());
        }

        const activeSrc = sources.find((s) => s.id === activeSourceId);
        const isFusion = activeSrc?.type === "fusion";
        const sourceFilter =
          activeSrc && !isFusion
            ? [{ field: "source_id", operator: "equals", value: activeSrc.path }]
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
        });
        setLogs(result.logs ?? [], result.total ?? 0);
        setIsConnected(true);
      } catch (e) {
        console.error("Fetch logs failed", e);
        setIsConnected(false);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 2500);
    return () => clearInterval(interval);
  }, [
    activeWorkspaceId,
    activeSourceId,
    sources,
    searchQuery,
    filters,
    sortBy,
    sortOrder,
    setLogs,
    showAnomalies,
    timeRange,
  ]);

  const handleSort = (field: string) => {
    setSort(field, sortBy === field && sortOrder === "asc" ? "desc" : "asc");
  };

  const handleImportLocal = async (path: string, tail: boolean) => {
    const normalizedPath = path.replaceAll("\\", "/");
    const newSource = addSource(activeWorkspaceId, {
      name: path.split(/[/\\]/).pop() ?? path,
      type: "local",
      path: normalizedPath,
    });

    try {
      toast.loading("Reading file content…", { id: "ingest" });
      const content = await callSidecar<string>({
        method: "read_file",
        params: { filepath: normalizedPath },
      });
      const entries = parseManualLogs(content).map((e) => ({
        ...e,
        workspace_id: activeWorkspaceId,
        source_id: normalizedPath,
      }));

      if (entries.length > 0) {
        toast.loading("Clustering patterns (Drain3)…", {
          id: "ingest",
          description: `Processing ${entries.length} log lines through pattern mining`,
        });
        await callSidecar({ method: "ingest_logs", params: { logs: entries } });
        toast.success(`${entries.length} entries loaded & clustered`, {
          id: "ingest",
          description: "Drain3 pattern mining complete",
        });
      } else {
        toast.dismiss("ingest");
      }

      if (tail) {
        await callSidecar({
          method: "start_tail",
          params: { filepath: normalizedPath, workspace_id: activeWorkspaceId },
        });
        setTailingSourceIds((prev) => new Set(prev).add(newSource.id));
        setTailing(true);
        toast.success(`Live monitoring active for ${path}`);
      }
    } catch (e: unknown) {
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
  ) => {
    const connectionPath = `${user}@${host}:${path}`;
    const newSource = addSource(activeWorkspaceId, {
      name: `${host}: ${path.split("/").pop() ?? path}`,
      type: "ssh",
      path: connectionPath,
    });
    if (!tail) {
      toast.info("Non-tail SSH import is not yet supported. Enable Live Stream.");
      return;
    }
    try {
      await callSidecar({
        method: "start_ssh_tail",
        params: {
          host,
          port,
          username: user,
          password: pass,
          filepath: path,
          workspace_id: activeWorkspaceId,
        },
      });
      setTailingSourceIds((prev) => new Set(prev).add(newSource.id));
      setTailing(true);
      toast.success(`SSH tailing started for ${connectionPath}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "SSH connection failed.");
    }
  };

  const handleIngestManual = async (rawText: string) => {
    const entries = parseManualLogs(rawText).map((e) => ({
      ...e,
      workspace_id: activeWorkspaceId,
    }));
    if (entries.length === 0) {
      toast.warning("Manual buffer is empty or invalid.");
      return;
    }
    try {
      toast.loading("Clustering patterns (Drain3)…", {
        id: "ingest",
        description: `Processing ${entries.length} log lines through pattern mining`,
      });
      await callSidecar({ method: "ingest_logs", params: { logs: entries } });
      toast.success(`${entries.length} entries loaded & clustered`, {
        id: "ingest",
        description: "Drain3 pattern mining complete",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Manual ingestion failed.", {
        id: "ingest",
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
          params: { filepath: src.path, workspace_id: activeWorkspaceId },
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

  const handleFusionSaved = (fusionId: string, fusionName: string) => {
    const existingSrc = sources.find((s) => s.path === fusionId);
    if (!existingSrc) {
      const newSrc = addSource(activeWorkspaceId, {
        name: fusionName,
        type: "fusion",
        path: fusionId,
      });
      setActiveSource(activeWorkspaceId, newSrc.id);
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
        onSearch={setSearchQuery}
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
        onEngineSettingsOpen={() => setIsEngineSettingsOpen(true)}
        rightPanel={
          <AIInvestigationSidebar onEngineSettingsOpen={() => setIsEngineSettingsOpen(true)} />
        }
      >
        <VirtualLogTable
          logs={logs}
          highlights={highlights}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          anomalousClusters={anomalousClusters}
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
        />
      </InvestigationLayout>

      <ImportFeedModal
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImportLocal={handleImportLocal}
        onImportSSH={handleImportSSH}
        onIngestManual={handleIngestManual}
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
