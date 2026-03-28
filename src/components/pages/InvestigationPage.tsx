import { useState, useEffect, useMemo } from "react";
import { InvestigationLayout } from "@/components/templates/InvestigationLayout";
import { VirtualLogTable } from "@/components/organisms/VirtualLogTable";
import type { LogEntry } from "@/components/organisms/VirtualLogTable";
import { ImportFeedModal } from "@/components/organisms/ImportFeedModal";
import { OrchestratorHub } from "@/components/organisms/OrchestratorHub";
import { useInvestigationStore } from "@/store/investigationStore";
import {
  useWorkspaceStore,
  selectActiveWorkspace,
  selectActiveSource,
  type LogSource,
} from "@/store/workspaceStore";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
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
  } = useInvestigationStore();

  const { activeWorkspaceId, addSource, removeSource, setActiveSource } =
    useWorkspaceStore();
  const activeWorkspace = useWorkspaceStore(selectActiveWorkspace);
  const activeSource = useWorkspaceStore(selectActiveSource);

  const sources: LogSource[] = activeWorkspace?.sources ?? [];
  const activeSourceId = activeWorkspace?.activeSourceId ?? null;

  const [tailingSourceIds, setTailingSourceIds] = useState<Set<string>>(new Set());
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  // Orchestrator Hub state
  const [isOrchestratorOpen, setIsOrchestratorOpen] = useState(false);
  const [editingFusionId, setEditingFusionId] = useState<string | null>(null);
  const [editingFusionName, setEditingFusionName] = useState<string | null>(null);

  // Memoized non-fusion sources — prevents new array ref on every render
  // which would cause OrchestratorHub's useEffect to reset form state.
  const nonFusionSources = useMemo(
    () => sources.filter((s) => s.type !== "fusion"),
    [sources]
  );

  // ── Log fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeWorkspaceId) return;

    const fetchLogs = async () => {
      try {
        const activeSrc = sources.find(s => s.id === activeSourceId);
        const isFusion = activeSrc?.type === "fusion";

        const sourceFilter =
          activeSrc && !isFusion
            ? [{ field: "source_id", operator: "equals", value: activeSrc.path }]
            : [];

        const combinedFilters =
          filters.length > 0 || sourceFilter.length > 0
            ? [...sourceFilter, ...filters]
            : undefined;

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
  }, [activeWorkspaceId, activeSource, activeSourceId, sources, searchQuery, filters, sortBy, sortOrder, setLogs]);

  // ── Sort ──────────────────────────────────────────────────────────────────

  const handleSort = (field: string) => {
    setSort(field, sortBy === field && sortOrder === "asc" ? "desc" : "asc");
  };

  // ── Import / ingest handlers ──────────────────────────────────────────────

  const handleImportLocal = async (path: string, tail: boolean) => {
    const normalizedPath = path.replace(/\\/g, "/");
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
        await callSidecar({ method: "ingest_logs", params: { logs: entries } });
        toast.success(`Loaded ${entries.length} existing entries.`, { id: "ingest" });
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
      const msg = e instanceof Error ? e.message : "Failed to import file.";
      toast.error(msg, { id: "ingest" });
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
        params: { host, port, username: user, password: pass, filepath: path, workspace_id: activeWorkspaceId },
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
      await callSidecar({ method: "ingest_logs", params: { logs: entries } });
      toast.success(`Ingested ${entries.length} log entries.`, { id: "ingest" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Manual ingestion failed.", { id: "ingest" });
    }
  };

  const handleToggleTail = async (tail: boolean) => {
    try {
      if (!tail) {
        await callSidecar({ method: "stop_tail", params: { filepath: "ALL", workspace_id: activeWorkspaceId } });
        setTailingSourceIds(new Set());
      }
      setTailing(tail);
    } catch {
      toast.error("Failed to update monitoring state.");
    }
  };

  // ── Source tab handlers ────────────────────────────────────────────────────

  const handleSelectSource = (sourceId: string | null) => {
    setActiveSource(activeWorkspaceId, sourceId);
  };

  const handleRemoveSource = async (sourceId: string) => {
    const src = sources.find((s) => s.id === sourceId);
    if (src && tailingSourceIds.has(sourceId)) {
      try {
        await callSidecar({ method: "stop_tail", params: { filepath: src.path, workspace_id: activeWorkspaceId } });
      } catch { /* Ignored */ }
      setTailingSourceIds((prev) => { const next = new Set(prev); next.delete(sourceId); return next; });
    }
    removeSource(activeWorkspaceId, sourceId);
  };

  // ── Orchestrator Hub handlers ──────────────────────────────────────────────

  const handleOrchestrateOpen = () => {
    setEditingFusionId(null);
    setEditingFusionName(null);
    setIsOrchestratorOpen(true);
  };

  const handleEditFusion = (sourceId: string) => {
    const src = sources.find(s => s.id === sourceId);
    if (!src) return;
    setEditingFusionId(src.path);   // path stores fusionId for fusion-type sources
    setEditingFusionName(src.name);
    setIsOrchestratorOpen(true);
  };

  const handleFusionSaved = (fusionId: string, fusionName: string) => {
    // Check if fusion tab already exists — update its name, otherwise add
    const existingSrc = sources.find(s => s.path === fusionId);
    if (!existingSrc) {
      const newSrc = addSource(activeWorkspaceId, {
        name: fusionName,
        type: "fusion",
        path: fusionId,
      });
      // Auto-switch to the new fusion tab
      setActiveSource(activeWorkspaceId, newSrc.id);
    }
    // If editing, the name is stored in store.name — updating requires a store action
    // TODO(ORK-001): Add updateSource action to workspaceStore for renaming fusion tabs
  };

  // ── Render ────────────────────────────────────────────────────────────────

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
      >
        <VirtualLogTable
          logs={logs}
          highlights={highlights}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          onAddComment={(id, comment) => {
            const has_comment = comment.trim().length > 0;
            updateLog(id, { comment, has_comment });
            callSidecar({ method: "update_log_comment", params: { log_id: id, comment } })
              .then(() => toast.success("Annotation saved"))
              .catch(() => {
                const originalLog = logs.find(l => l.id === id);
                if (originalLog) updateLog(id, { comment: originalLog.comment, has_comment: originalLog.has_comment });
                toast.error("Failed to save annotation");
              });
          }}
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
        onFusionSaved={handleFusionSaved}
      />
    </>
  );
}
