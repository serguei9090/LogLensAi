import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { useIngestionStore } from "@/store/ingestion";
import { useInvestigationStore } from "@/store/investigationStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { toast } from "sonner";

export async function importSshStream(
  workspaceId: string,
  host: string,
  port: number,
  user: string,
  pass: string,
  path: string,
  tail: boolean,
  folderId: string | null | undefined,
  setTailingSourceIds: React.Dispatch<React.SetStateAction<Set<string>>>,
) {
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

  const connectionPath = `${user}@${host}:${path}`;
  let newSourceId: string | null = null;
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
    newSourceId = newSource.id;

    setActiveSource(workspaceId, newSource.id);

    if (!tail) {
      toast.info("Non-tail SSH import is not yet supported. Enable Live Stream.");
      setImportProcessing(false);
      return;
    }

    addTransitioningSource(newSource.id);
    useIngestionStore.getState().startIngestion(newSource.id);
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

    addLiveSource();
    startPolling(workspaceId);
    setTailingSourceIds((prev) => new Set(prev).add(newSource.id));
    setTailing(true);
    toast.success(`SSH tailing started for ${connectionPath}`);

    setTimeout(() => {
      setImportOpen(false);
      setImportProcessing(false);
    }, 300);
  } catch (e: unknown) {
    setImportProcessing(false);
    if (newSourceId) {
      removeTransitioningSource(newSourceId);
      useIngestionStore.getState().stopIngestion(newSourceId);
    }
    toast.error(e instanceof Error ? e.message : "SSH connection failed.");
  }
}
