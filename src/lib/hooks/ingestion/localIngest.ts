import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { type IngestionJob, traceIngestion, useIngestionStore } from "@/store/ingestion";
import { useInvestigationStore } from "@/store/investigationStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { toast } from "sonner";

export async function importLocalFile(
  workspaceId: string,
  path: string,
  tail: boolean,
  folderId: string | null | undefined,
  setTailingSourceIds: React.Dispatch<React.SetStateAction<Set<string>>>,
) {
  traceIngestion(`[Hook] handleImportLocal: Started for path=${path}, tail=${tail}`);
  const {
    setImportProcessing,
    setImportOpen,
    addTransitioningSource,
    removeTransitioningSource,
    addLiveSource,
    startPolling,
  } = useIngestionStore.getState();

  const { createSource, setActiveSource } = useWorkspaceStore.getState();
  const { setLogs, setTailing } = useInvestigationStore.getState();

  setImportProcessing(true);

  const normalizedPath = path.replaceAll("\\", "/");
  const baseName = path.split(/[/\\]/).pop() ?? path;
  const existingSources =
    useWorkspaceStore.getState().workspaces.find((w) => w.id === workspaceId)?.sources ?? [];
  const existingNames = new Set(existingSources.map((s) => s.name));

  let uniqueName = baseName;
  let counter = 2;
  while (existingNames.has(uniqueName)) {
    uniqueName = `${baseName} (${counter})`;
    counter++;
  }

  let newSourceId: string | null = null;
  try {
    const newSource = await createSource(
      workspaceId,
      {
        name: uniqueName,
        type: "local",
        path: normalizedPath,
      },
      folderId,
    );
    newSourceId = newSource.id;
    traceIngestion(
      `[Hook] handleImportLocal: Created workspace source id=${newSourceId}, name=${newSource.name}`,
    );

    setActiveSource(workspaceId, newSource.id);

    addTransitioningSource(newSource.id);
    useIngestionStore.getState().startIngestion(newSource.id);
    setLogs([], 0);

    traceIngestion("[Hook] handleImportLocal: Dispatched ingest_local_file sidecar request...");
    const result = await callSidecar<{
      status: string;
      job_id: number;
      total_lines: number;
      queue_position: number;
    }>({
      method: "ingest_local_file",
      params: {
        filepath: normalizedPath,
        workspace_id: workspaceId,
        source_id: newSource.id,
      },
    });

    traceIngestion(
      `[Hook] handleImportLocal: sidecar returned job_id=${result.job_id}, status=${result.status}`,
    );

    if (result.status === "completed") {
      const isAlreadyProcessed = result.total_lines === 0;
      traceIngestion(
        `[Hook] handleImportLocal: Completion hit (alreadyProcessed=${isAlreadyProcessed}, lines=${result.total_lines}, job_id=${result.job_id}).`,
      );
      const completedJob: IngestionJob = {
        id: result.job_id || Date.now(),
        workspace_id: workspaceId,
        source_id: newSource.id,
        status: "completed",
        total_lines: result.total_lines,
        processed_lines: result.total_lines,
        queue_position: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      useIngestionStore.getState().addOrUpdateJob(completedJob);
      useIngestionStore.getState().markJobHandled(completedJob.id);
      removeTransitioningSource(newSource.id);
      useIngestionStore.getState().stopIngestion(newSource.id);
      await useWorkspaceStore.getState().fetchHierarchy(workspaceId);

      if (tail) {
        traceIngestion("[Hook] handleImportLocal: Initializing live monitoring (tail)...");
        await callSidecar({
          method: "start_tail",
          params: {
            filepath: normalizedPath,
            workspace_id: workspaceId,
            source_id: newSource.id,
          },
        });
        addLiveSource();
        setTailingSourceIds((prev) => new Set(prev).add(newSource.id));
        setTailing(true);
        toast.success(`Live monitoring active for ${path}`);
      }

      setImportOpen(false);
      setImportProcessing(false);
      globalThis.dispatchEvent(new CustomEvent("loglens:refresh-logs"));
      if (isAlreadyProcessed) {
        toast.success(`File ${newSource.name} was already processed.`);
      } else {
        toast.success(`Successfully ingested ${result.total_lines} lines from ${newSource.name}`);
      }
      return;
    }

    const newJob: IngestionJob = {
      id: result.job_id,
      workspace_id: workspaceId,
      source_id: newSource.id,
      status: result.status as "queued" | "pending" | "processing" | "completed" | "failed",
      total_lines: result.total_lines,
      processed_lines: 0,
      queue_position: result.queue_position,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    traceIngestion(
      `[Hook] handleImportLocal: Adding job ${result.job_id} to store, calling startPolling.`,
    );
    useIngestionStore.getState().addOrUpdateJob(newJob);

    startPolling(workspaceId);

    if (tail) {
      traceIngestion("[Hook] handleImportLocal: Initializing live monitoring (tail)...");
      await callSidecar({
        method: "start_tail",
        params: {
          filepath: normalizedPath,
          workspace_id: workspaceId,
          source_id: newSource.id,
        },
      });
      addLiveSource();
      setTailingSourceIds((prev) => new Set(prev).add(newSource.id));
      setTailing(true);
      toast.success(`Live monitoring active for ${path}`);
    }

    setTimeout(() => {
      setImportOpen(false);
      setImportProcessing(false);
    }, 300);
  } catch (e: unknown) {
    traceIngestion(
      `[Hook] handleImportLocal: Error: ${e instanceof Error ? e.message : String(e)}`,
    );
    setImportProcessing(false);
    if (newSourceId) {
      removeTransitioningSource(newSourceId);
      useIngestionStore.getState().stopIngestion(newSourceId);
    }
    toast.error(e instanceof Error ? e.message : "Failed to import file.", { id: "ingest" });
  }
}

export async function stopTail(
  workspaceId: string,
  sourceId: string,
  filepath: string,
  setTailingSourceIds: React.Dispatch<React.SetStateAction<Set<string>>>,
) {
  try {
    await callSidecar({
      method: "stop_tail",
      params: { filepath, workspace_id: workspaceId },
    });
    useIngestionStore.getState().removeLiveSource();
    setTailingSourceIds((prev) => {
      const next = new Set(prev);
      next.delete(sourceId);
      if (next.size === 0) {
        useInvestigationStore.getState().setTailing(false);
      }
      return next;
    });
    toast.info("Live monitoring stopped.");
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "Failed to stop tail.");
  }
}
