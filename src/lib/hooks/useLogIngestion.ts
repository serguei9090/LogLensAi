import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useIngestionStore } from "@/store/ingestionStore";
import { useInvestigationStore } from "@/store/investigationStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { parseManualLogs } from "../log-utils";
import { callSidecar } from "./useSidecarBridge";

/**
 * useLogIngestion provides handlers for importing logs from various sources
 * (Local, SSH, Manual, Live) and manages the transition state during ingestion.
 *
 * This hook is the SINGLE authoritative trigger for ingestion polling.
 * It calls ingestionStore.startPolling() after every ingest action so that
 * the polling loop only runs when there is actual work to track.
 * For live sources (tail, SSH, syslog, HTTP), it also calls addLiveSource()
 * to keep the loop alive until the source is explicitly stopped.
 */
export function useLogIngestion(workspaceId: string | null, fetchLogs: () => void) {
  const { createSource, setActiveSource } = useWorkspaceStore();
  const { setLogs, setTailing } = useInvestigationStore();
  const { settings } = useSettingsStore();
  const { startPolling, addLiveSource, removeLiveSource } = useIngestionStore();

  const [transitioningSourceId, setTransitioningSourceId] = useState<string | null>(null);
  const [tailingSourceIds, setTailingSourceIds] = useState<Set<string>>(new Set());

  const handleImportLocal = useCallback(
    async (path: string, tail: boolean, folderId?: string | null) => {
      if (!workspaceId) {
        return;
      }

      const normalizedPath = path.replaceAll("\\", "/");
      try {
        const newSource = await createSource(
          workspaceId,
          {
            name: path.split(/[/\\]/).pop() ?? path,
            type: "local",
            path: normalizedPath,
          },
          folderId,
        );

        setActiveSource(workspaceId, newSource.id);
        setTransitioningSourceId(newSource.id);
        setLogs([], 0);

        await callSidecar({
          method: "ingest_local_file",
          params: {
            filepath: normalizedPath,
            workspace_id: workspaceId,
            source_id: newSource.id,
          },
        });

        // Fire polling NOW — the ingest job has just been enqueued.
        startPolling(workspaceId);

        fetchLogs();

        if (tail) {
          await callSidecar({
            method: "start_tail",
            params: {
              filepath: normalizedPath,
              workspace_id: workspaceId,
              source_id: newSource.id,
            },
          });
          // Register live source so polling continues even between bursts.
          addLiveSource();
          setTailingSourceIds((prev) => new Set(prev).add(newSource.id));
          setTailing(true);
          toast.success(`Live monitoring active for ${path}`);
        }
      } catch (e: unknown) {
        setTransitioningSourceId(null);
        toast.error(e instanceof Error ? e.message : "Failed to import file.", { id: "ingest" });
      }
    },
    [
      workspaceId,
      createSource,
      setActiveSource,
      setLogs,
      fetchLogs,
      setTailing,
      startPolling,
      addLiveSource,
    ],
  );

  const handleStopTail = useCallback(
    async (sourceId: string, filepath: string) => {
      if (!workspaceId) {
        return;
      }
      try {
        await callSidecar({
          method: "stop_tail",
          params: { filepath, workspace_id: workspaceId },
        });
        // Release the live source slot — polling will self-terminate if no jobs remain.
        removeLiveSource();
        setTailingSourceIds((prev) => {
          const next = new Set(prev);
          next.delete(sourceId);
          return next;
        });
        if (tailingSourceIds.size <= 1) {
          setTailing(false);
        }
        toast.info("Live monitoring stopped.");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Failed to stop tail.");
      }
    },
    [workspaceId, removeLiveSource, setTailing, tailingSourceIds.size],
  );

  const handleImportSSH = useCallback(
    async (
      host: string,
      port: number,
      user: string,
      pass: string,
      path: string,
      tail: boolean,
      folderId?: string | null,
    ) => {
      if (!workspaceId) {
        return;
      }

      const connectionPath = `${user}@${host}:${path}`;
      try {
        const newSource = await createSource(
          workspaceId,
          {
            name: `${host}: ${path.split("/").pop() ?? path}`,
            type: "ssh",
            path: connectionPath,
          },
          folderId,
        );

        setActiveSource(workspaceId, newSource.id);

        if (!tail) {
          toast.info("Non-tail SSH import is not yet supported. Enable Live Stream.");
          return;
        }

        setTransitioningSourceId(newSource.id);
        setLogs([], 0);

        await callSidecar({
          method: "start_ssh_tail",
          params: {
            host,
            port,
            username: user,
            password: pass,
            filepath: path,
            workspace_id: workspaceId,
            folder_id: folderId,
          },
        });

        // SSH tail is a persistent live source.
        addLiveSource();
        startPolling(workspaceId);

        fetchLogs();
        setTailingSourceIds((prev) => new Set(prev).add(newSource.id));
        setTailing(true);
        toast.success(`SSH tailing started for ${connectionPath}`);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "SSH connection failed.");
      }
    },
    [
      workspaceId,
      createSource,
      setActiveSource,
      setLogs,
      fetchLogs,
      setTailing,
      addLiveSource,
      startPolling,
    ],
  );

  const handleIngestManual = useCallback(
    async (rawText: string, folderId?: string | null) => {
      if (!workspaceId) {
        return;
      }

      try {
        const newSource = await createSource(
          workspaceId,
          {
            name: `Paste (${new Date().toLocaleTimeString()})`,
            type: "manual",
            path: "manual-buffer",
          },
          folderId,
        );

        setActiveSource(workspaceId, newSource.id);

        const entries = parseManualLogs(rawText).map((e) => ({
          ...e,
          workspace_id: workspaceId,
          source_id: newSource.id,
        }));

        if (entries.length === 0) {
          toast.warning("Manual buffer is empty or invalid.");
          return;
        }

        setTransitioningSourceId(newSource.id);
        setLogs([], 0);

        await callSidecar({ method: "ingest_logs", params: { logs: entries } });

        // One-shot ingest — starts polling which will self-terminate on completion.
        startPolling(workspaceId);
        fetchLogs();
      } catch (error) {
        setTransitioningSourceId(null);
        toast.error(error instanceof Error ? error.message : "Manual ingestion failed.", {
          id: "ingest",
        });
      }
    },
    [workspaceId, createSource, setActiveSource, setLogs, fetchLogs, startPolling],
  );

  const handleImportLive = useCallback(
    async (name: string, types: { syslog: boolean; http: boolean }, folderId?: string | null) => {
      if (!workspaceId) {
        return;
      }

      try {
        const promises = [];
        if (types.syslog) {
          promises.push(
            callSidecar({
              method: "create_log_stream",
              params: {
                workspace_id: workspaceId,
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
                workspace_id: workspaceId,
                type: "http",
                name: name,
                port: settings.ingestion_http_port,
              },
            }),
          );
        }

        await Promise.all(promises);

        const newSource = await createSource(
          workspaceId,
          { name, type: "live", path: name },
          folderId,
        );

        setActiveSource(workspaceId, newSource.id);

        // Each active stream keeps the polling loop alive.
        const streamCount = [types.syslog, types.http].filter(Boolean).length;
        for (let i = 0; i < streamCount; i++) {
          addLiveSource();
        }
        startPolling(workspaceId);

        const listeningOn = [
          types.syslog && `UDP:${settings.ingestion_syslog_port}`,
          types.http && `HTTP:${settings.ingestion_http_port}`,
        ]
          .filter(Boolean)
          .join(" & ");

        toast.success(`Live collection "${name}" active`, {
          id: "live-ingest",
          description: listeningOn ? `Listening on ${listeningOn}` : undefined,
        });
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Failed to start live collection.", {
          id: "live-ingest",
        });
      }
    },
    [workspaceId, createSource, setActiveSource, settings, addLiveSource, startPolling],
  );

  return {
    transitioningSourceId,
    setTransitioningSourceId,
    tailingSourceIds,
    setTailingSourceIds,
    handleImportLocal,
    handleStopTail,
    handleImportSSH,
    handleIngestManual,
    handleImportLive,
  };
}
