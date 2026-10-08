import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { parseManualLogs } from "@/lib/log-utils";
import { useIngestionStore } from "@/store/ingestion";
import { useInvestigationStore } from "@/store/investigationStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { toast } from "sonner";

export async function ingestManualLogs(
  workspaceId: string,
  rawText: string,
  folderId?: string | null,
) {
  const {
    setImportProcessing,
    setImportOpen,
    addTransitioningSource,
    removeTransitioningSource,
    startPolling,
  } = useIngestionStore.getState();

  const { createSource, setActiveSource } = useWorkspaceStore.getState();
  const { setLogs } = useInvestigationStore.getState();

  setImportProcessing(true);

  let newSourceId: string | null = null;
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
    newSourceId = newSource.id;

    setActiveSource(workspaceId, newSource.id);

    const entries = parseManualLogs(rawText).map((e) => ({
      ...e,
      workspace_id: workspaceId,
      source_id: newSource.id,
    }));

    if (entries.length === 0) {
      toast.warning("Manual buffer is empty or invalid.");
      setImportProcessing(false);
      return;
    }

    addTransitioningSource(newSource.id);
    useIngestionStore.getState().startIngestion(newSource.id);
    setLogs([], 0);

    await callSidecar({ method: "ingest_logs", params: { logs: entries } });

    startPolling(workspaceId);

    setTimeout(() => {
      setImportOpen(false);
      setImportProcessing(false);
    }, 300);
  } catch (error) {
    setImportProcessing(false);
    if (newSourceId) {
      removeTransitioningSource(newSourceId);
      useIngestionStore.getState().stopIngestion(newSourceId);
    }
    toast.error(error instanceof Error ? error.message : "Manual ingestion failed.", {
      id: "ingest",
    });
  }
}
