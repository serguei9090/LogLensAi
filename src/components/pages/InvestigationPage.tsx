import { useState, useEffect } from "react";
import { InvestigationLayout } from "@/components/templates/InvestigationLayout";
import { VirtualLogTable } from "@/components/organisms/VirtualLogTable";
import type { LogEntry } from "@/components/organisms/VirtualLogTable";
import { ImportFeedModal } from "@/components/organisms/ImportFeedModal";
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

  // Workspace & source state
  const { activeWorkspaceId, addSource, removeSource, setActiveSource } =
    useWorkspaceStore();
  const activeWorkspace = useWorkspaceStore(selectActiveWorkspace);
  const activeSource = useWorkspaceStore(selectActiveSource);

  const sources: LogSource[] = activeWorkspace?.sources ?? [];
  const activeSourceId = activeWorkspace?.activeSourceId ?? null;

  // Track which source IDs are currently being live-tailed
  const [tailingSourceIds, setTailingSourceIds] = useState<Set<string>>(new Set());

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  // ── Log fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeWorkspaceId) return;

    const fetchLogs = async () => {
      try {
        // Build source_id filter: if a specific tab is selected, scope to that path
        const sourceFilter =
          activeSource
            ? [{ field: "source_id", operator: "equals", value: activeSource.path }]
            : [];

        const combinedFilters =
          filters.length > 0 || sourceFilter.length > 0
            ? [...sourceFilter, ...filters]
            : undefined;

        const result = await callSidecar<{ logs: LogEntry[]; total: number }>({
          method: "get_logs",
          params: {
            workspace_id: activeWorkspaceId,
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
  }, [activeWorkspaceId, activeSource, searchQuery, filters, sortBy, sortOrder, setLogs]);

  // ── Sort ──────────────────────────────────────────────────────────────────

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSort(field, sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSort(field, "desc");
    }
  };

  // ── Import / ingest handlers ──────────────────────────────────────────────

  const handleImportLocal = async (path: string, tail: boolean) => {
    const normalizedPath = path.replace(/\\/g, "/");
    
    // Register the source in the workspace store so a tab appears
    const newSource = addSource(activeWorkspaceId, {
      name: path.split(/[/\\]/).pop() ?? path,
      type: "local",
      path: normalizedPath,
    });

    try {
      // Step 1: Always ingest existing content first for better UX (unless file is massive)
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

      // Step 2: Start tailing if requested
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
      console.error("Import error:", e);
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
      const msg = e instanceof Error ? e.message : "SSH connection failed.";
      toast.error(msg);
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
      console.error("Ingestion error:", error);
      toast.error(
        error instanceof Error ? error.message : "Manual ingestion failed.",
        { id: "ingest" },
      );
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
    } catch (error) {
      console.error("Tail error:", error);
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
      // Best-effort stop the tailer for this specific source
      try {
        await callSidecar({
          method: "stop_tail",
          params: { filepath: src.path, workspace_id: activeWorkspaceId },
        });
      } catch {
        // Non-fatal: remove the tab anyway
      }
      setTailingSourceIds((prev) => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
    }
    removeSource(activeWorkspaceId, sourceId);
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
        sources={sources}
        activeSourceId={activeSourceId}
        tailingSourceIds={tailingSourceIds}
        onSelectSource={handleSelectSource}
        onRemoveSource={handleRemoveSource}
      >
        <VirtualLogTable
          logs={logs}
          highlights={highlights}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          onAddComment={(id, comment) => {
            // Optimistic update: instantly toggle icons and state in memory
            const has_comment = comment.trim().length > 0;
            updateLog(id, { comment, has_comment });

            // Backend sync
            callSidecar({
              method: "update_log_comment",
              params: { log_id: id, comment },
            })
              .then(() => toast.success("Annotation saved"))
              .catch(() => {
                // Rollback on error
                const originalLog = logs.find(l => l.id === id);
                if (originalLog) {
                  updateLog(id, { comment: originalLog.comment, has_comment: originalLog.has_comment });
                }
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
    </>
  );
}
