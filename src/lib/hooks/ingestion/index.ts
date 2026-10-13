import type { LogSource } from "@/store/workspaceStore";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { duplicateLogSource } from "./duplicateIngest";
import { importLiveStream } from "./liveIngest";
import { importLocalFile, stopTail } from "./localIngest";
import { ingestManualLogs } from "./manualIngest";
import { importSshStream } from "./remoteIngest";
import type { LogIngestionHookResult } from "./types";

export * from "./duplicateIngest";
export * from "./liveIngest";
export * from "./localIngest";
export * from "./manualIngest";
export * from "./remoteIngest";
export * from "./types";

/**
 * useLogIngestion provides handlers for importing logs from various sources
 * (Local, SSH, Manual, Live) and manages the transition state during ingestion.
 */
export function useLogIngestion(workspaceId: string | null): LogIngestionHookResult {
  const [tailingSourceIds, setTailingSourceIds] = useState<Set<string>>(new Set());

  const handleImportLocal = useCallback(
    async (path: string, tail: boolean, folderId?: string | null) => {
      if (!workspaceId) {
        return;
      }
      await importLocalFile(workspaceId, path, tail, folderId, setTailingSourceIds);
    },
    [workspaceId],
  );

  const handleStopTail = useCallback(
    async (sourceId: string, filepath: string) => {
      if (!workspaceId) {
        return;
      }
      await stopTail(workspaceId, sourceId, filepath, setTailingSourceIds);
    },
    [workspaceId],
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
      await importSshStream(
        workspaceId,
        host,
        port,
        user,
        pass,
        path,
        tail,
        folderId,
        setTailingSourceIds,
      );
    },
    [workspaceId],
  );

  const handleIngestManual = useCallback(
    async (rawText: string, folderId?: string | null) => {
      if (!workspaceId) {
        return;
      }
      await ingestManualLogs(workspaceId, rawText, folderId);
    },
    [workspaceId],
  );

  const handleImportLive = useCallback(
    async (name: string, types: { syslog: boolean; http: boolean }, folderId?: string | null) => {
      if (!workspaceId) {
        return;
      }
      await importLiveStream(workspaceId, name, types, folderId);
    },
    [workspaceId],
  );

  const duplicateSource = useCallback(
    async (source: LogSource) => {
      if (!workspaceId) {
        toast.error("No active workspace to duplicate into.");
        return;
      }
      await duplicateLogSource(workspaceId, source);
    },
    [workspaceId],
  );

  return {
    tailingSourceIds,
    setTailingSourceIds,
    handleImportLocal,
    duplicateSource,
    handleStopTail,
    handleImportSSH,
    handleIngestManual,
    handleImportLive,
  };
}
